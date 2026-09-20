import fs from "node:fs";
import path from "node:path";

import { afterEach, expect, it } from "vitest";

import { loadCorpus } from "../eval/corpus.js";
import { extractMarkdown } from "../extract/markdown.js";
import { loadRules } from "../rules/load.js";
import { makeSamples, labelsToCorpus } from "../scan/samples.js";
import { writeJson } from "../scan/storage.js";
import { config, temporary } from "./helpers.js";

const dirs: string[] = [];
const fixture = () => {
  const dir = temporary();
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of dirs.splice(0)) {
    fs.rmSync(dir, { force: true, recursive: true });
  }
});

it("preserves AI label provenance and rejects missing model metadata", () => {
  const root = fixture();
  const rules = loadRules(path.resolve("data/rules"), {
    only: ["copywriting-generic-framing"],
  });
  const units = extractMarkdown("README.md", "Concrete facts.", {
    config: config(root),
    docType: "readme",
  });
  const samples = makeSamples(
    units,
    rules,
    new Map([[units[0].id, { [rules[0].id]: 0.8 }]]),
    new Map()
  );
  samples[0].label = false;
  const input = path.join(root, "ai.json");
  writeJson(input, {
    annotation: {
      model: "test/labeler",
      promptHash: "a".repeat(64),
      source: "ai",
    },
    samples,
    version: 1,
  });
  const prepared = JSON.parse(fs.readFileSync(input, "utf-8"));
  writeJson(input, { ...prepared, completed: 0 });
  expect(() => labelsToCorpus(input, path.join(root, "partial.jsonl"))).toThrow(
    "incomplete"
  );
  writeJson(input, { ...prepared, completed: samples.length });
  expect(labelsToCorpus(input, path.join(root, "ai.jsonl"))).toBe(1);
  expect(loadCorpus(root, rules)[0]).toMatchObject({
    labelModel: "test/labeler",
    labelPromptHash: "a".repeat(64),
    labelSource: "ai",
  });
  writeJson(input, { annotation: { source: "ai" }, samples, version: 1 });
  expect(() => labelsToCorpus(input, path.join(root, "bad.jsonl"))).toThrow(
    "model"
  );
});
