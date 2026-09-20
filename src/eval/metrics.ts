// `taste-lint eval`: run each rule over its labelled items and report.

import path from "node:path";

import { resolveTypography } from "../extract/tailwind.js";
import { defaultResultsDir } from "../lib/config.js";
import { InputError } from "../lib/errors.js";
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
import { corpusCoverage, pairedOutcomes } from "./coverage.js";

export interface EvalOptions {
  check?: boolean;
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
  skipped?: number;
  metrics: BinaryMetrics;
  reviewRate: number;
  reviewMetrics?: BinaryMetrics;
  contrast?: {
    families: number;
    passed: number;
    failed: number;
    unresolved: number;
  };
  calibration: ReturnType<typeof calibrationTable>;
  pairs: { id: string; label: boolean; probability: number }[];
}

export interface EvalResult {
  referenceCoverage?: ReturnType<typeof corpusCoverage>;
  labelSources?: Record<string, number>;
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
  skipped: { itemId: string; ruleId: string; reason: string }[];
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

    recorder: options.recorder,
  });

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
        !scheduled.has(key) &&
        judgement.negatives.get(item.id)?.has(rule.id)
      ) {
        probabilities.get(item.id)![rule.id] = 0;
      }
    }
  }
  return {
    pendingRequests: judgement.estimatedRequests,
    probabilities,
    skipped: items.flatMap((item) =>
      Object.entries(judgement.skipped.get(item.id) ?? {})
        .filter(([id]) => id in item.labels)
        .map(([ruleId, reason]) => ({ itemId: item.id, reason, ruleId }))
    ),
    unknowns,
    usage: judgement.usage,
  };
};

export const evaluateRules = (
  items: CorpusItem[],
  rules: Rule[],
  probabilities: Map<string, Record<string, number>>,
  unknowns: { itemId: string; ruleId: string }[] = [],
  skipped: { itemId: string; ruleId: string }[] = []
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
      contrast: pairedOutcomes(items, rule, probabilities),
      metrics,
      n: pairs.length,
      pairs,
      reviewMetrics: binaryMetrics(
        pairs.map((p) => ({
          label: p.label,
          predicted: p.probability >= rule.thresholds.review,
        }))
      ),
      reviewRate: pairs.length === 0 ? 0 : review / pairs.length,
      ruleId: rule.id,
      skipped: skipped.filter((s) => s.ruleId === rule.id).length,
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
      out.push(
        `${e.ruleId}: no evaluated labelled items; ${e.skipped ?? 0} skipped, ${e.unknown} unknown`
      );
      if (e.contrast?.families) {
        out.push(
          `  Paired families: ${e.contrast.unresolved}/${e.contrast.families} unresolved.`
        );
      }
      continue;
    }
    const m = e.metrics;
    const precision =
      m.tp + m.fp === 0
        ? "precision n/a (no positive predictions)"
        : `precision ${pct(m.precision)} [${pct(m.precisionCI[0])}, ${pct(m.precisionCI[1])}]`;
    const recall =
      m.tp + m.fn === 0
        ? "recall n/a (no positive labels)"
        : `recall ${pct(m.recall)} [${pct(m.recallCI[0])}, ${pct(m.recallCI[1])}]`;
    const unknown = e.unknown > 0 ? ` unknown ${e.unknown}` : "";
    out.push(
      `${e.ruleId}: n=${e.n} skipped ${e.skipped ?? 0}${unknown} ${precision} ${recall} f1 ${m.f1.toFixed(2)} review ${pct(e.reviewRate)} (tp ${m.tp} fp ${m.fp} fn ${m.fn} tn ${m.tn})`
    );
    if (e.reviewMetrics) {
      const r = e.reviewMetrics;
      out.push(
        `  Visible findings (review threshold): tp ${r.tp} fp ${r.fp} fn ${r.fn} tn ${r.tn}`
      );
    }
    if (e.contrast?.families) {
      out.push(
        `  Paired families: ${e.contrast.passed}/${e.contrast.families} passed; ${e.contrast.failed} failed; ${e.contrast.unresolved} unresolved (weak flagged and acceptable preserved).`
      );
    }
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
  if (options.check && options.dryRun) {
    throw new InputError(
      "INVALID_ARGUMENT",
      "--check requires evaluated judgments; remove --dry-run."
    );
  }
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
  if (!items.length) {
    throw new Error("No corpus items in the selected split.");
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
  const { probabilities, unknowns, skipped, usage, pendingRequests } =
    await scoreItems(items, rules, {
      cache,
      dryRun: options.dryRun,
      evaluate,
      model,
      recorder,
    });
  const labelSources: Record<string, number> = {};
  for (const item of items) {
    labelSources[item.labelSource] = (labelSources[item.labelSource] ?? 0) + 1;
  }
  const evals = evaluateRules(items, rules, probabilities, unknowns, skipped);
  recorder?.summary({
    rules: evals.map((e) => ({
      id: e.ruleId,
      n: e.n,
      precision: e.metrics.precision,
      recall: e.metrics.recall,
    })),
    usage,
  });
  const incomplete = evals.some(
    (e) => e.n === 0 || e.unknown > 0 || (e.skipped ?? 0) > 0
  );
  const mismatch = evals.some(
    (e) => (e.reviewMetrics?.fp ?? 0) + (e.reviewMetrics?.fn ?? 0) > 0
  );
  const exitCode =
    usage.errors > 0 || (options.check && incomplete)
      ? 2
      : options.check && mismatch
        ? 1
        : 0;
  return {
    exitCode,
    labelSources,
    referenceCoverage: corpusCoverage(items, rules),
    report:
      (options.check
        ? `Regression check: ${exitCode === 0 ? "PASS" : exitCode === 1 ? "FAIL (reference disagreement)" : "INCOMPLETE (missing evaluations)"}. Uses the review threshold.\n`
        : "") +
      (labelSources.ai
        ? `AI-labeled reference: ${labelSources.ai} items. Metrics measure agreement with AI labels, not human judgments.\n`
        : "") +
      renderEval(evals, usage, Boolean(options.dryRun), pendingRequests),
    rules: evals,
    usage,
  };
};
