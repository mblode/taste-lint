// The one stage lint and eval share: plan which rules apply, run the
// mechanical checks, answer the Jev questions (from cache, or live when an
// evaluate is supplied and this is not a dry run), and report abstentions.

import { costUsd } from "../lib/tokens.js";
import type {
  Config,
  Evaluate,
  Finding,
  RecorderHandle,
  Rule,
  Unit,
  Unknown,
  Usage,
} from "../types.js";
import { chunkQuestions, prepareRequests, runRequests } from "./batch.js";
import type { PreparedRequest } from "./batch.js";
import type { AnswerCache } from "./cache.js";
import { planRequests } from "./plan.js";
import type { JevJob } from "./plan.js";

export interface JudgeOptions {
  config: Config;
  model: string;
  cache: AnswerCache;
  /** Absent means answers come from the cache only (a dry run). */
  evaluate?: Evaluate;
  mechanicalOnly?: boolean;
  recorder?: RecorderHandle;
  onProgress?: (mark: "." | "x" | "c") => void;
  /** Narrow or drop a job before it is prepared (eval keeps labelled rules only). */
  jobFilter?: (job: JevJob) => JevJob | null;
}

export interface Judgement {
  mechanical: Finding[];
  jobs: JevJob[];
  /** Requests still needing at least one answer after the cache. */
  pending: PreparedRequest[];
  estimatedRequests: number;
  estimatedTokens: number;
  answers: Map<string, Record<string, number>>;
  unknowns: Unknown[];
  usage: Usage;
}

export const judge = async (
  units: Unit[],
  rules: Rule[],
  options: JudgeOptions
): Promise<Judgement> => {
  const plan = planRequests(units, rules, options.config);
  let jobs = options.mechanicalOnly ? [] : plan.jobs;
  if (options.jobFilter) {
    jobs = jobs
      .map((job) => options.jobFilter?.(job) ?? null)
      .filter((job): job is JevJob => job !== null);
  }
  const prepared = prepareRequests(jobs, options.cache, options.model);
  const pending = prepared.filter((p) => Object.keys(p.questions).length > 0);
  const unknowns: Unknown[] = [...plan.unknowns];
  const usage: Usage = {
    cached: 0,
    costUsd: 0,
    errors: 0,
    inputTokens: 0,
    requests: 0,
  };
  let answers: Map<string, Record<string, number>>;
  if (options.evaluate && pending.length > 0) {
    const outcome = await runRequests(prepared, {
      cache: options.cache,
      evaluate: options.evaluate,
      model: options.model,
      onProgress: options.onProgress,
      recorder: options.recorder,
    });
    answers = outcome.answers;
    usage.requests = outcome.requests;
    usage.cached = outcome.cached;
    usage.inputTokens = outcome.inputTokens;
    usage.costUsd = costUsd(outcome.inputTokens);
    usage.errors = outcome.errors;
    // A question the provider never answered is an abstention with a reason,
    // not a silent pass.
    const unitById = new Map(units.map((u) => [u.id, u]));
    for (const failed of outcome.failed) {
      const unit = unitById.get(failed.unitId);
      for (const ruleId of failed.ruleIds) {
        unknowns.push({
          file: unit?.file ?? "",
          line: unit?.line ?? 0,
          reason: failed.category,
          ruleId,
          unitId: failed.unitId,
        });
      }
    }
  } else {
    // Dry run, or everything came from cache: cached answers still count.
    answers = new Map(prepared.map((p) => [p.job.unit.id, p.cached]));
    usage.cached = prepared.reduce(
      (s, p) => s + Object.keys(p.cached).length,
      0
    );
  }
  return {
    answers,
    estimatedRequests: pending.reduce(
      (s, p) => s + chunkQuestions(p).length,
      0
    ),
    estimatedTokens: pending.reduce((s, p) => s + p.estimatedTokens, 0),
    jobs,
    mechanical: plan.mechanical,
    pending,
    unknowns,
    usage,
  };
};
