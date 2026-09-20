// Turn Jev jobs into requests, consulting the cache, and run them with the
// limiter. Records only categories and token counts, never bodies.

import { charsPerTokenFor, estimateTokens } from "../lib/tokens.js";
import { buildQuestion } from "../rules/question.js";
import type {
  Evaluate,
  Progress,
  RecorderHandle,
  SystemOneNoul,
} from "../types.js";
import type { AnswerCache } from "./cache.js";
import { cacheKey } from "./cache.js";
import { ProviderError } from "./jev.js";
import { Limiter } from "./limiter.js";
import type { JevJob } from "./plan.js";
import { buildState } from "./state.js";

export const REQUEST_TOKEN_CAP = 60_000;

export interface PreparedRequest {
  job: JevJob;
  state: string;
  /** The state was clipped to the token cap; recorded with each request. */
  truncated: boolean;
  /** Questions still needing an answer, keyed by rule id. */
  questions: Record<string, SystemOneNoul>;
  keys: Record<string, string>;
  /** Answers already served from cache. */
  cached: Record<string, number>;
  estimatedTokens: number;
}

export const prepareRequests = (
  jobs: JevJob[],
  cache: AnswerCache,
  model: string
): PreparedRequest[] => {
  const out: PreparedRequest[] = [];
  for (const job of jobs) {
    const rules = job.rules.map((r) => r.rule);
    const { state, truncated } = buildState(job.unit, rules);
    const questions: Record<string, SystemOneNoul> = {};
    const keys: Record<string, string> = {};
    const cached: Record<string, number> = {};
    for (const rule of rules) {
      const q = buildQuestion(rule);
      const key = cacheKey(q, state, model);
      const hit = cache.get(key);
      if (hit) {
        cached[rule.id] = hit.noul;
      } else {
        questions[rule.id] = q;
        keys[rule.id] = key;
      }
    }
    const perToken = charsPerTokenFor(job.unit.kind);
    const estimatedTokens =
      estimateTokens(state, perToken) +
      Object.values(questions).reduce(
        (s, q) => s + estimateTokens(JSON.stringify(q)),
        0
      );
    out.push({
      cached,
      estimatedTokens,
      job,
      keys,
      questions,
      state,
      truncated,
    });
  }
  return out;
};

// Split a prepared request whose questions exceed the cap into chunks.
export const chunkQuestions = (
  prepared: PreparedRequest
): Record<string, SystemOneNoul>[] => {
  const ids = Object.keys(prepared.questions);
  if (ids.length === 0) {
    return [];
  }
  const chunks: Record<string, SystemOneNoul>[] = [];
  let current: Record<string, SystemOneNoul> = {};
  const perToken = charsPerTokenFor(prepared.job.unit.kind);
  let tokens = estimateTokens(prepared.state, perToken);
  for (const id of ids) {
    const q = prepared.questions[id];
    const qTokens = estimateTokens(JSON.stringify(q));
    if (
      Object.keys(current).length > 0 &&
      tokens + qTokens > REQUEST_TOKEN_CAP
    ) {
      chunks.push(current);
      current = {};
      tokens = estimateTokens(prepared.state, perToken);
    }
    current[id] = q;
    tokens += qTokens;
  }
  chunks.push(current);
  return chunks;
};

export interface RunOutcome {
  /** Probabilities per unit id per rule id. */
  answers: Map<string, Record<string, number>>;
  requests: number;
  attempts: number;
  sharedAnswers: number;
  cached: number;
  inputTokens: number;
  errors: number;
  /** Rule ids that could not be answered for a unit, with the error category. */
  failed: { unitId: string; ruleIds: string[]; category: string }[];
}

export interface RunOptions {
  work?: ReturnType<typeof requestWork>;
  evaluate: Evaluate;
  cache: AnswerCache;
  model: string;
  recorder?: RecorderHandle;
  limiter?: Limiter;
  onProgress?: (progress: Progress) => void;
}

// Exact same state, questions and model share one logical request. Provenance
// stays on each consumer; never merge findings from different source locations.
export const requestWork = (prepared: PreparedRequest[]) => {
  const grouped = new Map<
    string,
    {
      prepared: PreparedRequest;
      questions: Record<string, SystemOneNoul>;
      consumers: PreparedRequest[];
    }
  >();
  for (const p of prepared) {
    for (const questions of chunkQuestions(p)) {
      const ids = Object.keys(questions).toSorted();
      const key = JSON.stringify(ids.map((id) => [id, p.keys[id]]));
      const existing = grouped.get(key);
      if (existing) {
        existing.consumers.push(p);
      } else {
        grouped.set(key, { consumers: [p], prepared: p, questions });
      }
    }
  }
  return [...grouped.values()];
};

