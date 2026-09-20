import path from "node:path";

import { expect, it } from "vitest";

import { extractMarkdown } from "../extract/markdown.js";
import { planRequests } from "../map/plan.js";
import { jevFindings } from "../reduce/bands.js";
import { loadRules } from "../rules/load.js";
import type { DocType } from "../types.js";
import { config } from "./helpers.js";

const rules = loadRules(path.resolve("data/rules"));
const cases = [
  {
    candidate:
      "You should supply an API key; requests without one are rejected.",
    clear: "You must supply an API key.",
    id: "copywriting-requirements-language",
  },
  {
    candidate: "Run the migration if you are upgrading from version 2.",
    clear: "Run the migration.",
    id: "copywriting-conditions-first",
  },
  {
    candidate: "## Common issues",
    clear: "## Troubleshoot authentication errors",
    id: "copywriting-searchable-headings",
  },
  {
    candidate: "HTTP 403 means Forbidden.",
    clear: "Create an API key in the dashboard.",
    id: "copywriting-error-descriptions",
  },
];

const plan = (id: string, source: string, docType: DocType = "reference") => {
  const selected = rules.filter((r) => r.id === id);
  expect(selected).toHaveLength(1);
  return planRequests(
    extractMarkdown("docs/guide.md", source, { config: config("."), docType }),
    selected,
    config(".")
  );
};

it.each(cases)(
  "routes $id candidates to review without mechanical verdicts",
  ({ id, candidate, clear }) => {
    const result = plan(id, candidate);
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].rules.map((r) => r.rule.id)).toEqual([id]);
    expect(result.mechanical).toEqual([]);
    expect(plan(id, clear).jobs).toEqual([]);
    const answers = new Map([[result.jobs[0].unit.id, { [id]: 1 }]]);
    expect(jevFindings(result.jobs, answers).findings).toMatchObject([
      { band: "review", ruleId: id },
    ]);
  }
);

it.each(cases)(
  "excludes marketing, UI, unknown documents, and code for $id",
  ({ id, candidate }) => {
    for (const docType of ["marketing", "ui", "unknown"] as const) {
      expect(plan(id, candidate, docType).jobs).toEqual([]);
    }
    expect(plan(id, `\`\`\`text\n${candidate}\n\`\`\``).jobs).toEqual([]);
    expect(plan(id, `\`${candidate}\``).jobs).toEqual([]);
  }
);

it("keeps legitimate modal and conditional candidates for semantic judgement", () => {
  expect(
    plan(
      "copywriting-requirements-language",
      "You should set a longer timeout on slow networks."
    ).jobs
  ).toHaveLength(1);
  expect(
    plan(
      "copywriting-conditions-first",
      "If you are upgrading from version 2, run the migration."
    ).jobs
  ).toHaveLength(1);
});

it("does not treat isolated error table cells or headings as complete explanations", () => {
  expect(
    plan(
      "copywriting-error-descriptions",
      "| Code | Meaning |\n| --- | --- |\n| 403 | Forbidden |\n\n## HTTP 403"
    ).jobs
  ).toEqual([]);
});
