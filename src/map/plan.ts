// Decide which rules apply to which units and build one Jev job per unit.

import { matchesAny } from "../lib/glob.js";
import { runMechanical, UnresolvedError } from "../reduce/mechanical.js";
import type {
  Config,
  Finding,
  MechanicalHit,
  Rule,
  Severity,
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
  /** Units that matched at least one rule's scope and kind. */
  consideredUnits: number;
}

// Rendered units come from a URL, not a file, so only the unit kind gates them.
const inScope = (rule: Rule, unit: Unit): boolean =>
  unit.kind === "element" ||
  (matchesAny(unit.file, rule.scope.include) &&
    !matchesAny(unit.file, rule.scope.exclude ?? []));

export const severityFor = (rule: Rule, file: string): Severity => {
  for (const override of rule.severityOverrides ?? []) {
    if (matchesAny(file, [override.scope])) {
      return override.severity;
    }
  }
  return rule.severity;
};

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

export const mechanicalFinding = (
  rule: Rule,
  unit: Unit,
  hit: MechanicalHit,
  config: Config
): Finding => ({
  band: rule.status === "review-only" ? "review" : "act",
  categoryId: rule.categoryId,
  column: unit.column,
  domain: rule.domain,
  endColumn: unit.endColumn,
  endLine: unit.endLine,
  evidence: hit.evidence,
  file: unit.file,
  fixHint: rule.fix.hint,
  fixMode: rule.fix.mode,
  line: unit.line,
  message: rule.title,
  probability: 1,
  ruleId: rule.id,
  severity: severityFor(rule, unit.file),
  suppressed: false,
  tier: rule.tier,
  unitId: unit.id,
  ...(config ? {} : {}),
});

export const planRequests = (
  units: Unit[],
  rules: Rule[],
  config: Config
): Plan => {
  const mechanical: Finding[] = [];
  const jobs: JevJob[] = [];
  const unknowns: Unknown[] = [];
  let consideredUnits = 0;
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
    consideredUnits += 1;
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
        hit = runMechanical(
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
        mechanical.push(mechanicalFinding(rule, unit, hit, config));
      } else {
        job.rules.push({ hit, rule });
      }
    }
    if (job.rules.length > 0) {
      jobs.push(job);
    }
  }
  return { consideredUnits, jobs, mechanical, unknowns };
};
