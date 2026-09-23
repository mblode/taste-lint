// Browser port of the CLI's data-rule matcher (`runMechanical` and
// `phraseRegex` in src/reduce/mechanical.ts). The CLI module imports
// node:crypto through its unit extractor, so it cannot ship to the browser;
// the matching logic below is copied line for line and the rule data comes
// from data/rules through scripts/generate-rules.mjs. Keep the two in step.
import type { Mechanical } from "../../../src/types.js";
import snapshot from "./rules.generated.json" with { type: "json" };

export interface PlaygroundRule {
  decidedBy: "jev" | "mechanical";
  fix: string;
  id: string;
  mechanical: Mechanical;
  title: string;
}

export interface Match {
  end: number;
  start: number;
}

export interface Finding {
  evidence: string;
  /** 1-based line in the pasted text; one line is one unit. */
  line: number;
  matches: Match[];
  rule: PlaygroundRule;
  text: string;
}

export const PLAYGROUND_RULES = snapshot.playground as PlaygroundRule[];

const escapeRegExp = (s: string): string =>
  s.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");

const phraseRegex = (phrases: string[]): RegExp =>
  new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${phrases.map(escapeRegExp).join("|")})(?![\\p{L}\\p{N}])`,
    "giu"
  );

const runMechanical = (mechanical: Mechanical, text: string) => {
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
    return null;
  }
  if (
    mechanical.absent &&
    new RegExp(mechanical.absent, mechanical.flags ?? "gu").test(text)
  ) {
    return null;
  }
  const shown = matches
    .slice(0, 3)
    .map((m) => JSON.stringify(m.text.replaceAll(/\s+/gu, " ").slice(0, 80)))
    .join(", ");
  return {
    evidence: `${matches.length} match${matches.length === 1 ? "" : "es"}: ${shown}`,
    matches: matches
      .filter((m) => m.text.length > 0)
      .map((m) => ({ end: m.offset + m.text.length, start: m.offset }))
      .toSorted((a, b) => a.start - b.start),
  };
};

/** Every playground rule over every non-empty line, in line order. */
export const lintCopy = (
  input: string,
  rules: PlaygroundRule[] = PLAYGROUND_RULES
): Finding[] => {
  const findings: Finding[] = [];
  const lines = input.split(/\r?\n/u);
  for (const [index, raw] of lines.entries()) {
    const text = raw.replaceAll(/\s+/gu, " ").trim();
    if (!text) {
      continue;
    }
    for (const rule of rules) {
      const hit = runMechanical(rule.mechanical, text);
      if (hit) {
        findings.push({ ...hit, line: index + 1, rule, text });
      }
    }
  }
  return findings;
};

/** Split a line into plain and matched pieces for highlighting. */
export const splitMatches = (
  text: string,
  matches: Match[]
): { marked: boolean; text: string }[] => {
  const pieces: { marked: boolean; text: string }[] = [];
  let cursor = 0;
  for (const { start, end } of matches) {
    if (start < cursor) {
      continue;
    }
    if (start > cursor) {
      pieces.push({ marked: false, text: text.slice(cursor, start) });
    }
    pieces.push({ marked: true, text: text.slice(start, end) });
    cursor = end;
  }
  if (cursor < text.length) {
    pieces.push({ marked: false, text: text.slice(cursor) });
  }
  return pieces;
};

const RULE_SOURCE = "https://github.com/mblode/taste-lint/blob/main/data/rules";

/** The rule's YAML file; the domain is the id's first segment. */
export const ruleSourceUrl = (id: string): string =>
  `${RULE_SOURCE}/${id.split("-")[0]}/${id}.yaml`;
