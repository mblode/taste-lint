import fs from "node:fs";
import path from "node:path";
import { PassThrough, Readable } from "node:stream";

import { afterEach, expect, it } from "vitest";

import { loadCorpus } from "../eval/corpus.js";
import {
  labelAgreement,
  labelGaps,
  labelSession,
  renderDisagreements,
  renderGaps,
} from "../eval/label.js";
import { runEval } from "../eval/metrics.js";
import { extractMarkdown } from "../extract/markdown.js";
import { loadRules } from "../rules/load.js";
import type { LabelSample } from "../scan/samples.js";
import { labelsToCorpus, makeSamples } from "../scan/samples.js";
import { writeJson } from "../scan/storage.js";
import type { CorpusItem } from "../types.js";
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

const RULE = "copywriting-canned-phrasing";
const rules = () => loadRules(path.resolve("data/rules"), { only: [RULE] });
const SOURCE = [
  "Judge said no to this one.",
  "",
  "Judge was unsure here.",
  "",
  "Judge was confident here.",
  "",
  "Mechanical check never fired.",
  "",
  `<!-- taste-lint-ignore: ${RULE} -->`,
  "Author already ignored this.",
].join("\n");

const samplesFor = (root: string): LabelSample[] => {
  const units = extractMarkdown("README.md", SOURCE, {
    config: config(root),
    docType: "readme",
  });
  const unit = (prefix: string) => {
    const found = units.find((u) => u.text.startsWith(prefix));
    if (!found) {
      throw new Error(`No unit ${prefix}`);
    }
    return found.id;
  };
  return makeSamples(
    units,
    rules(),
    new Map([
      [unit("Judge said"), { [RULE]: 0.1 }],
      [unit("Judge was unsure"), { [RULE]: 0.5 }],
      [unit("Judge was confident"), { [RULE]: 0.9 }],
      [unit("Author"), { [RULE]: 0.9 }],
    ]),
    new Map([[unit("Mechanical"), new Set([RULE])]]),
    3,
    "scan",
    new Map([["README.md", SOURCE.split("\n")]])
  );
};

const write = (root: string, samples: LabelSample[], name = "s.json") => {
  const file = path.join(root, name);
  writeJson(file, { samples, version: 2 });
  return file;
};

const answers = (...lines: string[]) =>
  Readable.from(lines.map((line) => `${line}\n`));

it("puts likely failures first: ignored, then mechanical-vs-judge disagreement, then the review band", () => {
  const order = samplesFor(fixture()).map((s) => s.item.text);
  expect(order).toEqual([
    "Author already ignored this.",
    "Judge said no to this one.",
    "Judge was unsure here.",
    "Judge was confident here.",
    "Mechanical check never fired.",
  ]);
});

it("records hand labels, unsure answers and notes, and keeps them when you quit", async () => {
  const root = fixture();
  const file = write(root, samplesFor(root));
  const result = await labelSession(file, {
    input: answers(
      "maybe",
      "y",
      "author meant it",
      "u",
      "depends on audience",
      "q"
    ),
    output: new PassThrough(),
  });
  expect(result).toMatchObject({
    labelled: 1,
    remaining: 3,
    stopped: "quit",
    unsure: 1,
  });
  const saved = JSON.parse(fs.readFileSync(file, "utf-8"))
    .samples as LabelSample[];
  expect(saved[0]).toMatchObject({ label: true, note: "author meant it" });
  expect(saved[1]).toMatchObject({
    label: null,
    note: "depends on audience",
    unsure: true,
  });

  // A second session resumes at the first unanswered sample.
  const output = new PassThrough();
  let shown = "";
  output.on("data", (chunk) => {
    shown += String(chunk);
  });
  await labelSession(file, { input: answers("n", "", "q"), output });
  expect(shown).toContain("Judge was unsure here.");
  expect(shown).not.toContain("Author already ignored this.");

  const out = path.join(root, "hand.jsonl");
  expect(labelsToCorpus(file, out)).toBe(2);
  const items = loadCorpus(root, rules());
  expect(items.every((item) => item.labelSource === "hand")).toBe(true);
  expect(items.find((item) => item.labels[RULE])?.note).toBe("author meant it");

  const gaps = labelGaps([file]);
  expect(gaps[0]).toMatchObject({
    fine: 1,
    ruleId: RULE,
    unsure: 1,
    violations: 1,
  });
  expect(renderGaps(gaps)).toContain("[unsure] depends on audience");
});

it("stops at the timebox without asking", async () => {
  const root = fixture();
  const file = write(root, samplesFor(root));
  let clock = 0;
  const result = await labelSession(file, {
    input: answers("y", ""),
    minutes: 1,
    now: () => {
      clock += 61_000;
      return clock;
    },
    output: new PassThrough(),
  });
  expect(result).toMatchObject({ labelled: 0, stopped: "timebox" });
});

it("refuses to hand-label an AI-annotated file", async () => {
  const root = fixture();
  const file = path.join(root, "ai.json");
  writeJson(file, {
    annotation: { model: "m", promptHash: "a".repeat(64), source: "ai" },
    samples: samplesFor(root),
    version: 2,
  });
  await expect(
    labelSession(file, { input: answers(), output: new PassThrough() })
  ).rejects.toThrow("AI annotation");
});

it("measures another labeller's agreement with your hand labels per rule", () => {
  const root = fixture();
  const samples = samplesFor(root);
  const hand = write(
    root,
    samples.map((s, i) => ({ ...s, label: i % 2 === 0 })),
    "hand.json"
  );
  const ai = write(
    root,
    samples.map((s) => ({ ...s, label: true })),
    "ai.json"
  );
  const [row] = labelAgreement(hand, ai, 0.8);
  expect(row).toMatchObject({ agree: 3, n: 5, ruleId: RULE, trusted: false });
});

it("lists judge disagreements with text and notes for the optimiser", () => {
  const [rule] = rules();
  const item = (id: string, label: boolean, note?: string): CorpusItem => ({
    categoryId: rule.categoryId,
    id,
    kind: "paragraph",
    labelSource: "hand",
    labels: { [RULE]: label },
    note,
    source: { path: "a.md", repo: "r" },
    split: "dev",
    text: `text of ${id}`,
  });
  const items = [item("missed", true, "stock opener"), item("agreed", false)];
  const report = renderDisagreements(
    [
      {
        calibration: [],
        metrics: {} as never,
        n: 2,
        pairs: [
          { id: "missed", label: true, probability: 0.1 },
          { id: "agreed", label: false, probability: 0.1 },
        ],
        reviewRate: 0,
        ruleId: RULE,
        unknown: 0,
      },
    ],
    items,
    [rule]
  );
  expect(report).toContain("1 of 2 disagree");
  expect(report).toContain(
    "labelled violation, judge missed p=0.10 [hand/dev] missed"
  );
  expect(report).toContain("note: stock opener");
  expect(report).not.toContain("text of agreed");
});

it("filters evaluation to the requested label sources", async () => {
  await expect(
    runEval({
      dryRun: true,
      resultsDir: fixture(),
      sources: ["hand"],
      split: "all",
    })
  ).rejects.toThrow("label sources");
});
