import type { JevJob } from "../map/plan.js";
import type { Band, Finding, Rule } from "../types.js";
import { toFinding } from "./finding.js";

export const band = (
  probability: number,
  thresholds: Rule["thresholds"]
): Band => {
  if (probability >= thresholds.act) {
    return "act";
  }
  if (probability >= thresholds.review) {
    return "review";
  }
  return "silent";
};

// Turn Jev answers into findings. Silent answers produce nothing.
export const jevFindings = (
  jobs: JevJob[],
  answers: Map<string, Record<string, number>>
): { findings: Finding[]; silent: { ruleId: string; unitId: string }[] } => {
  const findings: Finding[] = [];
  const silent: { ruleId: string; unitId: string }[] = [];
  for (const job of jobs) {
    const unitAnswers = answers.get(job.unit.id) ?? {};
    for (const { rule, hit } of job.rules) {
      const p = unitAnswers[rule.id];
      if (p === undefined) {
        continue;
      }
      let b = band(p, rule.thresholds);
      if (b === "act" && rule.status === "review-only") {
        b = "review";
      }
      if (b === "silent") {
        silent.push({ ruleId: rule.id, unitId: job.unit.id });
        continue;
      }
      findings.push(toFinding(rule, job.unit, p, b, hit?.evidence));
    }
  }
  return { findings, silent };
};
