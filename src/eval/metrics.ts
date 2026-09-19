// `slop-cop eval`: run each rule over its labelled items and report.

import path from "node:path";

import { resolveTypography } from "../extract/tailwind.js";
import { makeRecorder } from "../lib/record.js";
import { binaryMetrics, calibrationTable } from "../lib/stats.js";
import { costUsd } from "../lib/tokens.js";
import { chunkQuestions, prepareRequests, runRequests } from "../map/batch.js";
import { AnswerCache } from "../map/cache.js";
import { DEFAULT_MODEL, makeFetchEvaluate } from "../map/jev.js";
import { planRequests } from "../map/plan.js";
import { band } from "../reduce/bands.js";
import { loadRules, resolveRulesDir } from "../rules/load.js";
import type { Config, CorpusItem, Evaluate, Rule, Unit } from "../types.js";
import { loadCorpus, resolveCorpusDir, unitFromItem } from "./corpus.js";

export interface EvalOptions {
  corpusDir?: string;
  rulesDir?: string;
  only?: string[];
  split?: "dev" | "holdout" | "all";
  includeWeak?: boolean;
  dryRun?: boolean;
  noCache?: boolean;
  resultsDir?: string;
  model?: string;
  apiKey?: string;
}

export interface EvalContext {
  evaluate?: Evaluate;
}

export interface RuleEval {
  ruleId: string;
  n: number;
  metrics: ReturnType<typeof binaryMetrics>;
  reviewRate: number;
  calibration: ReturnType<typeof calibrationTable>;
  /** Per item: label, probability. */
  pairs: { id: string; label: boolean; probability: number }[];
}

export interface EvalResult {
  report: string;
  exitCode: number;
  rules: RuleEval[];
  usage: {
    requests: number;
    cached: number;
    inputTokens: number;
    costUsd: number;
    errors: number;
  };
}

const corpusConfig = (): Config => ({
  components: { skip: [], unwrap: [] },
  docTypes: [],
  exclude: [],
  root: process.cwd(),
  smartQuotesAtBuild: false,
  tailwind: { theme: {} },
});

// Score every labelled item for every rule it is labelled with. Returns per
// (item, rule) probability, using mechanical=1/0 for mechanical rules.
export const scoreItems = async (
  items: CorpusItem[],
  rules: Rule[],
  options: {
    evaluate?: Evaluate;
    cache: AnswerCache;
    model: string;
    dryRun?: boolean;
    recorder?: ReturnType<typeof makeRecorder>;
  }
): Promise<{
  probabilities: Map<string, Record<string, number>>;
  usage: EvalResult["usage"];
  pendingRequests: number;
}> => {
  const config = corpusConfig();
  const units: Unit[] = items.map((item) => {
    const unit = unitFromItem(item);
    if (unit.classes && unit.classes.length > 0) {
      unit.typography = resolveTypography(unit.classes, config);
    }
    return unit;
  });
  // Restrict each unit to the rules it is labelled for, by giving the planner
  // rules whose scope always matches and filtering after.
  const plan = planRequests(units, rules, config);
  const probabilities = new Map<string, Record<string, number>>();
  for (const item of items) {
    probabilities.set(item.id, {});
  }
  for (const f of plan.mechanical) {
    probabilities.get(f.unitId)![f.ruleId] = 1;
  }
  // Mechanical rules that did not fire score 0 for labelled items.
  const itemById = new Map(items.map((i) => [i.id, i]));
  for (const rule of rules.filter((r) => r.tier === "mechanical")) {
    for (const item of items) {
      if (
        rule.id in item.labels &&
        probabilities.get(item.id)![rule.id] === undefined
      ) {
        probabilities.get(item.id)![rule.id] = 0;
      }
    }
  }
  const jobs = plan.jobs
    .map((job) => ({
      rules: job.rules.filter(
        ({ rule }) => rule.id in (itemById.get(job.unit.id)?.labels ?? {})
      ),
      unit: job.unit,
    }))
    .filter((job) => job.rules.length > 0);
  // `both` rules whose candidate did not fire: probability 0.
  for (const rule of rules.filter((r) => r.tier === "both")) {
    for (const item of items) {
      const scheduled = jobs.some(
        (j) =>
          j.unit.id === item.id && j.rules.some((r) => r.rule.id === rule.id)
      );
      if (
        rule.id in item.labels &&
        !scheduled &&
        probabilities.get(item.id)![rule.id] === undefined
      ) {
        probabilities.get(item.id)![rule.id] = 0;
      }
    }
  }
  const prepared = prepareRequests(jobs, options.cache, options.model);
  const pending = prepared.filter((p) => Object.keys(p.questions).length > 0);
  const pendingRequests = pending.reduce(
    (s, p) => s + chunkQuestions(p).length,
    0
  );
  const usage = {
    cached: 0,
    costUsd: 0,
    errors: 0,
    inputTokens: 0,
    requests: 0,
  };
  if (options.dryRun || !options.evaluate) {
    for (const p of prepared) {
      Object.assign(probabilities.get(p.job.unit.id)!, p.cached);
      usage.cached += Object.keys(p.cached).length;
    }
    return { pendingRequests, probabilities, usage };
  }
  const outcome = await runRequests(prepared, {
    cache: options.cache,
    evaluate: options.evaluate,
    model: options.model,
    onProgress: (m) => process.stderr.write(m),
    recorder: options.recorder,
  });
  process.stderr.write("\n");
  for (const [unitId, answers] of outcome.answers) {
    Object.assign(probabilities.get(unitId)!, answers);
  }
  usage.requests = outcome.requests;
  usage.cached = outcome.cached;
  usage.inputTokens = outcome.inputTokens;
  usage.costUsd = costUsd(outcome.inputTokens);
  usage.errors = outcome.errors;
  return { pendingRequests, probabilities, usage };
};

