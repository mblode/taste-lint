// The eval and tune path over the shipped corpus, with an injected evaluate
// so nothing reaches a model.
import fs from "node:fs";
import path from "node:path";

import { expect, it } from "vitest";

import { runEval } from "../eval/metrics.js";
import { runTune } from "../eval/tune.js";
import { ProviderError } from "../map/jev.js";
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

it("renders an offline HTML report only when asked, with a row per case", async () => {
  const withoutHtml = await runEval({
    corpusDir: path.join(root, "data/corpus"),
    dryRun: true,
    only: ["copywriting-claim-without-evidence"],
    resultsDir: temporary(),
    rulesDir: path.join(root, "data/rules"),
  });
  expect(withoutHtml.html).toBeUndefined();
  const withHtml = await runEval({
    corpusDir: path.join(root, "data/corpus"),
    dryRun: true,
    html: true,
    only: ["copywriting-claim-without-evidence"],
    resultsDir: temporary(),
    rulesDir: path.join(root, "data/rules"),
  });
  expect(withHtml.html).toContain("<!doctype html>");
  expect(withHtml.html).toContain("copywriting-claim-without-evidence");
});

it("warns on headroom once a rule's precision lower bound clears 95%", async () => {
  const corpusDir = temporary();
  const id = "copywriting-generic-framing";
  // Wilson's lower bound on tp/(tp+fp) with fp=0 is exactly tp/(tp+z^2); at
  // least 74 positive predictions are needed to clear the 95% headroom floor.
  const rows = Array.from({ length: 160 }, (_, i) => ({
    categoryId: "reader-first-framing",
    context: { docType: "explanation", role: "body" },
    id: `example-${i}`,
    kind: "paragraph",
    labelSource: "hand",
    labels: { [id]: i % 2 === 0 },
    source: { path: `example-${i}.md`, repo: "test" },
    split: i < 80 ? "dev" : "holdout",
    text: `${i % 2 === 0 ? "Violation" : "Acceptable"} example number ${i} for the rule.`,
  }));
  fs.writeFileSync(
    path.join(corpusDir, "items.jsonl"),
    rows.map((row) => JSON.stringify(row)).join("\n")
  );
  const evaluate = fakeEvaluate((_id, state) =>
    state.includes("Violation") ? 0.9 : 0.1
  );
  const result = await runEval(
    {
      corpusDir,
      only: [id],
      resultsDir: temporary(),
      rulesDir: path.join(root, "data/rules"),
    },
    { evaluate }
  );
  expect(result.report).toMatch(/Headroom:/);
  expect(result.report).toMatch(/tune for cost instead/);
}, 20_000);

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

it("fails the run on a rejected key instead of reporting a judge that never fires", async () => {
  await expect(
    runEval(
      {
        corpusDir: path.join(root, "data/corpus"),
        noCache: true,
        only: ["copywriting-claim-without-evidence"],
        resultsDir: temporary(),
        rulesDir: path.join(root, "data/rules"),
      },
      { evaluate: () => Promise.reject(new ProviderError("auth", 401)) }
    )
  ).rejects.toMatchObject({ category: "auth" });
});
