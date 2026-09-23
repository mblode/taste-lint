import fs from "node:fs";
import path from "node:path";

import { afterEach, expect, it } from "vitest";

import { decideThreshold, runTune, runTuneAb } from "../eval/tune.js";
import { ProviderError } from "../map/jev.js";
import { fakeEvaluate, temporary } from "./helpers.js";

const dirs: string[] = [];
const setup = () => {
  const root = temporary();
  dirs.push(root);
  const rulesDir = path.join(root, "rules");
  fs.mkdirSync(path.join(rulesDir, "copywriting"), { recursive: true });
  const id = "copywriting-generic-framing";
  fs.copyFileSync(
    `data/rules/copywriting/${id}.yaml`,
    path.join(rulesDir, "copywriting", `${id}.yaml`)
  );
  const corpusDir = path.join(root, "corpus");
  fs.mkdirSync(corpusDir);
  fs.writeFileSync(
    path.join(corpusDir, "items.jsonl"),
    ["first", "second"]
      .map((text) =>
        JSON.stringify({
          categoryId: "reader-first-framing",
          context: {
            docType: "explanation",
            role: "body",
            ...(text === "second" ? { section: "Context for second" } : {}),
          },
          id: text,
          kind: "paragraph",
          labelSource: "hand",
          labels: { [id]: true },
          source: { path: "example.md", repo: "test" },
          split: "dev",
          text: `The ${text} paragraph frames the topic generically.`,
        })
      )
      .join("\n")
  );
  const variantFile = path.join(root, "variant.yaml");
  fs.writeFileSync(
    variantFile,
    "question:\n  instructions: Is the text generic?\n  context: [section]\n"
  );
  return {
    corpusDir,
    id,
    resultsDir: path.join(root, "results"),
    rulesDir,
    variantFile,
  };
};
afterEach(() => {
  for (const dir of dirs.splice(0)) {
    fs.rmSync(dir, { force: true, recursive: true });
  }
});
it("does not overwrite tuning after provider failure", async () => {
  const options = setup();
  const file = path.join(options.rulesDir, "tuning.json");
  fs.writeFileSync(file, "{}\n");
  const result = await runTune(
    { ...options, only: [options.id], write: true },
    {
      evaluate: () => Promise.reject(new ProviderError("auth", 401)),
    }
  );
  expect(result.exitCode).toBe(2);
  expect(result.decisions).toEqual([]);
  expect(fs.readFileSync(file, "utf-8")).toBe("{}\n");
});
it("pairs A/B results by sample identity when the variant lacks context", async () => {
  const options = setup();
  const result = await runTuneAb(
    { ...options, ruleId: options.id },
    {
      evaluate: fakeEvaluate(() => 0.9),
    }
  );
  expect(result.exitCode).toBe(0);
  expect(result.report).toContain("1 paired dev items; 1 excluded");
  expect(result.report).toContain("discordant=0");
});
it("rejects an A/B verdict after provider failure", async () => {
  const options = setup();
  const result = await runTuneAb(
    { ...options, ruleId: options.id },
    {
      evaluate: () => Promise.reject(new ProviderError("auth", 401)),
    }
  );
  expect(result.exitCode).toBe(2);
  expect(result.report).not.toContain("McNemar:");
});
it("keeps the chosen action threshold above the rule's review threshold", () => {
  const pairs = Array.from({ length: 30 }, (_, id) => ({
    label: true,
    probability: id < 15 ? 0.7 : 0.95,
  }));
  expect(decideThreshold(pairs, 0.9, 0.7, 10, 0.8).chosen).toBe(0.85);
});

it("writes review-only without holdout and promotes only after independent validation", async () => {
  const options = setup();
  const rows = Array.from({ length: 80 }, (_, i) => ({
    categoryId: "reader-first-framing",
    context: { docType: "explanation", role: "body" },
    id: `example-${i}`,
    kind: "paragraph",
    labelSource: "hand",
    labels: { [options.id]: i % 2 === 0 },
    source: { path: `example-${i}.md`, repo: "test" },
    split: i < 40 ? "dev" : "holdout",
    text: `${i % 2 === 0 ? "Violation" : "Acceptable"} example number ${i} for the rule.`,
  }));
  const corpus = path.join(options.corpusDir, "items.jsonl");
  fs.writeFileSync(
    corpus,
    rows
      .slice(0, 40)
      .map((row) => JSON.stringify(row))
      .join("\n")
  );
  const evaluate = fakeEvaluate((_id, state) =>
    state.includes("Violation") ? 0.9 : 0.1
  );
  const first = await runTune(
    { ...options, only: [options.id], write: true },
    { evaluate }
  );
  expect(first.decisions[0].validation?.eligible).toBe(false);
  const tuning = path.join(options.rulesDir, "tuning.json");
  expect(JSON.parse(fs.readFileSync(tuning, "utf-8"))[options.id].status).toBe(
    "review-only"
  );
  fs.writeFileSync(corpus, rows.map((row) => JSON.stringify(row)).join("\n"));
  const second = await runTune(
    { ...options, only: [options.id], write: true },
    { evaluate }
  );
  expect(second.decisions[0].validation?.eligible).toBe(true);
  expect(JSON.parse(fs.readFileSync(tuning, "utf-8"))[options.id].status).toBe(
    "active"
  );
});
