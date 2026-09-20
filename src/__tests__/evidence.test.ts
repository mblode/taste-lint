import fs from "node:fs";
import path from "node:path";

import { afterEach, expect, it } from "vitest";

import { corpusCoverage } from "../eval/coverage.js";
import { promotionEvidence } from "../eval/promotion.js";
import { extractMarkdown } from "../extract/markdown.js";
import { makeSamples, labelsToCorpus } from "../scan/samples.js";
import type { CorpusItem } from "../types.js";
import { config, rule, temporary } from "./helpers.js";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) {
    fs.rmSync(dir, { force: true, recursive: true });
  }
});
const item = (
  id: string,
  label: boolean,
  split: "dev" | "holdout" = "holdout"
): CorpusItem => ({
  categoryId: "evidence-over-claims",
  context: { docType: "explanation", role: "body" },
  id,
  kind: "paragraph",
  labelModel: "test/labeler",
  labelPromptHash: "a".repeat(64),
  labelSource: "ai",
  labels: { "copywriting-test-rule": label },
  source: { path: `${id}.md`, repo: "test" },
  split,
  text: `Unique sample ${id}`,
});
it("exports complete rubrics and keeps identical text with different context", () => {
  const root = temporary();
  dirs.push(root);
  const units = extractMarkdown(
    "README.md",
    "# First\n\nSame sentence.\n\n# Second\n\nSame sentence.",
    { config: config(root), docType: "readme" }
  ).filter((unit) => unit.kind === "paragraph");
  const candidate = rule();
  const answers = new Map(
    units.map((unit) => [unit.id, { [candidate.id]: 0.8 }])
  );
  const samples = makeSamples(units, [candidate], answers, new Map());
  expect(samples).toHaveLength(2);
  expect(samples[0].rubric?.criteria).toEqual(candidate.question?.criteria);
  expect(new Set(samples.map((sample) => sample.id)).size).toBe(2);
  expect(samples.every((sample) => !("probability" in sample))).toBe(true);
});
it("rejects version 2 samples that have lost their rubric", () => {
  const root = temporary();
  dirs.push(root);
  const file = path.join(root, "samples.json");
  fs.writeFileSync(
    file,
    JSON.stringify({
      samples: [
        {
          criterion: "Check",
          id: "sample",
          item: { id: "sample" },
          label: false,
          ruleId: "copywriting-test-rule",
        },
      ],
      version: 2,
    })
  );
  expect(() => labelsToCorpus(file, path.join(root, "out.jsonl"))).toThrow();
  expect(fs.existsSync(path.join(root, "out.jsonl"))).toBe(false);
});
it("exposes class balance and source/text leakage without evaluation", () => {
  const dev = item("dev", true, "dev");
  const held = { ...item("held", false), source: dev.source, text: dev.text };
  const coverage = corpusCoverage([dev, held], [rule()]);
  expect(coverage.labelSources).toEqual({ ai: 2 });
  expect(coverage.overlappingSources).toEqual([["test", "dev.md"]]);
  expect(coverage.overlappingTexts).toBe(1);
  expect(coverage.rules[0]).toMatchObject({
    dev: { negative: 0, positive: 1 },
    holdout: { negative: 1, positive: 0 },
  });
});
it("requires independently split, complete, balanced holdout evidence", () => {
  const id = rule().id;
  const items = [
    item("dev", true, "dev"),
    ...Array.from({ length: 40 }, (_, i) => item(`holdout-${i}`, i < 20)),
  ];
  const pairs = items.slice(1).map((entry) => ({
    id: entry.id,
    label: entry.labels[id],
    probability: entry.labels[id] ? 0.9 : 0.1,
  }));
  expect(promotionEvidence(items, id, pairs, 0.7, 0.8, 10).eligible).toBe(true);
  expect(
    promotionEvidence(items, id, pairs.slice(1), 0.7, 0.8, 10).reason
  ).toContain("unresolved");
  const leaked = items.map((entry, i) =>
    i === 1 ? { ...entry, source: items[0].source } : entry
  );
  expect(promotionEvidence(leaked, id, pairs, 0.7, 0.8, 10).eligible).toBe(
    false
  );
  const positiveOnly = items.filter((entry) => entry.labels[id]);
  expect(
    promotionEvidence(
      positiveOnly,
      id,
      pairs.filter((pair) => pair.label),
      0.7,
      0.8,
      10
    ).reason
  ).toContain("both positive and negative");
  const noisy = pairs.map((pair) => ({ ...pair, probability: 0.9 }));
  expect(promotionEvidence(items, id, noisy, 0.7, 0.8, 10).eligible).toBe(
    false
  );
});
