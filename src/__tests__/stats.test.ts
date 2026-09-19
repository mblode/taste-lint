import { expect, it } from "vitest";

import { decideThreshold } from "../eval/tune.js";
import {
  binaryMetrics,
  calibrationTable,
  mcnemar,
  wilson,
} from "../lib/stats.js";

it("computes Wilson intervals and McNemar like agent-evals", () => {
  const [lo, hi] = wilson(9, 10);
  expect(lo).toBeCloseTo(0.596, 2);
  expect(hi).toBeCloseTo(0.982, 2);
  const test = mcnemar(
    [true, true, false, false, true],
    [true, false, true, true, true]
  );
  expect(test).toMatchObject({ discordant: 3, n01: 1, n10: 2 });
  // Equal discordant counts mean no difference: statistic 0, p 1.
  expect(mcnemar([true, false], [false, true])).toMatchObject({
    pValue: 1,
    statistic: 0,
  });
  // No trials is the uninformative interval, never a confident zero.
  expect(wilson(0, 0)).toEqual([0, 1]);
});

it("computes precision, recall and a calibration table", () => {
  const m = binaryMetrics([
    { label: true, predicted: true },
    { label: true, predicted: false },
    { label: false, predicted: true },
    { label: false, predicted: false },
  ]);
  expect(m).toMatchObject({
    fn: 1,
    fp: 1,
    precision: 0.5,
    recall: 0.5,
    tn: 1,
    tp: 1,
  });
  const table = calibrationTable([
    { label: true, probability: 0.95 },
    { label: false, probability: 0.92 },
    { label: false, probability: 0.1 },
  ]);
  expect(table.at(-1)).toMatchObject({ n: 2, positives: 1 });
  expect(table[1]).toMatchObject({ n: 1, positives: 0 });
});

it("picks the lowest threshold that clears the precision floor, or demotes", () => {
  const good = Array.from({ length: 50 }, (_, i) => ({
    label: i < 25,
    probability: i < 25 ? 0.8 + (i % 5) * 0.03 : 0.2 + (i % 5) * 0.05,
  }));
  expect(decideThreshold(good, 0.7, 0.8, 10)).toMatchObject({
    action: "lower",
    chosen: 0.5,
  });
  const mixed = Array.from({ length: 50 }, (_, i) => ({
    label: i < 25,
    probability: i < 25 ? 0.85 + (i % 5) * 0.03 : 0.5 + (i % 5) * 0.05,
  }));
  expect(decideThreshold(mixed, 0.7, 0.8, 10)).toMatchObject({
    action: "raise",
    chosen: 0.75,
  });
  const noisy = Array.from({ length: 30 }, (_, i) => ({
    label: i % 2 === 0,
    probability: 0.9,
  }));
  expect(decideThreshold(noisy, 0.7, 0.8, 10)).toMatchObject({
    action: "demote",
    chosen: null,
  });
  expect(decideThreshold(noisy.slice(0, 5), 0.7, 0.8, 10)).toMatchObject({
    action: "insufficient",
  });
});
