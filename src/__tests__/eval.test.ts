// The eval and tune path over the shipped corpus, with an injected evaluate
// so nothing reaches a model.
import fs from "node:fs";
import path from "node:path";

import { expect, it } from "vitest";

import { runEval } from "../eval/metrics.js";
import { runTune } from "../eval/tune.js";
import { fakeEvaluate, temporary } from "./helpers.js";

const root = path.resolve(import.meta.dirname, "../..");

it("replays explicit scale evidence and refuses malformed token values", async () => {
  const corpusDir = temporary();
  const ruleId = "craft-near-duplicate-scale";
  const item = {
    categoryId: "look-constraints",
    classes: ["text-[15px]"],
    context: { docType: "ui", fontScale: { body: "16px" }, role: "body" },
    id: "near-scale",
    kind: "class-list",
    labelSource: "hand",
    labels: { [ruleId]: true },
    source: { path: "app.tsx", repo: "fixture" },
    split: "dev",
    text: "Body",
  };
  const corpusFile = path.join(corpusDir, "cases.jsonl");
  const options = {
    corpusDir,
    dryRun: true,
    only: [ruleId],
    resultsDir: path.join(corpusDir, "results"),
    rulesDir: path.join(root, "data/rules"),
  };
  try {
    fs.writeFileSync(corpusFile, `${JSON.stringify(item)}\n`);
    const known = await runEval(options);
    expect(known.rules[0].pairs).toEqual([
      { id: "near-scale", label: true, probability: 1 },
    ]);
    fs.writeFileSync(
      corpusFile,
      `${JSON.stringify({ ...item, context: { ...item.context, fontScale: {} } })}\n`
    );
    const missing = await runEval(options);
    expect(missing.rules[0].unknown).toBe(1);
    fs.writeFileSync(
      corpusFile,
      `${JSON.stringify({ ...item, context: { ...item.context, fontScale: { body: 16 } } })}\n`
    );
    await expect(runEval(options)).rejects.toThrow(/fontScale/);
  } finally {
    fs.rmSync(corpusDir, { force: true, recursive: true });
  }
});

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
