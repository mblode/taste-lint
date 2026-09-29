// Grader consistency diagnostic: ask Jev the same question over the same
// state twice and report how often the act-band verdict flips. Run with
// every baseline (docs/eval.mdx). The answer cache must not shortcut this;
// both passes construct their own disabled cache so every question is a
// live call, never a replay of the first pass's answer.

import path from "node:path";

import { wilson } from "../lib/stats.js";
import { AnswerCache } from "../map/cache.js";
import { DEFAULT_MODEL } from "../map/jev.js";
import type { CorpusItem, Evaluate, Rule } from "../types.js";
import { scoreItems } from "./metrics.js";

export interface ConsistencyOptions {
  model?: string;
  resultsDir: string;
  sampleSize?: number;
}

export interface ConsistencyFlip {
  itemId: string;
  ruleId: string;
  a: number;
  b: number;
}

export interface ConsistencyResult {
  n: number;
  flips: ConsistencyFlip[];
  flipRate: number;
  flipRateCI: [number, number];
  errors: number;
}

const DEFAULT_SAMPLE = 30;

export const runConsistency = async (
  items: CorpusItem[],
  rules: Rule[],
  evaluate: Evaluate,
  options: ConsistencyOptions
): Promise<ConsistencyResult> => {
  const sampleSize = options.sampleSize ?? DEFAULT_SAMPLE;
  const sample = items.slice(0, sampleSize);
  const model = options.model ?? DEFAULT_MODEL;
  // Two independent, disabled caches: a hit here would replay the first
  // pass's answer instead of asking again, defeating the whole check.
  const cacheA = new AnswerCache(path.join(options.resultsDir, "cache"), false);
  const cacheB = new AnswerCache(path.join(options.resultsDir, "cache"), false);
  const [a, b] = await Promise.all([
    scoreItems(sample, rules, { cache: cacheA, evaluate, model }),
    scoreItems(sample, rules, { cache: cacheB, evaluate, model }),
  ]);
  const flips: ConsistencyFlip[] = [];
  let n = 0;
  for (const item of sample) {
    for (const rule of rules) {
      if (!(rule.id in item.labels)) {
        continue;
      }
      const pa = a.probabilities.get(item.id)?.[rule.id];
      const pb = b.probabilities.get(item.id)?.[rule.id];
      if (pa === undefined || pb === undefined) {
        continue;
      }
      n += 1;
      const bandA = pa >= rule.thresholds.act;
      const bandB = pb >= rule.thresholds.act;
      if (bandA !== bandB) {
        flips.push({ a: pa, b: pb, itemId: item.id, ruleId: rule.id });
      }
    }
  }
  return {
    errors: a.usage.errors + b.usage.errors,
    flipRate: n === 0 ? 0 : flips.length / n,
    flipRateCI: wilson(flips.length, n),
    flips,
    n,
  };
};

const pct = (v: number): string => `${(v * 100).toFixed(1)}%`;

export const renderConsistency = (result: ConsistencyResult): string => {
  const lines = [
    `Grader consistency: ${result.n} paired (item, rule) judgements, asked twice with the cache bypassed.`,
    `Flip rate ${pct(result.flipRate)} [${pct(result.flipRateCI[0])}, ${pct(result.flipRateCI[1])}] (${result.flips.length} flips)${result.errors ? `; ${result.errors} infrastructure errors excluded` : ""}`,
  ];
  for (const flip of result.flips.slice(0, 10)) {
    lines.push(
      `  ${flip.ruleId} ${flip.itemId}: ${flip.a.toFixed(2)} vs ${flip.b.toFixed(2)}`
    );
  }
  if (result.flips.length > 10) {
    lines.push(`  ...and ${result.flips.length - 10} more`);
  }
  return `${lines.join("\n")}\n`;
};
