// Decide which rules apply to which units and build one Jev job per unit.

import { LineIndex } from "../extract/units.js";
import { matchesAny } from "../lib/glob.js";
import { toFinding } from "../reduce/finding.js";
import { runMechanical, UnresolvedError } from "../reduce/mechanical.js";
import type {
  Config,
  Finding,
  MechanicalHit,
  Rule,
  Unit,
  Unknown,
} from "../types.js";

export interface JevJob {
  unit: Unit;
  /** Rules whose question must be asked for this unit, with candidate evidence. */
  rules: { rule: Rule; hit?: MechanicalHit }[];
}

export interface Plan {
  mechanical: Finding[];
  jobs: JevJob[];
  unknowns: Unknown[];
}

// Rendered units come from a URL, not a file, so only the unit kind gates them.
const inScope = (rule: Rule, unit: Unit): boolean =>
  unit.kind === "element" ||
  (matchesAny(unit.file, rule.scope.include) &&
    !matchesAny(unit.file, rule.scope.exclude ?? []));

const passesPreconditions = (
  rule: Rule,
  unit: Unit,
  config: Config
): boolean => {
  const p = rule.preconditions;
  if (!p) {
    return true;
  }
  if (p.notInCode && unit.inCode) {
    return false;
  }
  if (p.docType && !p.docType.includes(unit.context.docType)) {
    return false;
  }
  if (p.role && !p.role.includes(unit.context.role)) {
    return false;
  }
  if (
    p.element &&
    (!unit.context.element || !p.element.includes(unit.context.element))
  ) {
    return false;
  }
  if (
    p.smartQuotesAtBuild === false &&
    config.smartQuotesAtBuild &&
    (unit.kind === "paragraph" || unit.kind === "heading") &&
    /\.(md|mdx)$/.test(unit.file)
  ) {
    return false;
  }
  return true;
};

// A mechanical hit is certain (p = 1) and acts unless the rule is review-only.
// A source unit spans the file, so the finding points at the first match.
export const mechanicalFinding = (
  rule: Rule,
  unit: Unit,
  hit: MechanicalHit
): Finding => {
  const finding = {
    ...toFinding(
      rule,
      unit,
      1,
      rule.status === "review-only" ? "review" : "act"
    ),
    evidence: hit.evidence,
  };
  if (unit.kind === "source" && hit.offset !== undefined) {
    const at = new LineIndex(unit.text).positionAt(hit.offset);
    return {
      ...finding,
      column: at.column,
      endColumn: at.column,
      endLine: at.line,
      line: at.line,
    };
  }
  return finding;
};

export const planRequests = (
  units: Unit[],
  rules: Rule[],
  config: Config
): Plan => {
  const mechanical: Finding[] = [];
  const jobs: JevJob[] = [];
  const unknowns: Unknown[] = [];
  for (const unit of units) {
    if (unit.kind === "file") {
      continue;
    }
    const candidates = rules.filter(
      (r) => inScope(r, unit) && r.unit.includes(unit.kind)
    );
    if (candidates.length === 0) {
      continue;
    }
    const job: JevJob = { rules: [], unit };
    for (const rule of candidates) {
      if (!passesPreconditions(rule, unit, config)) {
        continue;
      }
      if (rule.tier === "jev") {
        job.rules.push({ rule });
        continue;
      }
      let hit: MechanicalHit;
      try {
        hit = rule.check
          ? rule.check(unit)
          : runMechanical(
              rule.mechanical as NonNullable<Rule["mechanical"]>,
              unit
            );
      } catch (error) {
        if (error instanceof UnresolvedError) {
          unknowns.push({
            file: unit.file,
            line: unit.line,
            reason: error.message,
            ruleId: rule.id,
            unitId: unit.id,
          });
          continue;
        }
        throw error;
      }
      if (!hit.fired) {
        continue;
      }
      if (rule.tier === "mechanical") {
        mechanical.push(mechanicalFinding(rule, unit, hit));
      } else {
        job.rules.push({ hit, rule });
      }
    }
    if (job.rules.length > 0) {
      jobs.push(job);
    }
  }
  return { jobs, mechanical, unknowns };
};
