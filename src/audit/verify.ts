import type { ScanReport } from "../scan/report.js";
import { hash, object, readJson } from "../scan/storage.js";
import {
  artifactAt,
  auditObserver,
  auditPolicy,
  auditText,
  invalidAudit,
} from "./input.js";
import { AUDIT_EVIDENCE_KINDS } from "./types.js";
import type { AuditLens, AuditRecord } from "./types.js";

export const verifyAudit = (
  before: ScanReport,
  after: ScanReport,
  file: string
): ScanReport => {
  if (
    !before.audit ||
    !after.audit ||
    before.status !== "complete" ||
    after.status !== "complete" ||
    before.signature !== after.signature ||
    before.root !== after.root ||
    hash(auditPolicy(before.audit)) !== hash(auditPolicy(after.audit))
  ) {
    return invalidAudit(
      "Verification needs complete before/after page audits of the same root, page state, viewport, brief and policy."
    );
  }
  if (
    Date.parse(after.audit.capturedAt) <= Date.parse(before.audit.capturedAt) ||
    before.audit.evidenceHash === after.audit.evidenceHash ||
    hash(before.audit.artifacts) === hash(after.audit.artifacts)
  ) {
    return invalidAudit(
      "Verification needs a fresh after capture with changed evidence artifacts."
    );
  }
  for (const audit of [before.audit, after.audit]) {
    for (const artifact of audit.artifacts) {
      if (
        artifactAt(audit.directory, artifact.path, artifact.kind).sha256 !==
        artifact.sha256
      ) {
        return invalidAudit(
          "Saved audit artifacts have changed. Keep before/after evidence in separate directories and capture again."
        );
      }
    }
  }
  const raw = readJson(file);
  if (
    !object(raw) ||
    raw.version !== 1 ||
    raw.beforeEvidenceHash !== before.audit.evidenceHash ||
    raw.afterEvidenceHash !== after.audit.evidenceHash ||
    !Array.isArray(raw.checks)
  ) {
    return invalidAudit(
      "Verification must name the current beforeEvidenceHash and afterEvidenceHash and include checks."
    );
  }
  const observer = auditObserver(raw.observer);
  const visible = new Set(before.reporting.visible);
  const old = new Map(
    before.findings
      .filter(
        (f) => visible.has(f.fingerprint) && f.decision?.status !== "dismissed"
      )
      .map((f) => [f.fingerprint, f])
  );
  const current = new Set(after.findings.map((f) => f.fingerprint));
  const checked = new Set<string>();
  const checks: NonNullable<AuditRecord["verification"]>["checks"] =
    raw.checks.map((item) => {
      if (!object(item)) {
        return invalidAudit("Every verification check must be an object.");
      }
      const fingerprint = auditText(item.fingerprint, "finding fingerprint");
      const finding = old.get(fingerprint);
      if (!finding || checked.has(fingerprint)) {
        return invalidAudit(
          "Verification references an unknown or duplicate finding."
        );
      }
      checked.add(fingerprint);
      if (!["passed", "failed", "unknown"].includes(String(item.outcome))) {
        return invalidAudit("Check outcome must be passed, failed or unknown.");
      }
      const outcome = item.outcome as "passed" | "failed" | "unknown";
      const procedure = auditText(item.procedure, "procedure");
      if (procedure !== finding.audit?.verification) {
        return invalidAudit(
          "Repeat the original finding's verification procedure exactly."
        );
      }
      const observed = auditText(item.observed, "observed result");
      const preserved = auditText(item.preserved, "preserved behavior");
      if (!Array.isArray(item.artifacts) || !item.artifacts.length) {
        return invalidAudit("Every check needs an after evidence artifact.");
      }
      const artifacts = item.artifacts.map((ref) => {
        const relative = auditText(ref, "verification artifact");
        const declared = after.audit!.artifacts.find(
          (a) => a.path === relative
        );
        if (!declared) {
          return invalidAudit(
            "Verification artifacts must be declared in the after audit."
          );
        }
        // All declared artifacts were checked once before processing checks.
        return { ...declared };
      });
      if (outcome === "passed") {
        const kinds = AUDIT_EVIDENCE_KINDS[finding.audit!.lens as AuditLens];
        if (
          !kinds ||
          !artifacts.some(
            (a) =>
              kinds.includes(a.kind) &&
              !before.audit!.artifacts.some(
                (prior) => prior.sha256 === a.sha256
              )
          )
        ) {
          return invalidAudit(
            "A passed check needs fresh after evidence of the appropriate kind for this lens."
          );
        }
      }
      if (outcome === "passed" && current.has(fingerprint)) {
        return invalidAudit(
          "A finding still reported by the after audit cannot be marked passed."
        );
      }
      return {
        artifacts,
        fingerprint,
        observed,
        outcome,
        preserved,
        procedure,
      };
    });
  if (checked.size !== old.size) {
    return invalidAudit(
      "Record passed, failed or unknown for every visible before finding; omitted checks cannot count as repairs."
    );
  }
  const verified = new Set(
    checks.filter((c) => c.outcome === "passed").map((c) => c.fingerprint)
  );
  const out = structuredClone(after);
  out.audit!.verification = {
    afterEvidenceHash: after.audit.evidenceHash,
    beforeEvidenceHash: before.audit.evidenceHash,
    checks,
    observer,
  };
  const existing = new Set(out.resolved.map((f) => f.fingerprint));
  for (const [id, finding] of old) {
    if (!current.has(id) && !existing.has(id)) {
      out.resolved.push({ ...finding, lifecycle: "unverified" });
    }
  }
  for (const finding of out.resolved) {
    finding.lifecycle = verified.has(finding.fingerprint)
      ? "resolved"
      : "unverified";
  }
  out.summary.resolved = out.resolved.filter(
    (f) => f.lifecycle === "resolved"
  ).length;
  out.summary.unverified = out.resolved.filter(
    (f) => f.lifecycle === "unverified"
  ).length;
  out.exitCode = checks.some((check) => check.outcome !== "passed")
    ? 2
    : out.summary.failing > 0
      ? 1
      : 0;
  return out;
};
