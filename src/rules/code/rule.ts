// The one constructor every code rule goes through: fills the defaults a YAML
// rule would carry and attaches the check.

import type {
  MechanicalHit,
  Question,
  Rule,
  RuleSource,
  Severity,
  Unit,
  UnitKind,
} from "../../types.js";

export interface CodeRuleSpec {
  id: string;
  title: string;
  categoryId: string;
  domain: Rule["domain"];
  source: RuleSource;
  unit: UnitKind[];
  severity?: Severity;
  severityOverrides?: Rule["severityOverrides"];
  scope?: Rule["scope"];
  preconditions?: Rule["preconditions"];
  related?: string[];
  status?: Rule["status"];
  hint: string;
  check: (unit: Unit) => MechanicalHit;
  /** Present when the check is a candidate filter and Jev decides (`tier: both`). */
  question?: Question;
  thresholds?: Rule["thresholds"];
}

const COMPONENT_SCOPE: Rule["scope"] = {
  exclude: ["**/*.test.*", "**/*.spec.*", "**/*.stories.*"],
  include: ["**/*.tsx", "**/*.jsx"],
};

export const codeRule = (spec: CodeRuleSpec, module: string): Rule => ({
  categoryId: spec.categoryId,
  check: spec.check,
  domain: spec.domain,
  file: `code:${module}`,
  fix: { hint: spec.hint, mode: "none" },
  handWritten: [],
  id: spec.id,
  preconditions: spec.preconditions,
  question: spec.question,
  related: spec.related,
  scope: spec.scope ?? COMPONENT_SCOPE,
  severity: spec.severity ?? "minor",
  severityOverrides: spec.severityOverrides,
  source: spec.source,
  status: spec.status ?? (spec.question ? "review-only" : "active"),
  thresholds: spec.thresholds ?? { act: 0.7, review: 0.35 },
  tier: spec.question ? "both" : "mechanical",
  title: spec.title,
  unit: spec.unit,
});
