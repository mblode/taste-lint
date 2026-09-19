// Build a Finding from a rule and a unit. Severity comes from the rule and its
// scope overrides; the band and probability come from the caller.

import { matchesAny } from "../lib/glob.js";
import type { Band, Finding, Rule, Severity, Unit } from "../types.js";

export const severityFor = (rule: Rule, file: string): Severity => {
  for (const override of rule.severityOverrides ?? []) {
    if (matchesAny(file, [override.scope])) {
      return override.severity;
    }
  }
  return rule.severity;
};

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
  fixMode: rule.fix.mode,
  line: unit.line,
  message: rule.title,
  probability,
  ruleId: rule.id,
  severity: severityFor(rule, unit.file),
  suppressed: false,
  tier: rule.tier,
  unitId: unit.id,
});
