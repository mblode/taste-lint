import fs from "node:fs";
import path from "node:path";

import { afterEach, expect, it } from "vitest";

import { loadRules } from "../rules/load.js";
import { buildQuestion } from "../rules/question.js";
import { validateRule } from "../rules/validate.js";
import { FIXTURES, temporary } from "./helpers.js";

const folders: string[] = [];
afterEach(() => {
  for (const root of folders.splice(0)) {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

const base = () => ({
  categoryId: "evidence-over-claims",
  domain: "copywriting",
  fix: { hint: "Cut it.", mode: "none" },
  id: "copywriting-x",
  question: {
    criteria: {
      false: { examples: ["b"], what: "b" },
      true: { examples: ["a"], what: "a" },
    },
    instructions: "Is it?",
    type: "noul",
  },
  scope: { include: ["**/*.md"] },
  severity: "minor",
  source: { line: 1, path: "p", repo: "r" },
  tier: "jev",
  title: "X",
  unit: ["paragraph"],
});

it("loads the fixture rules and applies a tuning overlay", () => {
  const rules = loadRules(path.join(FIXTURES, "rules"));
  expect(rules.map((r) => r.id)).toEqual([
    "copywriting-claim-without-evidence",
    "typography-hierarchy-size-only",
    "typography-straight-quotes",
  ]);
  const root = temporary();
  folders.push(root);
  fs.cpSync(path.join(FIXTURES, "rules"), root, { recursive: true });
  fs.writeFileSync(
    path.join(root, "tuning.json"),
    JSON.stringify({
      "typography-hierarchy-size-only": { act: 0.9, status: "review-only" },
    })
  );
  const tuned = loadRules(root).find(
    (r) => r.id === "typography-hierarchy-size-only"
  );
  expect(tuned).toMatchObject({
    status: "review-only",
    thresholds: { act: 0.9, review: 0.4 },
  });
  fs.writeFileSync(
    path.join(root, "tuning.json"),
    JSON.stringify({ nope: { act: 0.9 } })
  );
  expect(() => loadRules(root)).toThrow(/unknown rule nope/);
  fs.writeFileSync(
    path.join(root, "tuning.json"),
    JSON.stringify({ "typography-hierarchy-size-only": { status: "activ" } })
  );
  expect(() => loadRules(root)).toThrow(/status must be one of/);
  fs.writeFileSync(
    path.join(root, "tuning.json"),
    JSON.stringify({ "typography-hierarchy-size-only": { act: "0.9" } })
  );
  expect(() => loadRules(root)).toThrow(/act must be a number/);
});

it.each([
  ["id mismatch", { id: "copywriting-y" }, /does not match filename/],
  ["unknown category", { categoryId: "nope" }, /unknown categoryId/],
  ["domain mismatch", { domain: "typography" }, /does not match category/],
  ["missing question", { question: undefined }, /needs a question/],
  [
    "thresholds order",
    { thresholds: { act: 0.3, review: 0.5 } },
    /review < act/,
  ],
  [
    "em dash in title",
    { title: `A ${String.fromCodePoint(0x20_14)} B` },
    /em dash/,
  ],
  [
    "bad regex",
    { mechanical: { regex: "(" }, tier: "both" },
    /does not compile/,
  ],
  [
    "deterministic without function",
    { fix: { hint: "x", mode: "deterministic" } },
    /fix.function/,
  ],
  [
    "mechanical with question",
    { mechanical: { regex: "x" }, tier: "mechanical" },
    /must not carry a question/,
  ],
  [
    "unknown top-level key",
    { threshold: { act: 0.9 } },
    /unknown key threshold/,
  ],
  [
    "string threshold",
    { thresholds: { act: "0.95", review: 0.5 } },
    /act must be a number/,
  ],
  [
    "typo in preconditions",
    { preconditions: { notInCod: true } },
    /unknown key notInCod/,
  ],
  [
    "fractional minMatches",
    { mechanical: { minMatches: 1.5, regex: "x" }, tier: "both" },
    /positive integer/,
  ],
  [
    "em dash in an example",
    {
      question: {
        criteria: {
          false: { examples: ["b"], what: "b" },
          true: {
            examples: [`a ${String.fromCodePoint(0x20_14)} b`],
            what: "a",
          },
        },
        instructions: "Is it?",
        type: "noul",
      },
    },
    /em dash/,
  ],
])("rejects %s before any request", (_name, overrides, pattern) => {
  expect(() =>
    validateRule({ ...base(), ...overrides }, "x.yaml", "copywriting-x")
  ).toThrow(pattern);
});

it("builds the noul wire format with structured criteria", () => {
  const rule = validateRule(base(), "x.yaml", "copywriting-x");
  expect(buildQuestion(rule)).toEqual({
    criteria: {
      false: { examples: ["b"], what: "b" },
      true: { examples: ["a"], what: "a" },
    },
    instructions: "Is it?",
    type: "noul",
  });
});