export const cachedAnswers = (
  prepared: PreparedRequest[]
): Map<string, Record<string, number>> => {
  const answers = new Map<string, Record<string, number>>();
  for (const p of prepared) {
    answers.set(p.job.unit.id, { ...answers.get(p.job.unit.id), ...p.cached });
  }
  return answers;
};

export const runRequests = async (
  prepared: PreparedRequest[],
  options: RunOptions
): Promise<RunOutcome> => {
  const { evaluate, cache, model, recorder, onProgress } = options;
  const limiter = options.limiter ?? new Limiter(20, 8);
  const answers = cachedAnswers(prepared);
  const outcome: RunOutcome = {
    answers,
    attempts: 0,
    cached: prepared.reduce((n, p) => n + Object.keys(p.cached).length, 0),
    errors: 0,
    failed: [],
    inputTokens: 0,
    requests: 0,
    sharedAnswers: 0,
  };
  const work = options.work ?? requestWork(prepared);
  const started = Date.now();
  let completed = 0;
  let aborted = false;
  const progress = () =>
    onProgress?.({
      attempts: outcome.attempts,
      cachedAnswers: outcome.cached,
      completed,
      elapsedMs: Date.now() - started,
      failed: outcome.errors,
      phase: completed === work.length ? "complete" : "evaluating",
      planned: work.length,
    });
  progress();
  // Bounded workers avoid thousands of promises waiting on the limiter.
  let cursor = 0;
  let artifactFailure: unknown;
  const worker = async () => {
    while (cursor < work.length && artifactFailure === undefined) {
      const records: Record<string, unknown>[] = [];
      const { prepared: p, questions, consumers } = work[cursor];
      cursor += 1;
      const release = aborted
        ? () => {
            /* No permit was acquired after cancellation. */
          }
        : await limiter.acquire();
      try {
        if (aborted) {
          throw new ProviderError("auth", 401);
        }
        const remaining: Record<string, SystemOneNoul> = {};
        for (const id of Object.keys(questions)) {
          const hit = cache.get(p.keys[id]);
          if (hit) {
            for (const c of consumers) {
              answers.get(c.job.unit.id)![id] = hit.noul;
            }
            outcome.cached += consumers.length;
          } else {
            remaining[id] = questions[id];
          }
        }
        if (Object.keys(remaining).length > 0) {
          let attempts = 0;
          const onAttempt = () => {
            attempts += 1;
            outcome.attempts += 1;
            progress();
          };
          let response;
          try {
            response = await evaluate(
              { model, questions: remaining, state: p.state },
              onAttempt
            );
          } finally {
            if (attempts === 0) {
              outcome.attempts += 1;
            }
          }
          outcome.requests += 1;
          outcome.inputTokens += response.usage.input_tokens;
          for (const [id, answer] of Object.entries(response.answers)) {
            for (const c of consumers) {
              answers.get(c.job.unit.id)![id] = answer.noul as number;
            }
          }
          outcome.sharedAnswers +=
            (consumers.length - 1) * Object.keys(remaining).length;
          records.push({
            attempts: attempts || 1,
            input_tokens: response.usage.input_tokens,
            kind: "request",
            rule_ids: Object.keys(remaining),
            shared_units: consumers.length,
            status: "ok",
            truncated: p.truncated,
            unit_id: p.job.unit.id,
          });
          try {
            for (const [id, answer] of Object.entries(response.answers)) {
              cache.set(p.keys[id], {
                model: response.model,
                noul: answer.noul as number,
                ts: new Date().toISOString(),
              });
            }
          } catch {
            records.push({
              kind: "cache_write_failed",
              unit_id: p.job.unit.id,
            });
          }
        }
      } catch (error) {
        outcome.errors += 1;
        const category =
          error instanceof ProviderError ? error.category : "provider_error";
        for (const c of consumers) {
          const missing = Object.keys(questions).filter(
            (id) => answers.get(c.job.unit.id)![id] === undefined
          );
          if (missing.length) {
            outcome.failed.push({
              category,
              ruleIds: missing,
              unitId: c.job.unit.id,
            });
          }
        }
        records.push({
          error: category,
          http_status:
            error instanceof ProviderError ? (error.status ?? null) : null,
          kind: "request",
          rule_ids: Object.keys(questions),
          status: "error",
          truncated: p.truncated,
          unit_id: p.job.unit.id,
        });
        if (category === "auth") {
          aborted = true;
        }
      } finally {
        release();
        completed += 1;
        progress();
      }
      try {
        for (const record of records) {
          recorder?.append(record);
        }
      } catch (error) {
        artifactFailure = error;
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(8, work.length) }, () => worker())
  );
  if (artifactFailure !== undefined) {
    throw artifactFailure;
  }
  return outcome;
};
