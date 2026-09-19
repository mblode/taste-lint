// `slop-cop tune`: pick the lowest act threshold per rule whose act-band
// precision lower bound clears the floor. `tune ab`: McNemar between two
// question wordings over the same dev items.

import fs from "node:fs";
import path from "node:path";

import { parse } from "yaml";

import { mcnemar, wilson } from "../lib/stats.js";
import { AnswerCache } from "../map/cache.js";
import { DEFAULT_MODEL, makeFetchEvaluate } from "../map/jev.js";
import { loadRules, resolveRulesDir } from "../rules/load.js";
import { validateRule } from "../rules/validate.js";
import type { Evaluate, Rule, Tuning } from "../types.js";
import { loadCorpus, resolveCorpusDir } from "./corpus.js";
import { evaluateRules, scoreItems } from "./metrics.js";
import type { RuleEval } from "./metrics.js";

export interface TuneOptions {
  corpusDir?: string;
  rulesDir?: string;
  only?: string[];
  floor?: number;
  write?: boolean;
  resultsDir?: string;
  model?: string;
  apiKey?: string;
  minItems?: number;
}

export interface TuneContext {
  evaluate?: Evaluate;
}

export interface TuneDecision {
  ruleId: string;
  n: number;
  current: number;
  chosen: number | null;
  precisionLower: number;
  recall: number;
  action: "keep" | "raise" | "lower" | "demote" | "insufficient";
}

const THRESHOLDS = Array.from(
  { length: 10 },
  (_, i) => Math.round((0.5 + i * 0.05) * 100) / 100
);

export const decideThreshold = (
  pairs: { label: boolean; probability: number }[],
  currentAct: number,
  floor: number,
  minItems: number
): Omit<TuneDecision, "ruleId"> => {
  const n = pairs.length;
  if (n < minItems) {
    return {
      action: "insufficient",
      chosen: null,
      current: currentAct,
      n,
      precisionLower: 0,
      recall: 0,
    };
  }
  for (const t of THRESHOLDS) {
    const predictedPositive = pairs.filter((p) => p.probability >= t);
    const tp = predictedPositive.filter((p) => p.label).length;
    const positives = pairs.filter((p) => p.label).length;
    const [lower] = wilson(tp, predictedPositive.length);
    if (predictedPositive.length > 0 && lower >= floor) {
      const recall = positives === 0 ? 0 : tp / positives;
      const action =
        t === currentAct ? "keep" : t > currentAct ? "raise" : "lower";
      return {
        action,
        chosen: t,
        current: currentAct,
        n,
        precisionLower: lower,
        recall,
      };
    }
  }
  return {
    action: "demote",
    chosen: null,
    current: currentAct,
    n,
    precisionLower: 0,
    recall: 0,
  };
};

const resolveEvaluate = (
  options: { apiKey?: string },
  ctx: TuneContext
): Evaluate => {
  if (ctx.evaluate) {
    return ctx.evaluate;
  }
  const apiKey = options.apiKey ?? process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    throw new Error("Set TYPESAFE_API_KEY to tune.");
  }
  return makeFetchEvaluate({ apiKey });
};

