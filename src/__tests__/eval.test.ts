// The eval and tune path over the shipped corpus, with an injected evaluate
// so nothing reaches a model.
import path from "node:path";

import { expect, it } from "vitest";

import { runEval } from "../eval/metrics.js";
import { runTune } from "../eval/tune.js";
import { fakeEvaluate, temporary } from "./helpers.js";

const root = path.resolve(import.meta.dirname, "../..");

it("evaluates a single rule against the shipped corpus without rejecting other labels", async () => {
  const result = await runEval({
    corpusDir: path.join(root, "data/corpus"),
    dryRun: true,
    only: ["copywriting-claim-without-evidence"],
    resultsDir: temporary(),
    rulesDir: path.join(root, "data/rules"),
  });
  expect(result.rules.map((r) => r.ruleId)).toEqual([
    "copywriting-claim-without-evidence",
  ]);
  expect(result.rules[0].n).toBeGreaterThan(0);
  expect(result.report).toMatch(/precision n\/a \(no positive predictions\)/);
});

it("tunes over the dev split with an injected evaluate and rejects a bad floor", async () => {
  const options = {
    corpusDir: path.join(root, "data/corpus"),
    resultsDir: temporary(),
    rulesDir: path.join(root, "data/rules"),
  };
  await expect(
    runTune({ ...options, floor: Number.NaN }, { evaluate: fakeEvaluate({}) })
  ).rejects.toThrow(/--floor/);
  const result = await runTune(
    { ...options, floor: 0.8 },
    { evaluate: fakeEvaluate(() => 0.9) }
  );
  expect(result.decisions.length).toBeGreaterThan(0);
  expect(
    result.decisions.every((d) =>
      ["insufficient", "demote", "keep", "raise", "lower"].includes(d.action)
    )
  ).toBe(true);
  expect(result.report).toMatch(/pass --write/);
});
