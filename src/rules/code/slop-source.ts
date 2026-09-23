// Generated-page slop a count decides: one eyebrow is a choice, one on every
// section is a template; one mention of the trial informs, eight pad the page.

import { hit, none } from "../../reduce/mechanical.js";
import type { MechanicalHit, Unit } from "../../types.js";
import { codeRule } from "./rule.js";

const EYEBROW =
  /<(?:p|span|div)\b[^>]*className="[^"]*\b(?:uppercase|text-xs|text-\[(?:9|10|11|12)px\])[^"]*"[^>]*>(?:\s*<span[^>]*\/>)?[^<{]{2,80}<\/(?:p|span|div)>\s*<h[1-3]\b/gu;

// The facts a brief most often gives and a padded page repeats.
const FACT =
  /\b\d+[- ]days?\b|\bno (?:credit )?card\b|\bcancel any ?time\b|\$\d+(?:\.\d\d)?(?= ?(?:\/|per|a) ?(?:seat|user|member|month))/giu;

const MAX_EYEBROWS = 2;
const MAX_REPEATS = 3;

export const eyebrows = (unit: Unit): MechanicalHit => {
  const found = [...unit.text.matchAll(EYEBROW)];
  if (found.length <= MAX_EYEBROWS) {
    return none;
  }
  return {
    ...hit(`${found.length} headings carry an eyebrow label`),
    offset: found[MAX_EYEBROWS]?.index,
  };
};

export const factPadding = (unit: Unit): MechanicalHit => {
  const counts = new Map<string, { n: number; first: number }>();
  for (const m of unit.text.matchAll(FACT)) {
    const key = m[0].toLowerCase().replaceAll(/[- ]/gu, " ");
    const seen = counts.get(key) ?? { first: m.index, n: 0 };
    counts.set(key, { ...seen, n: seen.n + 1 });
  }
  const [top] = [...counts].toSorted((a, b) => b[1].n - a[1].n);
  if (!top || top[1].n <= MAX_REPEATS) {
    return none;
  }
  return {
    ...hit(`"${top[0]}" appears ${top[1].n} times`),
    offset: top[1].first,
  };
};

const source = (ruleId: string) => ({
  line: 10,
  path: `skills/ui-design/rules/${ruleId}.md`,
  repo: "mblode/agent-skills",
  ruleId,
});

export const SLOP_SOURCE_RULES = [
  codeRule(
    {
      categoryId: "visual-hierarchy",
      check: eyebrows,
      hint: "Keep an eyebrow on at most two sections, where it names something the heading cannot. Delete the rest.",
      id: "craft-eyebrow-overuse",
      scope: { include: ["**/*.tsx", "**/*.jsx"] },
      source: source("slop-eyebrow-overuse"),
      status: "review-only",
      title: "An eyebrow over nearly every heading",
      unit: ["source"],
    },
    "src/rules/code/slop-source.ts"
  ),
  codeRule(
    {
      categoryId: "evidence-over-claims",
      check: factPadding,
      hint: "Say each fact once, where the reader needs it: the price on the plan, the trial on the button. Cut the sections that exist only to repeat them.",
      id: "copywriting-fact-padding",
      scope: { include: ["**/*.tsx", "**/*.jsx"] },
      source: source("slop-fact-padding"),
      status: "review-only",
      title: "The same few facts restated to fill the page",
      unit: ["source"],
    },
    "src/rules/code/slop-source.ts"
  ),
];
