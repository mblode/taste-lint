// Statistics helpers copied from agent-evals routing.ts so the two tools
// report the same numbers for the same inputs.

// Deterministic PRNG (mulberry32).
export const makePRNG = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return (): number => {
    a |= 0;
    a = (a + 0x6d_2b_79_f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
};

// Wilson score interval for a binomial proportion (95% by default).
export const wilson = (
  successes: number,
  n: number,
  z = 1.96
): [number, number] => {
  if (n === 0) {
    return [0, 0];
  }
  const phat = successes / n;
  const denom = 1 + (z * z) / n;
  const center = (phat + (z * z) / (2 * n)) / denom;
  const margin =
    (z / denom) * Math.sqrt((phat * (1 - phat)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, center - margin), Math.min(1, center + margin)];
};

// Abramowitz-Stegun erfc approximation (max abs error ~1.2e-7).
const erfc = (x: number): number => {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const c = [
    -1.26551223, 1.00002368, 0.37409196, 0.09678418, -0.18628806, 0.27886807,
    -1.13520398, 1.48851587, -0.82215223, 0.17087277,
  ];
  let poly = c.at(-1) as number;
  for (let i = c.length - 2; i >= 0; i -= 1) {
    poly = (c[i] as number) + t * poly;
  }
  const r = t * Math.exp(-z * z + poly);
  return x >= 0 ? r : 2 - r;
};

// McNemar paired test for two correctness vectors over the same item set.
export const mcnemar = (
  aCorrect: boolean[],
  bCorrect: boolean[]
): {
  discordant: number;
  n01: number;
  n10: number;
  pValue: number;
  statistic: number;
} => {
  if (aCorrect.length !== bCorrect.length) {
    throw new Error(
      "mcnemar: aCorrect and bCorrect must be equal-length arrays"
    );
  }
  let n01 = 0;
  let n10 = 0;
  for (let i = 0; i < aCorrect.length; i += 1) {
    const a = !!aCorrect[i];
    const b = !!bCorrect[i];
    if (a && !b) {
      n01 += 1;
    } else if (!a && b) {
      n10 += 1;
    }
  }
  const discordant = n01 + n10;
  const statistic =
    discordant === 0 ? 0 : (Math.abs(n01 - n10) - 1) ** 2 / discordant;
  const pValue = discordant === 0 ? 1 : erfc(Math.sqrt(statistic / 2));
  return { discordant, n01, n10, pValue, statistic };
};

export interface BinaryMetrics {
  tp: number;
  fp: number;
  fn: number;
  tn: number;
  precision: number;
  recall: number;
  f1: number;
  precisionCI: [number, number];
  recallCI: [number, number];
}

// Precision, recall and F1 for one rule over labelled (label, predicted) pairs.
export const binaryMetrics = (
  pairs: { label: boolean; predicted: boolean }[]
): BinaryMetrics => {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;
  for (const { label, predicted } of pairs) {
    if (label && predicted) {
      tp += 1;
    } else if (!label && predicted) {
      fp += 1;
    } else if (label && !predicted) {
      fn += 1;
    } else {
      tn += 1;
    }
  }
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1 =
    precision + recall === 0
      ? 0
      : (2 * precision * recall) / (precision + recall);
  return {
    f1,
    fn,
    fp,
    precision,
    precisionCI: wilson(tp, tp + fp),
    recall,
    recallCI: wilson(tp, tp + fn),
    tn,
    tp,
  };
};

// Calibration table: observed positive rate per predicted-probability bucket.
export const calibrationTable = (
  pairs: { label: boolean; probability: number }[],
  buckets = 10
): { lo: number; hi: number; n: number; positives: number; meanP: number }[] =>
  Array.from({ length: buckets }, (_, i) => {
    const lo = i / buckets;
    const hi = (i + 1) / buckets;
    const rows = pairs.filter(
      (p) =>
        p.probability >= lo &&
        (p.probability < hi || (i === buckets - 1 && p.probability <= 1))
    );
    return {
      hi,
      lo,
      meanP:
        rows.length === 0
          ? 0
          : rows.reduce((s, r) => s + r.probability, 0) / rows.length,
      n: rows.length,
      positives: rows.filter((r) => r.label).length,
    };
  });
