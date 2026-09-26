// Decide which rules apply to which units and build one Jev job per unit.

import { LineIndex, makeUnit } from "../extract/units.js";
import { matchesAny } from "../lib/glob.js";
import { toFinding } from "../reduce/finding.js";
import { runMechanical, UnresolvedError } from "../reduce/mechanical.js";
import { isCandidateRule } from "../rules/review.js";
import type {
  Config,
  Finding,
  MechanicalHit,
  Rule,
  Unit,
  Unknown,
} from "../types.js";
import { missingEvidence } from "./evidence.js";
import { buildState } from "./state.js";

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

const WORD = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

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
  if (p.notGenerated && unit.context.generated) {
    return false;
  }
  if (p.docType && !p.docType.includes(unit.context.docType)) {
    return false;
  }
  if (p.role && !p.role.includes(unit.context.role)) {
    return false;
  }
  // Words, not whitespace tokens: "/ seat / month" is two words.
  if (p.minWords && (unit.text.match(WORD)?.length ?? 0) < p.minWords) {
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

// p = 1 describes the mechanical match. Raw-source candidates never act.
// A source unit spans the file, so the finding points at the first match.
export const mechanicalFinding = (
  rule: Rule,
  unit: Unit,
  hit: MechanicalHit
): Finding => {
  const candidate = isCandidateRule(rule);
  const finding = {
    ...toFinding(
      rule,
      unit,
      1,
      candidate || rule.status === "review-only" ? "review" : "act"
    ),
    evidence: candidate
      ? `Candidate pattern: ${hit.evidence}. This match does not establish a defect.`
      : hit.evidence,
    ...(candidate
      ? {
          assessment: "candidate" as const,
          fixHint: "Confirm applicability and exceptions before changing code.",
          message: `Inspect: ${rule.title}`,
        }
      : {}),
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

// A whole file too long for one question is judged on the lines around the
// candidate match instead of abstaining. The window keeps the file's unit id,
// so its answer counts for the file; its line is where the window starts.
const WINDOW_CHARS = 12_000;
export const windowAround = (
  unit: Unit,
  rule: Rule,
  offset: number
): Unit | undefined => {
  for (
    let half = WINDOW_CHARS / 2;
    half >= 1500;
    half = Math.floor(half * 0.75)
  ) {
    const from = unit.text.lastIndexOf("\n", Math.max(0, offset - half)) + 1;
    const next = unit.text.indexOf(
      "\n",
      Math.min(unit.text.length, offset + half)
    );
    const to = next === -1 ? unit.text.length : next;
    const window: Unit = {
      ...makeUnit(unit.file, new LineIndex(unit.text), {
        context: unit.context,
        kind: "source",
        sourceEnd: to,
        sourceStart: from,
        text: unit.text.slice(from, to),
      }),
      id: unit.id,
    };
    if (!missingEvidence(window, rule)) {
      return window;
    }
  }
  return undefined;
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
      if (rule.tier === "jev") {
        const reason = missingEvidence(unit, rule);
        if (reason) {
          unknowns.push({
            file: unit.file,
            line: unit.line,
            reason,
            ruleId: rule.id,
            unitId: unit.id,
          });
          continue;
        }
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
      const reason = missingEvidence(unit, rule);
      if (reason) {
        const window =
          rule.tier === "both" &&
          unit.kind === "source" &&
          hit.offset !== undefined
            ? windowAround(unit, rule, hit.offset)
            : undefined;
        if (window) {
          jobs.push({ rules: [{ hit, rule }], unit: window });
          continue;
        }
        unknowns.push({
          file: unit.file,
          line: unit.line,
          reason,
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
        if (
          buildState(
            unit,
            local.map(({ rule }) => rule)
          ).truncated
        ) {
          for (const candidate of local) {
            jobs.push({ ...job, rules: [candidate] });
          }
        } else {
          jobs.push({ ...job, rules: local });
        }
      }
      for (const candidate of contextual) {
        jobs.push({ ...job, rules: [candidate] });
      }
    }
  }
  return { eligible, jobs, mechanical, negatives, skipped, unknowns };
};