export const evaluateRules = (
  items: CorpusItem[],
  rules: Rule[],
  probabilities: Map<string, Record<string, number>>
): RuleEval[] =>
  rules.map((rule) => {
    const pairs: RuleEval["pairs"] = [];
    let review = 0;
    for (const item of items) {
      if (!(rule.id in item.labels)) {
        continue;
      }
      const p = probabilities.get(item.id)?.[rule.id];
      if (p === undefined) {
        continue;
      }
      pairs.push({ id: item.id, label: item.labels[rule.id], probability: p });
      if (band(p, rule.thresholds) === "review") {
        review += 1;
      }
    }
    const metrics = binaryMetrics(
      pairs.map((p) => ({
        label: p.label,
        predicted: p.probability >= rule.thresholds.act,
      }))
    );
    return {
      calibration: calibrationTable(pairs),
      metrics,
      n: pairs.length,
      pairs,
      reviewRate: pairs.length === 0 ? 0 : review / pairs.length,
      ruleId: rule.id,
    };
  });

const pct = (v: number): string => `${(v * 100).toFixed(0)}%`;

export const renderEval = (
  evals: RuleEval[],
  usage: EvalResult["usage"],
  dryRun: boolean,
  pending: number
): string => {
  const out: string[] = [];
  for (const e of evals) {
    if (e.n === 0) {
      out.push(`${e.ruleId}: no labelled items`);
      continue;
    }
    const m = e.metrics;
    out.push(
      `${e.ruleId}: n=${e.n} precision ${pct(m.precision)} [${pct(m.precisionCI[0])}, ${pct(m.precisionCI[1])}] recall ${pct(m.recall)} [${pct(m.recallCI[0])}, ${pct(m.recallCI[1])}] f1 ${m.f1.toFixed(2)} review ${pct(e.reviewRate)} (tp ${m.tp} fp ${m.fp} fn ${m.fn} tn ${m.tn})`
    );
    const rows = e.calibration.filter((b) => b.n > 0);
    if (rows.length > 0) {
      out.push("  bucket      n  observed  mean p");
      for (const b of rows) {
        out.push(
          `  ${b.lo.toFixed(1)}-${b.hi.toFixed(1)}  ${String(b.n).padStart(5)}  ${pct(b.positives / b.n).padStart(8)}  ${b.meanP.toFixed(2).padStart(6)}`
        );
      }
    }
  }
  if (dryRun) {
    out.push(
      `Dry run: ${pending} request${pending === 1 ? "" : "s"} would be sent; ${usage.cached} answers served from cache. No calls were made.`
    );
  } else {
    out.push(
      `Jev: ${usage.requests} requests, ${usage.cached} cached, ${usage.inputTokens} input tokens, $${usage.costUsd.toFixed(4)}${usage.errors ? `, ${usage.errors} errors` : ""}`
    );
  }
  return `${out.join("\n")}\n`;
};

export const runEval = async (
  options: EvalOptions,
  ctx: EvalContext = {}
): Promise<EvalResult> => {
  const rulesDir = resolveRulesDir(options.rulesDir);
  const rules = loadRules(rulesDir, { allowDraft: false, only: options.only });
  const corpusDir = resolveCorpusDir(options.corpusDir);
  let items = loadCorpus(corpusDir, rules, {
    includeWeak: options.includeWeak,
  });
  if (options.split && options.split !== "all") {
    items = items.filter((i) => i.split === options.split);
  }
  const model = options.model ?? DEFAULT_MODEL;
  const resultsDir = options.resultsDir ?? path.join(process.cwd(), "results");
  const cache = new AnswerCache(
    path.join(resultsDir, "cache"),
    !options.noCache
  );
  let evaluate = ctx.evaluate;
  if (!evaluate && !options.dryRun) {
    const apiKey = options.apiKey ?? process.env.TYPESAFE_API_KEY;
    if (!apiKey) {
      throw new Error("Set TYPESAFE_API_KEY or pass --dry-run.");
    }
    evaluate = makeFetchEvaluate({ apiKey });
  }
  const recorder = options.dryRun
    ? undefined
    : makeRecorder("eval", { resultsDir });
  const { probabilities, usage, pendingRequests } = await scoreItems(
    items,
    rules,
    {
      cache,
      dryRun: options.dryRun,
      evaluate,
      model,
      recorder,
    }
  );
  const evals = evaluateRules(items, rules, probabilities);
  recorder?.summary({
    rules: evals.map((e) => ({
      id: e.ruleId,
      n: e.n,
      precision: e.metrics.precision,
      recall: e.metrics.recall,
    })),
    usage,
  });
  return {
    exitCode: usage.errors > 0 ? 2 : 0,
    report: renderEval(evals, usage, Boolean(options.dryRun), pendingRequests),
    rules: evals,
    usage,
  };
};
