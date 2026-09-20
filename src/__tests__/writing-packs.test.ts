import path from "node:path";

import { expect, it } from "vitest";

import { extractMarkdown } from "../extract/markdown.js";
import { extractTsx } from "../extract/tsx.js";
import { validateWritingContext } from "../lib/writing-context.js";
import { planRequests } from "../map/plan.js";
import { buildState } from "../map/state.js";
import { jevFindings } from "../reduce/bands.js";
import { loadRules } from "../rules/load.js";
import { check, config } from "./helpers.js";

const rules = loadRules(path.resolve("data/rules"));
const added = rules.filter(
  (r) =>
    r.question &&
    !r.question.context?.some((key) => key.startsWith("writing")) &&
    (r.id.startsWith("authoring-") ||
      r.source.repo === "installed/copywriting" ||
      r.source.repo === "mblode/ghostwriter")
);

it.each(added)(
  "$id routes its failure example but never promotes uncalibrated judgement",
  (rule) => {
    const docType = rule.preconditions!.docType![0];
    const text = rule.question!.criteria!.true.examples[0];
    const cfg = config(".");
    const units = extractMarkdown("draft.md", text, { config: cfg, docType });
    const plan = planRequests(units, [rule], cfg);
    expect(plan.jobs).toHaveLength(1);
    expect(plan.mechanical).toEqual([]);
    const answers = new Map([[plan.jobs[0].unit.id, { [rule.id]: 1 }]]);
    expect(jevFindings(plan.jobs, answers).findings[0]?.band).toBe("review");
    expect(
      planRequests(
        extractMarkdown("draft.md", text, {
          config: cfg,
          docType: "reference",
        }),
        [rule],
        cfg
      ).jobs
    ).toEqual([]);
  }
);

const get = (classes: string) =>
  extractTsx("component.tsx", `<p className="${classes}">Example text</p>`, {
    config: config("."),
    docType: "ui",
  }).find((u) => u.kind === "class-list")!;

it.each([
  [
    "typography-justify-without-hyphens",
    "text-justify hyphens-none",
    "text-justify hyphens-auto",
  ],
  [
    "typography-disabled-kerning",
    "[font-kerning:none]",
    "[font-kerning:normal]",
  ],
  ["typography-stretched-glyphs", "scale-x-125", "scale-x-100"],
  [
    "motion-layout-property-transition",
    "transition-[width]",
    "transition-transform",
  ],
])("%s uses explicit class evidence", (id, bad, good) => {
  expect(check(id)(get(bad)).fired).toBe(true);
  expect(check(id)(get(good)).fired).toBe(false);
});

const contextual = rules.filter((rule) =>
  rule.question?.context?.some((key) => key.startsWith("writing"))
);
it.each(contextual)(
  "$id requires explicit context and abstains on oversized comparisons",
  (rule) => {
    const cfg = config(".");
    const units = extractMarkdown(
      "draft.md",
      "Please send the draft tomorrow.",
      { config: cfg, docType: "personal" }
    );
    const missing = planRequests(units, [rule], cfg);
    expect(missing.jobs).toHaveLength(0);
    expect(missing.unknowns).toHaveLength(1);
    const key = rule.question!.context!.find((item) =>
      item.startsWith("writing")
    )!;
    Object.assign(units[0].context, {
      [key]: "Use a warm, direct voice. The deadline is Friday.",
    });
    const supplied = planRequests(units, [rule], cfg);
    expect(supplied.jobs).toHaveLength(1);
    expect(supplied.unknowns).toHaveLength(0);
    const state = buildState(units[0], [rule]);
    expect(state.state).toContain("The deadline is Friday.");
    expect(state.truncated).toBe(false);
    Object.assign(units[0].context, { [key]: "Long context ".repeat(2000) });
    expect(planRequests(units, [rule], cfg).jobs).toHaveLength(0);
    expect(planRequests(units, [rule], cfg).unknowns[0].reason).toContain(
      "budget"
    );
  }
);
it("validates writing context without echoing private values", () => {
  expect(validateWritingContext({ facts: "Deadline Friday" })).toEqual({
    facts: "Deadline Friday",
  });
  for (const value of [{}, [], { profile: "" }, { secret: "private-value" }]) {
    expect(() => validateWritingContext(value)).toThrow();
    try {
      validateWritingContext(value);
    } catch (error) {
      expect(String(error)).not.toContain("private-value");
    }
  }
});