export const runTune = async (
  options: TuneOptions,
  ctx: TuneContext = {}
): Promise<{ report: string; exitCode: number; decisions: TuneDecision[] }> => {
  const rulesDir = resolveRulesDir(options.rulesDir);
  const rules = loadRules(rulesDir, {
    allowDraft: false,
    only: options.only,
  }).filter((r) => r.tier !== "mechanical");
  const items = loadCorpus(resolveCorpusDir(options.corpusDir), rules).filter(
    (i) => i.split === "dev"
  );
  const model = options.model ?? DEFAULT_MODEL;
  const resultsDir = options.resultsDir ?? path.join(process.cwd(), "results");
  const cache = new AnswerCache(path.join(resultsDir, "cache"));
  const evaluate = resolveEvaluate(options, ctx);
  const { probabilities } = await scoreItems(items, rules, {
    cache,
    evaluate,
    model,
  });
  const evals = evaluateRules(items, rules, probabilities);
  const floor = options.floor ?? 0.8;
  const minItems = options.minItems ?? 10;
  const decisions: TuneDecision[] = evals.map((e) => {
    const rule = rules.find((r) => r.id === e.ruleId) as Rule;
    return {
      ruleId: e.ruleId,
      ...decideThreshold(e.pairs, rule.thresholds.act, floor, minItems),
    };
  });
  const lines = decisions.map((d) => {
    switch (d.action) {
      case "insufficient": {
        return `${d.ruleId}: insufficient data (${d.n} labelled dev items, need ${minItems})`;
      }
      case "demote": {
        return `${d.ruleId}: no threshold clears precision floor ${floor} on ${d.n} items; demote to review-only`;
      }
      default: {
        return `${d.ruleId}: act ${d.current} -> ${d.chosen} (${d.action}); precision lower bound ${(d.precisionLower * 100).toFixed(0)}%, recall ${(d.recall * 100).toFixed(0)}%, n=${d.n}`;
      }
    }
  });
  if (options.write) {
    const file = path.join(rulesDir, "tuning.json");
    const existing: Tuning = fs.existsSync(file)
      ? (JSON.parse(fs.readFileSync(file, "utf-8")) as Tuning)
      : {};
    const ts = new Date().toISOString();
    for (const d of decisions) {
      if (d.action === "insufficient") {
        continue;
      }
      existing[d.ruleId] =
        d.action === "demote"
          ? { n: d.n, status: "review-only", ts }
          : {
              act: d.chosen as number,
              n: d.n,
              precisionLower: d.precisionLower,
              status: "active",
              ts,
            };
    }
    fs.writeFileSync(file, `${JSON.stringify(existing, null, 2)}\n`);
    lines.push(`Wrote ${file}`);
  } else {
    lines.push("Dry decision; pass --write to update data/rules/tuning.json");
  }
  return { decisions, exitCode: 0, report: `${lines.join("\n")}\n` };
};

export interface TuneAbOptions {
  ruleId: string;
  variantFile: string;
  corpusDir?: string;
  rulesDir?: string;
  resultsDir?: string;
  model?: string;
  apiKey?: string;
}

export const runTuneAb = async (
  options: TuneAbOptions,
  ctx: TuneContext = {}
): Promise<{ report: string; exitCode: number }> => {
  const rulesDir = resolveRulesDir(options.rulesDir);
  const [rule] = loadRules(rulesDir, {
    allowDraft: true,
    only: [options.ruleId],
  });
  if (!rule || rule.tier === "mechanical") {
    throw new Error(`Rule ${options.ruleId} is not a Jev-backed rule`);
  }
  const variantRaw = parse(
    fs.readFileSync(options.variantFile, "utf-8")
  ) as Record<string, unknown>;
  const merged = { ...ruleToRaw(rule), ...variantRaw, id: rule.id };
  const variant = validateRule(merged, options.variantFile, rule.id);
  const items = loadCorpus(resolveCorpusDir(options.corpusDir), [rule]).filter(
    (i) => i.split === "dev" && rule.id in i.labels
  );
  const model = options.model ?? DEFAULT_MODEL;
  const resultsDir = options.resultsDir ?? path.join(process.cwd(), "results");
  const cache = new AnswerCache(path.join(resultsDir, "cache"));
  const evaluate = resolveEvaluate(options, ctx);
  const a = await scoreItems(items, [rule], { cache, evaluate, model });
  const b = await scoreItems(items, [variant], { cache, evaluate, model });
  const [ea] = evaluateRules(items, [rule], a.probabilities);
  const [eb] = evaluateRules(items, [variant], b.probabilities);
  const test = mcnemar(correctVector(ea, rule), correctVector(eb, variant));
  const report = [
    `${rule.id} on ${items.length} dev items`,
    `A (current): precision ${(ea.metrics.precision * 100).toFixed(0)}% recall ${(ea.metrics.recall * 100).toFixed(0)}%`,
    `B (variant): precision ${(eb.metrics.precision * 100).toFixed(0)}% recall ${(eb.metrics.recall * 100).toFixed(0)}%`,
    `McNemar: n01=${test.n01} (A right, B wrong) n10=${test.n10} (A wrong, B right) discordant=${test.discordant} p=${test.pValue.toFixed(3)}`,
    test.discordant < 10
      ? "Fewer than 10 discordant pairs: underpowered, add labelled items before deciding."
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  return { exitCode: 0, report: `${report}\n` };
};

const correctVector = (e: RuleEval, r: Rule): boolean[] =>
  e.pairs.map((p) => p.probability >= r.thresholds.act === p.label);

const ruleToRaw = (rule: Rule): Record<string, unknown> => {
  const { file, ...rest } = rule;
  void file;
  return rest as unknown as Record<string, unknown>;
};
