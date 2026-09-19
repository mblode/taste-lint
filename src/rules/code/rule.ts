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
import { CATEGORY_BY_ID } from "../taxonomy.js";
import { scopeFor } from "../validate-sections.js";
import { DEFAULT_THRESHOLDS, tierOf } from "../validate.js";

export interface CodeRuleSpec {
  id: string;
  title: string;
  categoryId: string;
  source: RuleSource;
  unit: UnitKind[];
  severity?: Severity;
  /** Only when the unit kinds do not say which files (see scopeFor). */
  scope?: { include?: string[]; exclude?: string[] };
  preconditions?: Rule["preconditions"];
  status?: Rule["status"];
  hint: string;
  check: (unit: Unit) => MechanicalHit;
  /** Present when the check is a candidate filter and Jev decides (`tier: both`). */
  question?: Question;
  thresholds?: Rule["thresholds"];
}

export const codeRule = (spec: CodeRuleSpec, module: string): Rule => {
  const file = `code:${module}`;
  const category = CATEGORY_BY_ID.get(spec.categoryId);
  if (!category) {
    throw new Error(
      `Invalid rule ${file}: unknown categoryId ${spec.categoryId}`
    );
  }
  return {
    categoryId: spec.categoryId,
    check: spec.check,
    domain: category.domain as Rule["domain"],
    file,
    fix: { hint: spec.hint },
    handWritten: [],
    id: spec.id,
    preconditions: spec.preconditions,
    question: spec.question,
    scope: scopeFor(file, spec.unit, spec.scope),
    severity: spec.severity ?? "minor",
    source: spec.source,
    status: spec.status ?? (spec.question ? "review-only" : "active"),
    thresholds: spec.thresholds ?? { ...DEFAULT_THRESHOLDS },
    tier: tierOf(spec.check, spec.question),
    title: spec.title,
    unit: spec.unit,
  };
};
