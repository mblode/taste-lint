// Build a Finding from a rule and a unit. Severity comes from the rule; the
// band and probability come from the caller.

import { LineIndex } from "../extract/units.js";
import type { Band, Finding, Rule, Unit } from "../types.js";

export const toFinding = (
  rule: Rule,
  unit: Unit,
  probability: number,
  b: Band,
  candidateEvidence?: string
): Finding => ({
  band: b,
  categoryId: rule.categoryId,
  column: unit.column,
  domain: rule.domain,
  endColumn: unit.endColumn,
  endLine: unit.endLine,
  evidence: candidateEvidence
    ? `${candidateEvidence}; p=${probability.toFixed(2)}`
    : `p=${probability.toFixed(2)}`,
  file: unit.file,
  fixHint: rule.fix.hint,
  line: unit.line,
  message: rule.title,
  probability,
  ruleId: rule.id,
  ...(rule.review ? { review: rule.review } : {}),
  severity: rule.severity,
  suppressed: false,
  tier: rule.tier,
  unitId: unit.id,
});

// A source unit spans a file or a window of one, so a finding with a match
// offset (into `unit.text`) points at the match line, not the unit's start.
export const atOffset = (
  finding: Finding,
  unit: Unit,
  offset: number | undefined
): Finding => {
  if (unit.kind !== "source" || offset === undefined) {
    return finding;
  }
  const at = new LineIndex(unit.text).positionAt(offset);
  const line = unit.line + at.line - 1;
  const column = at.line === 1 ? unit.column + at.column - 1 : at.column;
  return { ...finding, column, endColumn: column, endLine: line, line };
};
