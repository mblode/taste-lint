import path from "node:path";

import { expect, it } from "vitest";

import { extractMarkdown } from "../extract/markdown.js";
import { extractTsx } from "../extract/tsx.js";
import { planRequests } from "../map/plan.js";
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
