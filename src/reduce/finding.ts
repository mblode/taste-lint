// Build a Finding from a rule and a unit. Severity comes from the rule; the
// band and probability come from the caller.

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
  severity: rule.severity,
  suppressed: false,
  tier: rule.tier,
  unitId: unit.id,
});
