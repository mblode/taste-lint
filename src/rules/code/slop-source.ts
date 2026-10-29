// Generated-page slop a count decides: one eyebrow is a choice, one on every
// section is a template; one mention of the trial informs, eight pad the page.
// The same holds for an italic accent word, an opacity step, and font-mono.

import { hit, none } from "../../reduce/mechanical.js";
import type { MechanicalHit, Unit } from "../../types.js";
import { codeRule } from "./rule.js";

const EYEBROW =
  /<(?:p|span|div)\b[^>]*className="[^"]*\b(?:uppercase|text-xs|text-\[(?:9|10|11|12)px\])[^"]*"[^>]*>(?:\s*<span[^>]*\/>)?[^<{]{2,80}<\/(?:p|span|div)>\s*<h[1-3]\b/gu;

// The facts a brief most often gives and a padded page repeats.
const FACT =
  /\b\d+[- ]days?\b|\bno (?:credit )?card\b|\bcancel any ?time\b|\$\d+(?:\.\d\d)?(?= ?(?:\/|per|a) ?(?:seat|user|member|month))/giu;

// A heading that italicises part of itself with <em>, <i>, or an italic span.
const ITALIC_HEADING =
  /<h[1-3]\b(?:(?!<\/h[1-3]>)[\s\S]){0,400}?(?:<(?:em|i)\b|className="[^"]*\bitalic\b)/gu;

const TEXT_OPACITY = /\btext-[a-z]+(?:-[a-z]+)*(?:-\d{2,3})?\/(\d{1,3})\b/gu;

// font-mono on anything but the elements that hold literal text.
const MONO =
  /<(?!code\b|pre\b|kbd\b|samp\b)[A-Za-z][\w.]*\b[^>]*?className=["{`][^>]*?\bfont-mono\b/gu;

const MAX_EYEBROWS = 2;
const MAX_REPEATS = 3;
const MAX_ITALIC_HEADINGS = 1;
const MAX_OPACITY_STEPS = 3;
const MAX_MONO = 4;

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

export const italicAccents = (unit: Unit): MechanicalHit => {
  const found = [...unit.text.matchAll(ITALIC_HEADING)];
  if (found.length <= MAX_ITALIC_HEADINGS) {
    return none;
  }
  return {
    ...hit(`${found.length} headings italicise a word`),
    offset: found[MAX_ITALIC_HEADINGS]?.index,
  };
};

export const opacityLadder = (unit: Unit): MechanicalHit => {
  const steps = new Map<string, number>();
  for (const m of unit.text.matchAll(TEXT_OPACITY)) {
    if (!steps.has(m[1])) {
      steps.set(m[1], m.index);
    }
  }
  if (steps.size <= MAX_OPACITY_STEPS) {
    return none;
  }
  const values = [...steps.keys()].toSorted((a, b) => Number(a) - Number(b));
  return {
    ...hit(`${steps.size} text opacity steps: /${values.join(", /")}`),
    offset: [...steps.values()][MAX_OPACITY_STEPS],
  };
};

export const monoOveruse = (unit: Unit): MechanicalHit => {
  const found = [...unit.text.matchAll(MONO)];
  if (found.length <= MAX_MONO) {
    return none;
  }
  return {
    ...hit(`font-mono on ${found.length} elements that are not code`),
    offset: found[MAX_MONO]?.index,
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
  codeRule(
    {
      categoryId: "type-hierarchy",
      check: italicAccents,
      hint: "Let the sentence carry the weight. Keep italic for the one heading where the stress changes the meaning.",
      id: "typography-italic-accent-word",
      scope: { include: ["**/*.tsx", "**/*.jsx"] },
      source: source("slop-italic-accent-word"),
      status: "review-only",
      title: "One italic word in every heading",
      unit: ["source"],
    },
    "src/rules/code/slop-source.ts"
  ),
  codeRule(
    {
      categoryId: "colour-system",
      check: opacityLadder,
      hint: "Map each line to two or three named text levels from the theme and delete the in-between opacities.",
      id: "craft-opacity-ladder",
      scope: { include: ["**/*.tsx", "**/*.jsx"] },
      source: source("slop-opacity-ladder"),
      status: "review-only",
      title: "A ladder of text opacities",
      unit: ["source"],
    },
    "src/rules/code/slop-source.ts"
  ),
  codeRule(
    {
      categoryId: "type-voice",
      check: monoOveruse,
      hint: "Keep monospace for literal values a person copies: code, IDs, keys. Set labels, nav, and stats in the body face.",
      id: "typography-mono-overuse",
      scope: { include: ["**/*.tsx", "**/*.jsx"] },
      source: source("slop-mono-overuse"),
      status: "review-only",
      title: "Monospace on everything that is not code",
      unit: ["source"],
    },
    "src/rules/code/slop-source.ts"
  ),
];
