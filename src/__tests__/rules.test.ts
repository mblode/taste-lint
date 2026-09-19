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
  fix: { hint: "Cut it." },
  id: "copywriting-x",
  question: {
    criteria: {
      false: { examples: ["b"], what: "b" },
      true: { examples: ["a"], what: "a" },
    },
    instructions: "Is it?",
  },
  severity: "minor",
  source: { line: 1, path: "p", repo: "r" },
  title: "X",
  unit: ["paragraph"],
});

it("derives tier, domain and scope from the fields a rule does carry", () => {
  const jev = validateRule(base(), "x.yaml", "copywriting-x");
  expect(jev).toMatchObject({
    domain: "copywriting",
    scope: {
      exclude: [
        "**/*.test.*",
        "**/*.spec.*",
        "**/*.stories.*",
        "**/CHANGELOG.md",
      ],
      include: ["**/*.md", "**/*.mdx"],
    },
    tier: "jev",
  });
  const both = validateRule(
    { ...base(), mechanical: { regex: "x" } },
    "x.yaml",
    "copywriting-x"
  );
  expect(both.tier).toBe("both");
  const mixed = validateRule(
    {
      ...base(),
      scope: { exclude: ["**/README.md"] },
      unit: ["heading", "jsx-text", "attr-string"],
    },
    "x.yaml",
    "copywriting-x"
  );
  expect(mixed.scope.include).toEqual([
    "**/*.md",
    "**/*.mdx",
    "**/*.tsx",
    "**/*.jsx",
  ]);
  expect(mixed.scope.exclude).toContain("**/README.md");
  expect(mixed.scope.exclude).toContain("**/*.test.*");
});

it("loads the fixture rules beside the code rules and applies a tuning overlay", () => {
  const rules = loadRules(path.join(FIXTURES, "rules"));
  const yaml = rules.filter((r) => !r.file.startsWith("code:"));
  expect(yaml.map((r) => r.id)).toEqual([
    "copywriting-claim-without-evidence",
    "typography-straight-quotes",
  ]);
  const hierarchy = rules.find(
    (r) => r.id === "typography-hierarchy-size-only"
  );
  expect(hierarchy?.file).toBe("code:src/rules/code/typography.ts");
  expect(hierarchy?.tier).toBe("both");
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
  [
    "missing question",
    { question: undefined },
    /needs a mechanical section or a question/,
  ],
  [
    "source rule without scope.include",
    { mechanical: { regex: "x" }, question: undefined, unit: ["source"] },
    /needs scope.include/,
  ],
  [
    "source rule with a question",
    {
      mechanical: { regex: "x" },
      scope: { include: ["**/*.tsx"] },
      unit: ["source"],
    },
    /no question/,
  ],
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
  ["bad regex", { mechanical: { regex: "(" } }, /does not compile/],
  [
    "unregistered fix function",
    { fix: { function: "nope", hint: "x" } },
    /not registered/,
  ],
  ["removed field", { tier: "jev" }, /unknown key tier/],
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
    { mechanical: { minMatches: 1.5, regex: "x" } },
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
      },
    },
    /em dash/,
  ],
])("rejects %s before any request", (_name, overrides, pattern) => {
  expect(() =>
    validateRule({ ...base(), ...overrides }, "x.yaml", "copywriting-x")
  ).toThrow(pattern);
});

it("rejects an id outside the category's domain", () => {
  expect(() =>
    validateRule({ ...base(), id: "typography-x" }, "x.yaml", "typography-x")
  ).toThrow(/must start with copywriting-/);
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
