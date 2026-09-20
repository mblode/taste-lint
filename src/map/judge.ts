// The one stage lint and eval share: plan which rules apply, run the
// mechanical checks, answer the Jev questions (from cache, or live when an
// evaluate is supplied and this is not a dry run), and report abstentions.

import { costUsd, estimateTokens, charsPerTokenFor } from "../lib/tokens.js";
import type {
  Config,
  Coverage,
  Progress,
  Evaluate,
  Finding,
  RecorderHandle,
  Rule,
  Unit,
  Unknown,
  Usage,
} from "../types.js";
import {
  cachedAnswers,
  prepareRequests,
  requestWork,
  runRequests,
} from "./batch.js";
import type { PreparedRequest } from "./batch.js";
import type { AnswerCache } from "./cache.js";
import { planRequests } from "./plan.js";
import type { JevJob, Plan } from "./plan.js";

export interface JudgeOptions {
  config: Config;
  model: string;
  cache: AnswerCache;
  /** Absent means answers come from the cache only (a dry run). */
  evaluate?: Evaluate;
  recorder?: RecorderHandle;
  onProgress?: (progress: Progress) => void;
  /** Narrow or drop a job before it is prepared (eval keeps labelled rules only). */
  jobFilter?: (job: JevJob) => JevJob | null;
}

export interface Judgement {
  coverage: Coverage;
  negatives: Plan["negatives"];
  skipped: Plan["skipped"];
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

export const prepareJudgement = (
  units: Unit[],
  rules: Rule[],
  options: JudgeOptions
) => {
  const plan = planRequests(units, rules, options.config);
  let jobs = plan.jobs;
  if (options.jobFilter) {
    jobs = jobs
      .map((job) => options.jobFilter?.(job) ?? null)
      .filter((job): job is JevJob => job !== null);
  }
  const prepared = prepareRequests(jobs, options.cache, options.model);
  const pending = prepared.filter((p) => Object.keys(p.questions).length > 0);
  return {
    jobs,
    pending,
    plan,
    prepared,
    rules,
    units,
    work: requestWork(prepared),
  };
};

export const executeJudgement = async (
  preview: ReturnType<typeof prepareJudgement>,
  options: JudgeOptions
): Promise<Judgement> => {
  const { plan, jobs, prepared, pending, units, rules } = preview;
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
      work: preview.work,
    });
    answers = outcome.answers;
    usage.requests = outcome.requests;
    usage.attempts = outcome.attempts;
    usage.sharedAnswers = outcome.sharedAnswers;
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
    answers = cachedAnswers(prepared);
    usage.cached = prepared.reduce(
      (s, p) => s + Object.keys(p.cached).length,
      0
    );
  }
  const coverage: Coverage = { byCategory: {}, byRule: {} };
  const categoryUnits = new Map<string, Set<string>>();
  for (const rule of rules) {
    const eligible = units.filter((u) => plan.eligible.get(u.id)?.has(rule.id));
    const negative = eligible.filter((u) =>
      plan.negatives.get(u.id)?.has(rule.id)
    ).length;
    const unknown = unknowns.filter((u) => u.ruleId === rule.id).length;
    const answered =
      eligible.filter((u) => answers.get(u.id)?.[rule.id] !== undefined)
        .length + plan.mechanical.filter((f) => f.ruleId === rule.id).length;
    coverage.byRule[rule.id] = {
      answered,
      eligible: eligible.length,
      negative,
      pending: Math.max(0, eligible.length - negative - unknown - answered),
      skipped: units.length - eligible.length,
      unknown,
    };
    const set = categoryUnits.get(rule.categoryId) ?? new Set<string>();
    for (const unit of eligible) {
      set.add(unit.id);
    }
    categoryUnits.set(rule.categoryId, set);
    const category = coverage.byCategory[rule.categoryId] ?? {
      eligiblePairs: 0,
      eligibleUnits: 0,
    };
    category.eligiblePairs += eligible.length;
    category.eligibleUnits = set.size;
    coverage.byCategory[rule.categoryId] = category;
  }
  const work = preview.work;
  return {
    answers,
    coverage,
    estimatedRequests: work.length,
    estimatedTokens: work.reduce(
      (sum, w) =>
        sum +
        estimateTokens(
          w.prepared.state,
          charsPerTokenFor(w.prepared.job.unit.kind)
        ) +
        Object.values(w.questions).reduce(
          (n, q) => n + estimateTokens(JSON.stringify(q)),
          0
        ),
      0
    ),
    jobs,
    mechanical: plan.mechanical,
    negatives: plan.negatives,
    pending,
    skipped: plan.skipped,
    unknowns,
    usage,
  };
};

export const judge = (
  units: Unit[],
  rules: Rule[],
  options: JudgeOptions
): Promise<Judgement> =>
  executeJudgement(prepareJudgement(units, rules, options), options);
