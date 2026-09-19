// `slop-cop eval`: run each rule over its labelled items and report.

import path from "node:path";

import { resolveTypography } from "../extract/tailwind.js";
import { defaultResultsDir } from "../lib/config.js";
import { makeRecorder } from "../lib/record.js";
import { binaryMetrics, calibrationTable } from "../lib/stats.js";
import type { BinaryMetrics } from "../lib/stats.js";
import { AnswerCache } from "../map/cache.js";
import { DEFAULT_MODEL, evaluateFromEnv, KEY_HINT } from "../map/jev.js";
import { judge } from "../map/judge.js";
import type { JevJob } from "../map/plan.js";
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
  /** Labelled items the rule could not judge (unresolved value, failed request). */
  unknown: number;
  metrics: BinaryMetrics;
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
  /** (item id, rule id) pairs with no probability and a reason. */
  unknowns: { itemId: string; ruleId: string; reason: string }[];
  usage: EvalResult["usage"];
  pendingRequests: number;
}> => {
  const config = corpusConfig();
  const itemById = new Map(items.map((i) => [i.id, i]));
  const units: Unit[] = items.map((item) => {
    const unit = unitFromItem(item);
    if (unit.classes && unit.classes.length > 0) {
      unit.typography = resolveTypography(unit.classes, config);
    }
    return unit;
  });
  // Each item is judged only for the rules it is labelled for.
  const labelledFor = (job: JevJob): JevJob | null => {
    const labels = itemById.get(job.unit.id)?.labels ?? {};
    const kept = job.rules.filter(({ rule }) => rule.id in labels);
    return kept.length > 0 ? { rules: kept, unit: job.unit } : null;
  };
  const judgement = await judge(units, rules, {
    cache: options.cache,
    config,
    evaluate: options.dryRun ? undefined : options.evaluate,
    jobFilter: labelledFor,
    model: options.model,
    onProgress: (m) => process.stderr.write(m),
    recorder: options.recorder,
  });
  if (!options.dryRun && options.evaluate) {
    process.stderr.write("\n");
  }
  const probabilities = new Map<string, Record<string, number>>();
  for (const item of items) {
    probabilities.set(item.id, {});
  }
  for (const f of judgement.mechanical) {
    probabilities.get(f.unitId)![f.ruleId] = 1;
  }
  for (const [unitId, answers] of judgement.answers) {
    Object.assign(probabilities.get(unitId)!, answers);
  }
  const unknowns = judgement.unknowns
    .filter((u) => u.ruleId in (itemById.get(u.unitId)?.labels ?? {}))
    .map((u) => ({ itemId: u.unitId, reason: u.reason, ruleId: u.ruleId }));
  const abstained = new Set(
    unknowns.map((u) => `${u.itemId}\u0000${u.ruleId}`)
  );
  // A labelled rule with no probability after judging did not fire (a
  // mechanical rule, or a `both` rule whose candidate filter passed), so it
  // scores 0 unless it abstained or is still pending.
  const scheduled = new Set(
    judgement.pending.flatMap((p) =>
      Object.keys(p.questions).map(
        (ruleId) => `${p.job.unit.id}\u0000${ruleId}`
      )
    )
  );
  for (const item of items) {
    for (const rule of rules) {
      const key = `${item.id}\u0000${rule.id}`;
      if (
        rule.id in item.labels &&
        rule.tier !== "jev" &&
        probabilities.get(item.id)![rule.id] === undefined &&
        !abstained.has(key) &&
        !scheduled.has(key)
      ) {
        probabilities.get(item.id)![rule.id] = 0;
      }
    }
  }
  return {
    pendingRequests: judgement.estimatedRequests,
    probabilities,
    unknowns,
    usage: judgement.usage,
  };
};

export const evaluateRules = (
  items: CorpusItem[],
  rules: Rule[],
  probabilities: Map<string, Record<string, number>>,
  unknowns: { itemId: string; ruleId: string }[] = []
): RuleEval[] =>
  rules.map((rule) => {
    const pairs: RuleEval["pairs"] = [];
    let review = 0;
    let unknown = 0;
    for (const item of items) {
      if (!(rule.id in item.labels)) {
        continue;
      }
      const p = probabilities.get(item.id)?.[rule.id];
      if (p === undefined) {
        if (
          unknowns.some((u) => u.itemId === item.id && u.ruleId === rule.id)
        ) {
          unknown += 1;
        }
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
      unknown,
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
    const precision =
      m.tp + m.fp === 0
        ? "precision n/a (no positive predictions)"
        : `precision ${pct(m.precision)} [${pct(m.precisionCI[0])}, ${pct(m.precisionCI[1])}]`;
    const unknown = e.unknown > 0 ? ` unknown ${e.unknown}` : "";
    out.push(
      `${e.ruleId}: n=${e.n}${unknown} ${precision} recall ${pct(m.recall)} [${pct(m.recallCI[0])}, ${pct(m.recallCI[1])}] f1 ${m.f1.toFixed(2)} review ${pct(e.reviewRate)} (tp ${m.tp} fp ${m.fp} fn ${m.fn} tn ${m.tn})`
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
  const knownRuleIds = new Set(
    loadRules(rulesDir, { allowDraft: true }).map((r) => r.id)
  );
  const corpusDir = resolveCorpusDir(options.corpusDir);
  let items = loadCorpus(corpusDir, rules, {
    includeWeak: options.includeWeak,
    knownRuleIds,
  });
  if (options.split && options.split !== "all") {
    items = items.filter((i) => i.split === options.split);
  }
  const model = options.model ?? DEFAULT_MODEL;
  const resultsDir = options.resultsDir ?? defaultResultsDir();
  const cache = new AnswerCache(
    path.join(resultsDir, "cache"),
    !options.noCache
  );
  let evaluate = ctx.evaluate;
  if (!evaluate && !options.dryRun) {
    evaluate = evaluateFromEnv(options.apiKey);
    if (!evaluate) {
      throw new Error(`${KEY_HINT} Or pass --dry-run.`);
    }
  }
  const recorder = options.dryRun
    ? undefined
    : makeRecorder("eval", { resultsDir });
  const { probabilities, unknowns, usage, pendingRequests } = await scoreItems(
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
  const evals = evaluateRules(items, rules, probabilities, unknowns);
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
