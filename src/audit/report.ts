import type { ScanFinding } from "../scan/report.js";
import { hash } from "../scan/storage.js";
import type { LintResult, Rule, Unit } from "../types.js";
import { auditHash, auditPolicy } from "./input.js";
import { AUDIT_LENSES } from "./types.js";
import type { AuditRecord, PageAudit } from "./types.js";

export const describeAuditFindings = (
  audit: PageAudit,
  findings: ScanFinding[],
  units: Unit[]
): void => {
  const byId = new Map(units.map((u) => [u.id, u]));
  for (const finding of findings) {
    const context = byId.get(finding.unitId)?.context.audit;
    const proposal = audit.proposals.find((p) => p.id === context?.proposalId);
    finding.audit = {
      consequence: proposal?.consequence,
      lens: context?.lens ?? "seo",
      preserve: proposal?.preserve ?? audit.brief.character,
      proposalId: proposal?.id,
      region: context?.region ?? "document",
      verification:
        proposal?.verification ??
        `Repeat the same page state and viewport. ${finding.fixHint}`,
    };
    if (proposal) {
      finding.fingerprint = hash([
        auditPolicy(audit),
        finding.ruleId,
        proposal.id,
      ]);
      finding.message = proposal.problem;
      finding.fixHint = proposal.correction;
      finding.evidence = proposal.evidence
        .map((e) => `${e.artifact}: ${e.observation}`)
        .join("\n");
    }
  }
};

export const auditRecord = (
  audit: PageAudit,
  directory: string,
  result: LintResult,
  rules: Rule[],
  findings: ScanFinding[]
): AuditRecord => ({
  ...audit,
  coverage: AUDIT_LENSES.map((lens) => {
    const review = audit.reviews.find((r) => r.lens === lens);
    const domain = lens === "ui" ? "craft" : lens;
    const ids = new Set(
      rules.filter((r) => r.domain === domain).map((r) => r.id)
    );
    return {
      evaluated: Object.entries(result.coverage?.byRule ?? {})
        .filter(([id]) => ids.has(id))
        .reduce((n, [, c]) => n + c.answered, 0),
      findings: findings.filter((f) => ids.has(f.ruleId)).length,
      lens,
      status: review?.status ?? "not-assessed",
      summary: review?.summary ?? "No observations supplied for this lens.",
      unknown: result.unknowns.filter((u) => ids.has(u.ruleId)).length,
    };
  }),
  directory,
  evidenceHash: auditHash(audit),
});

export const renderAuditRegion = (findings: ScanFinding[]): string => {
  const groups = new Map<string, ScanFinding[]>();
  for (const finding of findings) {
    const key = JSON.stringify([
      finding.ruleId,
      finding.message,
      finding.fixHint,
      finding.audit?.preserve,
      finding.audit?.verification,
    ]);
    const repeated = groups.get(key) ?? [];
    repeated.push(finding);
    groups.set(key, repeated);
  }
  const lines = [...groups.values()].map((related) => {
    const f = related[0];
    return `  ${f.message}${related.length > 1 ? ` (${related.length} related findings)` : ""}\n  ${f.audit?.consequence ?? f.evidence}\n  Change: ${f.fixHint}\n  Preserve: ${f.audit?.preserve}\n  Verify: ${f.audit?.verification}`;
  });
  return `${findings[0].audit?.region ?? "document"}: ${findings.length} findings\n${lines.join("\n")}`;
};
