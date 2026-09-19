// Turn Jev jobs into requests, consulting the cache, and run them with the
// limiter. Records only categories and token counts, never bodies.

import { estimateTokens } from "../lib/tokens.js";
import { buildQuestion } from "../rules/question.js";
import type {
  Evaluate,
  RecorderHandle,
  SystemOneNoul,
  SystemOneRequest,
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
    const estimatedTokens =
      estimateTokens(state) +
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
  let tokens = estimateTokens(prepared.state);
  for (const id of ids) {
    const q = prepared.questions[id];
    const qTokens = estimateTokens(JSON.stringify(q));
    if (
      Object.keys(current).length > 0 &&
      tokens + qTokens > REQUEST_TOKEN_CAP
    ) {
      chunks.push(current);
      current = {};
      tokens = estimateTokens(prepared.state);
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
  cached: number;
  inputTokens: number;
  errors: number;
  /** Rule ids that could not be answered for a unit, with the error category. */
  failed: { unitId: string; ruleIds: string[]; category: string }[];
}

export interface RunOptions {
  evaluate: Evaluate;
  cache: AnswerCache;
  model: string;
  recorder?: RecorderHandle;
  limiter?: Limiter;
  onProgress?: (mark: "." | "x" | "c") => void;
}

export const runRequests = async (
  prepared: PreparedRequest[],
  options: RunOptions
): Promise<RunOutcome> => {
  const { evaluate, cache, model, recorder, onProgress } = options;
  const limiter = options.limiter ?? new Limiter(20, 8);
  const answers = new Map<string, Record<string, number>>();
  const outcome: RunOutcome = {
    answers,
    cached: 0,
    errors: 0,
    failed: [],
    inputTokens: 0,
    requests: 0,
  };
  const tasks: Promise<void>[] = [];
  for (const p of prepared) {
    const unitAnswers: Record<string, number> = { ...p.cached };
    answers.set(p.job.unit.id, unitAnswers);
    outcome.cached += Object.keys(p.cached).length;
    for (const questions of chunkQuestions(p)) {
      const request: SystemOneRequest = { model, questions, state: p.state };
      tasks.push(
        (async () => {
          const release = await limiter.acquire();
          try {
            const response = await evaluate(request);
            outcome.requests += 1;
            outcome.inputTokens += response.usage.input_tokens;
            for (const [ruleId, answer] of Object.entries(response.answers)) {
              const noul = answer.noul as number;
              unitAnswers[ruleId] = noul;
              cache.set(p.keys[ruleId], {
                model: response.model,
                noul,
                ts: new Date().toISOString(),
              });
            }
            recorder?.append({
              input_tokens: response.usage.input_tokens,
              kind: "request",
              rule_ids: Object.keys(questions),
              status: "ok",
              unit_id: p.job.unit.id,
            });
            onProgress?.(".");
          } catch (error) {
            outcome.errors += 1;
            const category =
              error instanceof ProviderError
                ? error.category
                : "provider_error";
            const status =
              error instanceof ProviderError ? error.status : undefined;
            outcome.failed.push({
              category,
              ruleIds: Object.keys(questions),
              unitId: p.job.unit.id,
            });
            recorder?.append({
              error: category,
              http_status: status ?? null,
              kind: "request",
              rule_ids: Object.keys(questions),
              status: "error",
              unit_id: p.job.unit.id,
            });
            onProgress?.("x");
            if (error instanceof ProviderError && error.category === "auth") {
              throw error;
            }
          } finally {
            release();
          }
        })()
      );
    }
    if (Object.keys(p.questions).length === 0) {
      onProgress?.("c");
    }
  }
  const results = await Promise.allSettled(tasks);
  const auth = results.find(
    (r) =>
      r.status === "rejected" &&
      r.reason instanceof ProviderError &&
      r.reason.category === "auth"
  );
  if (auth && auth.status === "rejected") {
    throw auth.reason;
  }
  return outcome;
};
