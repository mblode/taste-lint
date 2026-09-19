// Mechanical checks: regexes, phrase lists and named functions over units.
// Everything that counts, compares or measures lives here; Jev only sees text.

import { maskCodeSpans } from "../extract/units.js";
import type {
  Mechanical,
  MechanicalHit,
  ResolvedTypography,
  Unit,
} from "../types.js";

const escapeRegExp = (s: string): string =>
  s.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");

const phraseRegex = (phrases: string[]): RegExp =>
  new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${phrases.map(escapeRegExp).join("|")})(?![\\p{L}\\p{N}])`,
    "giu"
  );

const describe = (t?: ResolvedTypography): string => {
  if (!t) {
    return "unresolved";
  }
  const parts: string[] = [];
  if (t.fontSizePx !== undefined) {
    parts.push(`${t.fontSizePx}px`);
  }
  if (t.fontWeight !== undefined) {
    parts.push(`weight ${t.fontWeight}`);
  }
  if (t.lineHeight !== undefined) {
    parts.push(`leading ${t.lineHeight}`);
  }
  if (t.letterSpacingEm !== undefined) {
    parts.push(`tracking ${t.letterSpacingEm}em`);
  }
  if (t.uppercase) {
    parts.push("uppercase");
  }
  return parts.join(", ") || "unresolved";
};

const none: MechanicalHit = { evidence: "", fired: false };

// Named functions return `fired` plus human evidence. `unknown` is signalled
// by throwing UnresolvedError so the planner can record an abstention.
export class UnresolvedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnresolvedError";
  }
}

export type MechanicalFunction = (unit: Unit) => MechanicalHit;

const needTypography = (unit: Unit): ResolvedTypography => {
  if (!unit.typography) {
    throw new UnresolvedError("no class list");
  }
  return unit.typography;
};

const countWords = (sentence: string): number =>
  sentence.split(/[ \t\n\r\f\v]+/u).filter(Boolean).length;

export const FUNCTIONS: Record<string, MechanicalFunction> = {
  // This element and its next text-bearing sibling both resolve a size,
  // Body-sized text below 15px, the phone floor from make-text-comfortable-to-read.
  bodyBelow15px: (unit) => {
    const t = needTypography(unit);
    if (t.fontSizePx === undefined) {
      if (t.unresolved.some((c) => c.startsWith("text-"))) {
        throw new UnresolvedError(`unresolved ${t.unresolved.join(" ")}`);
      }
      // No size class: the element inherits, which this rule cannot judge.
      return none;
    }
    if (
      unit.context.role !== "body" &&
      unit.context.role !== "list-item" &&
      unit.context.role !== "cell"
    ) {
      return none;
    }
    if (unit.text.split(" ").length < 6) {
      return none;
    }
    return t.fontSizePx < 15
      ? {
          evidence: `${describe(t)} on ${unit.text.split(" ").length} words of body text`,
          fired: true,
        }
      : none;
  },
  // Positive letter-spacing on lowercase body text.
  letterSpacedLowercaseBody: (unit) => {
    const t = needTypography(unit);
    if (t.letterSpacingEm === undefined) {
      return none;
    }
    if (t.uppercase) {
      return none;
    }
    if (unit.context.role === "heading" || unit.context.role === "button") {
      return none;
    }
    return t.letterSpacingEm > 0 &&
      (t.fontSizePx === undefined || t.fontSizePx >= 13)
      ? { evidence: describe(t), fired: true }
      : none;
  },
  // Weight 100 to 300 on text at or below 18px.
  lightWeightSmallBody: (unit) => {
    const t = needTypography(unit);
    if (t.fontWeight === undefined) {
      return none;
    }
    if (
      t.fontWeight <= 300 &&
      (t.fontSizePx === undefined || t.fontSizePx <= 18)
    ) {
      return { evidence: describe(t), fired: true };
    }
    return none;
  },
  // Body line height outside 1.4 to 1.65, or display line height above 1.2.
  lineHeightOutOfBand: (unit) => {
    const t = needTypography(unit);
    if (t.lineHeight === undefined || t.fontSizePx === undefined) {
      return none;
    }
    if (t.fontSizePx >= 32) {
      return t.lineHeight > 1.25
        ? { evidence: `${describe(t)} on display text`, fired: true }
        : none;
    }
    if (unit.context.role !== "body" && unit.context.role !== "list-item") {
      return none;
    }
    if (unit.text.split(" ").length < 8) {
      return none;
    }
    return t.lineHeight < 1.35 || t.lineHeight > 1.7
      ? { evidence: `${describe(t)} on running text`, fired: true }
      : none;
  },
  // weights match, and the ratio is above 1.0 and at most 1.2.
  nearEqualSizeSameWeight: (unit) => {
    const t = needTypography(unit);
    const next = unit.neighbours?.next?.typography;
    if (!next) {
      return none;
    }
    if (t.fontSizePx === undefined || next.fontSizePx === undefined) {
      if (
        [...t.unresolved, ...next.unresolved].some((c) => c.startsWith("text-"))
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
    if (ratio > 1 && ratio <= 1.2 && sameWeight) {
      return {
        evidence: `${describe(t)} over ${describe(next)}, ratio ${ratio.toFixed(2)}`,
        fired: true,
      };
    }
    return none;
  },
  // A numeric table cell whose class list does not request tabular figures.
  numericCellWithoutTabularFigures: (unit) => {
    if (unit.context.role !== "cell" || !/\d/.test(unit.text)) {
      return none;
    }
    const classes = unit.classes ?? [];
    if (classes.some((c) => c.endsWith("tabular-nums") || c.includes("tnum"))) {
      return none;
    }
    return {
      evidence: `numeric cell "${unit.text}" without tabular-nums`,
      fired: true,
    };
  },
  // One sentence over 25 words; the count happens here, never in Jev.
  sentenceOver25Words: (unit) => {
    const sentences = unit.text.split(/(?<=[.!?])\s+/u);
    const long = sentences
      .map((s) => [s, countWords(s)] as const)
      .filter(([, n]) => n > 25);
    if (long.length === 0) {
      return none;
    }
    const [sentence, n] = long[0];
    return {
      evidence: `${n} words: "${sentence.slice(0, 80)}${sentence.length > 80 ? "..." : ""}"`,
      fired: true,
      match: {
        end: unit.text.indexOf(sentence) + sentence.length,
        start: unit.text.indexOf(sentence),
        text: sentence,
      },
    };
  },
  // Three or more emphasis axes changed at once: weight, caps, colour, size, italic.
  stackedEmphasis: (unit) => {
    const t = needTypography(unit);
    const axes = [
      (t.fontWeight ?? 400) >= 600,
      t.uppercase === true,
      t.colourClasses.length > 0,
      (t.fontSizePx ?? 16) >= 24,
      t.italic === true,
    ].filter(Boolean).length;
    return axes >= 3
      ? {
          evidence: `${axes} emphasis axes at once (${describe(t)}${t.colourClasses.length ? `, ${t.colourClasses.join(" ")}` : ""})`,
          fired: true,
        }
      : none;
  },
  // Uppercase text with no positive tracking.
  uppercaseWithoutTracking: (unit) => {
    const t = needTypography(unit);
    if (!t.uppercase) {
      return none;
    }
    if ((t.letterSpacingEm ?? 0) <= 0) {
      return { evidence: describe(t), fired: true };
    }
    return none;
  },
};

export const runMechanical = (
  mechanical: Mechanical,
  unit: Unit
): MechanicalHit => {
  if (mechanical.function) {
    const fn = FUNCTIONS[mechanical.function];
    if (!fn) {
      throw new Error(`Unknown mechanical function ${mechanical.function}`);
    }
    return fn(unit);
  }
  const text = maskCodeSpans(unit.text, unit.codeSpans);
  const minMatches = mechanical.minMatches ?? 1;
  const matches: { start: number; end: number; text: string }[] = [];
  if (mechanical.regex) {
    const flags = mechanical.flags ?? "gu";
    const re = new RegExp(
      mechanical.regex,
      flags.includes("g") ? flags : `${flags}g`
    );
    for (const m of text.matchAll(re)) {
      matches.push({
        end: (m.index ?? 0) + m[0].length,
        start: m.index ?? 0,
        text: m[0],
      });
    }
  }
  if (mechanical.phrases) {
    for (const m of text.matchAll(phraseRegex(mechanical.phrases))) {
      matches.push({
        end: (m.index ?? 0) + m[0].length,
        start: m.index ?? 0,
        text: m[0],
      });
    }
  }
  if (matches.length < minMatches) {
    return none;
  }
  const first = matches[0];
  const shown = matches
    .slice(0, 3)
    .map((m) => JSON.stringify(m.text))
    .join(", ");
  return {
    evidence: `${matches.length} match${matches.length === 1 ? "" : "es"}: ${shown}`,
    fired: true,
    match: first,
  };
};
