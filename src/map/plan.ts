// Decide which rules apply to which units and build one Jev job per unit.

import { LineIndex } from "../extract/units.js";
import { matchesAny } from "../lib/glob.js";
import { estimateTokens, charsPerTokenFor } from "../lib/tokens.js";
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
import { buildState, STATE_TOKEN_CAP } from "./state.js";

export interface JevJob {
  unit: Unit;
  /** Rules whose question must be asked for this unit, with candidate evidence. */
  rules: { rule: Rule; hit?: MechanicalHit }[];
}

export interface Plan {
  mechanical: Finding[];
  jobs: JevJob[];
  unknowns: Unknown[];
  eligible: Map<string, Set<string>>;
  negatives: Map<string, Set<string>>;
  skipped: Map<string, Record<string, string>>;
}

// Rendered units come from a URL, not a file, so only the unit kind gates them.
const inScope = (rule: Rule, unit: Unit): boolean =>
  unit.kind === "element" ||
  (matchesAny(unit.file, rule.scope.include) &&
    !matchesAny(unit.file, rule.scope.exclude));

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
  const eligible = new Map<string, Set<string>>();
  const negatives = new Map<string, Set<string>>();
  const skipped = new Map<string, Record<string, string>>();
  const mechanical: Finding[] = [];
  const jobs: JevJob[] = [];
  const unknowns: Unknown[] = [];
  for (const unit of units) {
    if (unit.kind === "file") {
      continue;
    }
    const skippedRules: Record<string, string> = {};
    skipped.set(unit.id, skippedRules);
    const candidates = rules.filter((r) => {
      if (!inScope(r, unit) || !r.unit.includes(unit.kind)) {
        skippedRules[r.id] = "out_of_scope";
        return false;
      }
      return true;
    });
    if (candidates.length === 0) {
      continue;
    }
    const job: JevJob = { rules: [], unit };
    for (const rule of candidates) {
      if (!passesPreconditions(rule, unit, config)) {
        skippedRules[rule.id] = "precondition";
        continue;
      }
      const applied = eligible.get(unit.id) ?? new Set<string>();
      applied.add(rule.id);
      eligible.set(unit.id, applied);
      if (
        rule.tier === "jev" &&
        rule.question?.context?.includes("section") &&
        (!unit.context.section || buildState(unit, [rule]).truncated)
      ) {
        unknowns.push({
          file: unit.file,
          line: unit.line,
          reason: unit.context.section
            ? "Section comparison exceeds the context budget"
            : "Missing section context",
          ruleId: rule.id,
          unitId: unit.id,
        });
        continue;
      }
      const writingKeys = [
        "writingFacts",
        "writingProfile",
        "writingInstructions",
      ] as const;
      const requiredWriting = writingKeys.filter((key) =>
        rule.question?.context?.includes(key)
      );
      if (requiredWriting.length) {
        const missing = requiredWriting.filter((key) => !unit.context[key]);
        const total = [
          unit.text,
          ...writingKeys.map((key) => unit.context[key] ?? ""),
        ].join("\n");
        if (
          missing.length ||
          estimateTokens(total, charsPerTokenFor(unit.kind)) >
            STATE_TOKEN_CAP - 200
        ) {
          unknowns.push({
            file: unit.file,
            line: unit.line,
            reason: missing.length
              ? `Missing explicit writing context: ${missing.join(", ")}`
              : "Writing comparison exceeds the context budget",
            ruleId: rule.id,
            unitId: unit.id,
          });
          continue;
        }
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
        const ids = negatives.get(unit.id) ?? new Set<string>();
        ids.add(rule.id);
        negatives.set(unit.id, ids);
        continue;
      }
      if (
        rule.question?.context?.includes("section") &&
        unit.context.dynamic &&
        (unit.kind === "jsx-text" || unit.kind === "attr-string")
      ) {
        unknowns.push({
          file: unit.file,
          line: unit.line,
          reason: "Dynamic text may supply the missing explanation or action",
          ruleId: rule.id,
          unitId: unit.id,
        });
        continue;
      }
      if (
        rule.question?.context?.includes("section") &&
        (!unit.context.section || buildState(unit, [rule]).truncated)
      ) {
        unknowns.push({
          file: unit.file,
          line: unit.line,
          reason: unit.context.section
            ? "Section comparison exceeds the context budget"
            : "Missing section context",
          ruleId: rule.id,
          unitId: unit.id,
        });
        continue;
      }
      if (
        unit.kind === "source" &&
        rule.question &&
        buildState(unit, [rule]).truncated
      ) {
        unknowns.push({
          file: unit.file,
          line: unit.line,
          reason: "Source exceeds the semantic context budget",
          ruleId: rule.id,
          unitId: unit.id,
        });
        continue;
      }
      if (rule.tier === "mechanical") {
        mechanical.push(mechanicalFinding(rule, unit, hit));
      } else {
        job.rules.push({ hit, rule });
      }
    }
    if (job.rules.length > 0) {
      const contextual = job.rules.filter(({ rule }) =>
        rule.question?.context?.includes("section")
      );
      const local = job.rules.filter(
        ({ rule }) => !rule.question?.context?.includes("section")
      );
      if (local.length) {
        jobs.push({ ...job, rules: local });
      }
      for (const candidate of contextual) {
        jobs.push({ ...job, rules: [candidate] });
      }
    }
  }
  return { eligible, jobs, mechanical, negatives, skipped, unknowns };
};
