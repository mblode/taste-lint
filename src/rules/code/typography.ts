// Typography and sentence-length checks over resolved values and text. The
// arithmetic is here; Jev only ever sees words.

import {
  countWords,
  describe,
  hit,
  needText,
  needTypography,
  none,
  sizeOrAbstain,
  UnresolvedError,
} from "../../reduce/mechanical.js";
import type { Rule } from "../../types.js";
import { codeRule } from "./rule.js";

const MODULE = "src/rules/code/typography.ts";
const AUDIT = "skills/typography-audit/rules";
const BODY_ROLES = new Set(["body", "list-item", "cell"]);

// Colour classes that quiet an element rather than emphasise it.
const isMutedColour = (cls: string): boolean =>
  /(?:^|:)text-(?:muted|secondary|foreground|inherit|current)(?:-|$|\/)/u.test(
    cls
  );

const rule = (spec: Parameters<typeof codeRule>[0]): Rule =>
  codeRule(spec, MODULE);

export const TYPOGRAPHY_RULES: Rule[] = [
  rule({
    categoryId: "reading-comfort",
    check: (unit) => {
      const t = needTypography(unit);
      const size = sizeOrAbstain(t);
      if (size === undefined || !BODY_ROLES.has(unit.context.role)) {
        return none;
      }
      const words = countWords(unit.text);
      if (words < 6) {
        return none;
      }
      return size < 15
        ? hit(`${describe(t)} on ${words} words of body text`)
        : none;
    },
    hint: "Body text reads at 15 to 19px on a phone and 18 to 24px on desktop. Keep 12 and 13px for captions and metadata nobody has to act on.",
    id: "typography-body-below-15px",
    source: {
      line: 7,
      path: `${AUDIT}/size-body-text.md`,
      repo: "mblode/agent-skills",
    },
    title: "Running text set below 15px",
    unit: ["class-list", "element"],
  }),
  rule({
    categoryId: "reading-comfort",
    check: (unit) => {
      const t = needTypography(unit);
      if (t.letterSpacingEm === undefined || !needText(unit) || t.uppercase) {
        return none;
      }
      if (unit.context.role === "heading" || unit.context.role === "button") {
        return none;
      }
      const size = sizeOrAbstain(t);
      return t.letterSpacingEm > 0 && size !== undefined && size >= 13
        ? hit(describe(t))
        : none;
    },
    hint: "Remove the tracking from body text. Letter-spacing belongs to uppercase and small caps; if small text is hard to read, make it bigger.",
    id: "typography-letterspaced-body",
    source: {
      line: 7,
      path: `${AUDIT}/spacing-letterspacing-body.md`,
      repo: "mblode/agent-skills",
    },
    title: "Positive letter-spacing on lowercase body text",
    unit: ["class-list", "element"],
  }),
  rule({
    categoryId: "reading-comfort",
    // Weight 100 to 300 on text at or below 18px. An inherited size is not judged.
    check: (unit) => {
      const t = needTypography(unit);
      if (t.fontWeight === undefined || !needText(unit)) {
        return none;
      }
      const size = sizeOrAbstain(t);
      return t.fontWeight <= 300 && size !== undefined && size <= 18
        ? hit(describe(t))
        : none;
    },
    hint: "Set body text at regular (400) or medium (500). Light weights lose contrast at text sizes; use them only at display sizes.",
    id: "typography-light-weight-small-body",
    source: {
      line: 7,
      path: `${AUDIT}/font-weight-body.md`,
      repo: "mblode/agent-skills",
    },
    title: "Thin or light weight on text-sized copy",
    unit: ["class-list", "element"],
  }),
  rule({
    categoryId: "reading-comfort",
    // Body outside the rule's 1.4 to 1.6 band, display above 1.2. The code
    // allows 0.05 either side (1.35 to 1.7, display 1.25) so a rounded Tailwind
    // default such as text-sm's 1.429 never fires.
    check: (unit) => {
      const t = needTypography(unit);
      if (t.lineHeight === undefined || t.fontSizePx === undefined) {
        return none;
      }
      if (t.fontSizePx >= 32) {
        return t.lineHeight > 1.25
          ? hit(`${describe(t)} on display text`)
          : none;
      }
      if (unit.context.role !== "body" && unit.context.role !== "list-item") {
        return none;
      }
      if (countWords(unit.text) < 8) {
        return none;
      }
      return t.lineHeight < 1.35 || t.lineHeight > 1.7
        ? hit(`${describe(t)} on running text`)
        : none;
    },
    hint: "Body reads at 1.4 to 1.6, wider columns a little more. Display type over 32px wants 1.1 to 1.2 so a headline reads as one object.",
    id: "typography-line-height-out-of-band",
    source: {
      line: 7,
      path: `${AUDIT}/size-line-height.md`,
      repo: "mblode/agent-skills",
    },
    title: "Line height outside the comfortable band for its size",
    unit: ["class-list", "element"],
  }),
  rule({
    categoryId: "type-hierarchy",
    // This element and its next text-bearing sibling both resolve a size, the
    // weights match, and the ratio is above 1.0 and at most 1.2. Jev then
    // decides whether the pair is a heading over its body or two peers.
    check: (unit) => {
      const t = needTypography(unit);
      const next = unit.neighbours?.next?.typography;
      if (!next) {
        return none;
      }
      if (t.fontSizePx === undefined || next.fontSizePx === undefined) {
        if (
          [...t.unresolved, ...next.unresolved].some((c) =>
            c.startsWith("text-")
          )
        ) {
          throw new UnresolvedError("font size unresolved on one of the pair");
        }
        return none;
      }
      const [big, small] =
        t.fontSizePx >= next.fontSizePx
          ? [t.fontSizePx, next.fontSizePx]
          : [next.fontSizePx, t.fontSizePx];
      const ratio = big / small;
      const sameWeight = (t.fontWeight ?? 400) === (next.fontWeight ?? 400);
      return ratio > 1 && ratio <= 1.2 && sameWeight
        ? hit(
            `${describe(t)} over ${describe(next)}, ratio ${ratio.toFixed(2)}`
          )
        : none;
    },
    hint: "Make the sizes clearly different (a step of 20 to 25 percent or more) or add a second cue such as weight or colour. Two roles two pixels apart read as a mistake.",
    id: "typography-hierarchy-size-only",
    question: {
      context: ["neighbours"],
      criteria: {
        false: {
          examples: [
            "FIRST: Start free trial. SECOND: See how it works.",
            "FIRST: Every file change, in order. SECOND: Restored versions keep their history.",
          ],
          what: "The two texts have the same role.",
        },
        true: {
          examples: [
            "FIRST: Notification rules. SECOND: Choose which sync events reach your inbox and which stay in the activity feed.",
            "FIRST: Billing. SECOND: Invoices, payment method and tax details for this workspace.",
          ],
          what: "FIRST is a title or label for SECOND.",
        },
      },
      instructions:
        "You are given FIRST and SECOND, two short texts that sit one above the other on a screen. Return true when FIRST introduces, names or summarises SECOND, so a reader would expect FIRST to look like a heading or label and SECOND to look like body text. Return false when FIRST and SECOND are peers (two list items, two sentences of one paragraph, two options, two buttons) or when either is a control label. Judge only the words; no layout information is provided.",
    },
    source: {
      line: 7,
      path: `${AUDIT}/hierarchy-size-contrast.md`,
      repo: "mblode/agent-skills",
    },
    thresholds: { act: 0.75, review: 0.4 },
    title: "Two roles told apart by a small size step alone",
    unit: ["class-list", "element"],
  }),
  rule({
    categoryId: "typographic-detail",
    // tabular-nums inherits and the unit sees only its own classes, so a
    // table-level class reads as a miss: review-only until ancestors reach it.
    check: (unit) => {
      if (unit.context.role !== "cell" || !/\d/.test(unit.text)) {
        return none;
      }
      const classes = unit.classes ?? [];
      return classes.some(
        (c) => c.endsWith("tabular-nums") || c.includes("tnum")
      )
        ? none
        : hit(`numeric cell "${unit.text}" without tabular-nums`);
    },
    hint: "Add tabular-nums (font-variant-numeric) to numeric columns so digits share one width and align.",
    id: "typography-numeric-cell-proportional-figures",
    source: {
      line: 7,
      path: `${AUDIT}/opentype-tabular-figures.md`,
      repo: "mblode/agent-skills",
    },
    status: "review-only",
    title: "Numbers in a table cell without tabular figures",
    unit: ["class-list"],
  }),
  rule({
    categoryId: "type-hierarchy",
    // Three or more emphasis axes changed at once: weight, caps, colour, size,
    // italic. A muted colour quiets the element and is not an axis.
    check: (unit) => {
      const t = needTypography(unit);
      if (!needText(unit)) {
        return none;
      }
      const axes = [
        (t.fontWeight ?? 400) >= 600,
        t.uppercase === true,
        t.colourClasses.some((c) => !isMutedColour(c)),
        (t.fontSizePx ?? 16) >= 24,
        t.italic === true,
      ].filter(Boolean).length;
      return axes >= 3
        ? hit(
            `${axes} emphasis axes at once (${describe(t)}${t.colourClasses.length ? `, ${t.colourClasses.join(" ")}` : ""})`
          )
        : none;
    },
    hint: "Change one axis at a time. Emphasis is relative, so quieten the competition before making the winner louder.",
    id: "typography-stacked-emphasis",
    source: {
      line: 7,
      path: `${AUDIT}/hierarchy-weight-contrast.md`,
      repo: "mblode/agent-skills",
    },
    title: "Bold, caps, colour and size stacked on one element",
    unit: ["class-list", "element"],
  }),
  rule({
    categoryId: "reading-comfort",
    check: (unit) => {
      const t = needTypography(unit);
      if (!t.uppercase || !needText(unit)) {
        return none;
      }
      return (t.letterSpacingEm ?? 0) <= 0 ? hit(describe(t)) : none;
    },
    hint: "Add 0.05 to 0.2em of tracking to uppercase text (tracking-wide or tracking-wider), more when it is small.",
    id: "typography-uppercase-without-tracking",
    source: {
      line: 7,
      path: `${AUDIT}/spacing-letterspacing-uppercase.md`,
      repo: "mblode/agent-skills",
    },
    title: "Uppercase text with no added letter-spacing",
    unit: ["class-list", "element"],
  }),
  rule({
    categoryId: "machine-prose",
    // One sentence over 25 words; the count happens here, never in Jev.
    check: (unit) => {
      const long = unit.text
        .split(/(?<=[.!?])\s+/u)
        .map((s) => [s, countWords(s)] as const)
        .filter(([, n]) => n > 25);
      if (long.length === 0) {
        return none;
      }
      const [sentence, n] = long[0];
      return hit(
        `${n} words: "${sentence.slice(0, 80)}${sentence.length > 80 ? "..." : ""}"`
      );
    },
    hint: 'Break at the strongest claim. More than one "and" or "but" usually marks the split.',
    id: "copywriting-long-sentence",
    preconditions: {
      docType: [
        "tutorial",
        "howto",
        "reference",
        "explanation",
        "lesson",
        "marketing",
        "ui",
        "unknown",
      ],
      notInCode: true,
    },
    source: {
      line: 7,
      path: "skills/docs-writing/rules/clarity-one-idea-per-sentence.md",
      repo: "mblode/agent-skills",
    },
    title: "Sentence over 25 words",
    unit: ["paragraph", "jsx-text"],
  }),
];
