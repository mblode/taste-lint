// Mechanical checks over units. Data rules (regex, phrases, absent) run
// through `runMechanical`; code rules carry their own `check` and share the
// helpers exported here. Everything that counts, compares or measures lives
// in this layer; Jev only sees text.

import { parseSync } from "oxc-parser";

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
// (`unknown`), never a pass or a fail. `perRun` marks a reason that holds for
// the whole repository (a missing report), so the planner records it once and
// skips the rule quietly on every later unit.
export class UnresolvedError extends Error {
  readonly perRun: boolean;

  constructor(message: string, options: { perRun?: boolean } = {}) {
    super(message);
    this.name = "UnresolvedError";
    this.perRun = options.perRun ?? false;
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

interface LiteralNode {
  type?: string;
  start?: number;
  end?: number;
  value?: unknown;
}

// Spans of string and template text, and comments, in a JS or TS source. A
// source that does not parse yields none, so the rule sees the raw text.
const literalSpans = (file: string, text: string): [number, number][] => {
  const parsed = parseSync(file, text);
  if (parsed.errors.length) {
    return [];
  }
  const spans: [number, number][] = parsed.comments.map((c) => [
    c.start,
    c.end,
  ]);
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const child of value) {
        visit(child);
      }
      return;
    }
    if (!value || typeof value !== "object") {
      return;
    }
    const node = value as LiteralNode;
    const start = node.start ?? 0;
    if (node.type === "Literal" && typeof node.value === "string") {
      // Keep the quotes: a rule may match the opening one.
      spans.push([start + 1, (node.end ?? start) - 1]);
    } else if (node.type === "TemplateElement") {
      // The span includes the backtick or brace before the raw text.
      const raw = (node.value as { raw?: string } | undefined)?.raw ?? "";
      spans.push([start + 1, start + 1 + raw.length]);
    }
    for (const [key, child] of Object.entries(node)) {
      if (key !== "parent") {
        visit(child);
      }
    }
  };
  visit(parsed.program);
  return spans;
};

// A data rule's regex or phrase list over the unit's text, with code spans
// masked. `absent` turns "has A" into "has A and never B". `codeOnly` also
// masks strings and comments in a source unit, so a test file that quotes
// `it.only(` in a fixture string never fires.
export const runMechanical = (
  mechanical: Mechanical,
  unit: Unit
): MechanicalHit => {
  const text = maskCodeSpans(
    unit.text,
    mechanical.codeOnly && unit.kind === "source"
      ? [...unit.codeSpans, ...literalSpans(unit.file, unit.text)]
      : unit.codeSpans
  );
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
