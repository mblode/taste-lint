// Mechanical checks over units. Data rules (regex, phrases, absent) run
// through `runMechanical`; code rules carry their own `check` and share the
// helpers exported here. Everything that counts, compares or measures lives
// in this layer; Jev only sees text.

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

export const describe = (t?: ResolvedTypography): string => {
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

export const none: MechanicalHit = { evidence: "", fired: false };

export const hit = (evidence: string): MechanicalHit => ({
  evidence,
  fired: true,
});

// A check that cannot decide throws this; the planner records an abstention
// (`unknown`), never a pass or a fail.
export class UnresolvedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnresolvedError";
  }
}

export const needTypography = (unit: Unit): ResolvedTypography => {
  if (!unit.typography) {
    throw new UnresolvedError("no class list");
  }
  return unit.typography;
};

export const countWords = (sentence: string): number =>
  sentence.split(/[ \t\n\r\f\v]+/u).filter(Boolean).length;

// A resolved size, or `undefined` when the element inherits. A size class
// that could not be resolved is an abstention, not a guess.
export const sizeOrAbstain = (t: ResolvedTypography): number | undefined => {
  if (t.fontSizePx === undefined) {
    if (t.unresolved.some((c) => c.startsWith("text-"))) {
      throw new UnresolvedError(`unresolved ${t.unresolved.join(" ")}`);
    }
    return undefined;
  }
  return t.fontSizePx;
};

// Typography checks judge text; an element with classes and no text of its
// own (an icon wrapper) is not theirs to judge.
export const needText = (unit: Unit): boolean => unit.text.trim().length > 0;

// The utility without its variant prefixes, split outside brackets, so
// `hover:ease-in` counts as `ease-in`.
export const baseClass = (cls: string): string => {
  let depth = 0;
  let cut = 0;
  for (let i = 0; i < cls.length; i += 1) {
    const ch = cls[i];
    if (ch === "[") {
      depth += 1;
    } else if (ch === "]") {
      depth -= 1;
    } else if (ch === ":" && depth === 0) {
      cut = i + 1;
    }
  }
  return cls.slice(cut);
};

// A data rule's regex or phrase list over the unit's text, with code spans
// masked. `absent` turns "has A" into "has A and never B".
export const runMechanical = (
  mechanical: Mechanical,
  unit: Unit
): MechanicalHit => {
  const text = maskCodeSpans(unit.text, unit.codeSpans);
  const minMatches = mechanical.minMatches ?? 1;
  const matches: { text: string; offset: number }[] = [];
  if (mechanical.regex) {
    const flags = mechanical.flags ?? "gu";
    const re = new RegExp(
      mechanical.regex,
      flags.includes("g") ? flags : `${flags}g`
    );
    for (const m of text.matchAll(re)) {
      matches.push({ offset: m.index ?? 0, text: m[0] });
    }
  }
  if (mechanical.phrases) {
    for (const m of text.matchAll(phraseRegex(mechanical.phrases))) {
      matches.push({ offset: m.index ?? 0, text: m[0] });
    }
  }
  if (matches.length < minMatches) {
    return none;
  }
  if (
    mechanical.absent &&
    new RegExp(mechanical.absent, mechanical.flags ?? "gu").test(text)
  ) {
    return none;
  }
  const shown = matches
    .slice(0, 3)
    .map((m) => JSON.stringify(m.text.replaceAll(/\s+/gu, " ").slice(0, 80)))
    .join(", ");
  return {
    evidence: `${matches.length} match${matches.length === 1 ? "" : "es"}: ${shown}`,
    fired: true,
    offset: Math.min(...matches.map((m) => m.offset)),
  };
};
