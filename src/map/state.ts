// Build the Jev state string for a unit from only the context keys the
// batched questions asked for. Numbers never enter the state.

import { charsPerTokenFor, estimateTokens } from "../lib/tokens.js";
import type { ContextKey, Rule, Unit } from "../types.js";

export const STATE_TOKEN_CAP = 1500;
const SOURCE_TOKEN_CAP = 6000;

export const buildState = (
  unit: Unit,
  rules: Rule[]
): { state: string; truncated: boolean } => {
  const keys = new Set<ContextKey>();
  for (const rule of rules) {
    for (const key of rule.question?.context ?? []) {
      keys.add(key);
    }
  }
  const lines: string[] = [];
  let truncated = false;
  const perToken = charsPerTokenFor(unit.kind);
  const budgetFor = (label: string): number =>
    Math.max(
      0,
      (unit.kind === "source" ? SOURCE_TOKEN_CAP : STATE_TOKEN_CAP) -
        estimateTokens(lines.join("\n"), perToken) -
        estimateTokens(label, perToken)
    );
  const clip = (label: string, value: string): string => {
    const budget = budgetFor(label);
    if (estimateTokens(value, perToken) <= budget) {
      return value;
    }
    truncated = true;
    return `${value.slice(0, Math.max(0, Math.floor(budget * perToken)))} [truncated]`;
  };
  if (keys.has("neighbours") && unit.neighbours?.next) {
    lines.push(
      `FIRST: ${clip("FIRST: ", unit.text)}`,
      `SECOND: ${clip("SECOND: ", unit.neighbours.next.text)}`
    );
  } else {
    lines.push(`TEXT: ${clip("TEXT: ", unit.text)}`);
  }
  if (keys.has("headingAbove") && unit.context.headingAbove) {
    lines.push(`HEADING: ${clip("HEADING: ", unit.context.headingAbove)}`);
  }
  if (keys.has("docType")) {
    lines.push(`DOC TYPE: ${unit.context.docType}`);
  }
  if (keys.has("element") && unit.context.element) {
    lines.push(
      `ELEMENT: ${unit.context.element}${unit.context.attr ? ` (${unit.context.attr})` : ""}`
    );
  }
  if (keys.has("role")) {
    lines.push(`ROLE: ${unit.context.role}`);
  }
  if (keys.has("section") && unit.context.section) {
    lines.push(`SECTION: ${clip("SECTION: ", unit.context.section)}`);
  }
  for (const [key, label] of [
    ["writingFacts", "SUPPLIED FACTS"],
    ["writingProfile", "VOICE PROFILE"],
    ["writingInstructions", "DRAFTING INSTRUCTIONS"],
  ] as const) {
    if (keys.has(key) && unit.context[key]) {
      lines.push(`${label}: ${clip(`${label}: `, unit.context[key]!)}`);
    }
  }
  return { state: lines.join("\n"), truncated };
};
