import { normaliseText } from "../extract/units.js";
import { InputError } from "../lib/errors.js";
import type { Finding, LintResult, Unit } from "../types.js";
import type { ScanProfile } from "./profiles.js";
import { hash, object, readJson } from "./storage.js";

export interface ScanFinding extends Finding {
  fingerprint: string;
  excerpt: string;
  lifecycle: "new" | "existing" | "resolved" | "unverified";
  decision?: { status: "dismissed" | "accepted" | "open"; reason: string };
  origin: "taste-lint" | "dependency-cruiser";
}
export interface ScanReport {
  version: 1;
  kind: "taste-lint-scan";
  root: string;
  diagnostics: string[];
  architecture?: { contentHash: string; modules: number; incomplete: boolean };
  signature: string;
  profile: ScanProfile;
  files: string[];
  status: LintResult["status"];
  findings: ScanFinding[];
  resolved: ScanFinding[];
  unknowns: LintResult["unknowns"];
  coverage: LintResult["coverage"];
  usage: LintResult["usage"];
  estimated: LintResult["estimated"];
  reporting: { since?: string; visible: string[] };
  summary: {
    total: number;
    new: number;
    existing: number;
    dismissed: number;
    resolved: number;
    unverified: number;
    visible: number;
    failing: number;
    review: number;
    unknown: number;
  };
  exitCode: number;
}
export const identify = (findings: Finding[], units: Unit[]): ScanFinding[] => {
  const byId = new Map(units.map((u) => [u.id, u]));
  const occurrences = new Map<string, number>();
  return findings.map((finding) => {
    const unit = byId.get(finding.unitId);
    const text =
      unit?.kind === "source"
        ? (unit.text.split("\n")[finding.line - 1] ?? finding.evidence)
        : (unit?.text ?? finding.evidence);
    const key = hash([
      finding.ruleId,
      finding.file,
      unit?.kind,
      normaliseText(text),
    ]);
    const occurrence = occurrences.get(key) ?? 0;
    occurrences.set(key, occurrence + 1);
    return {
      ...finding,
      excerpt: text.slice(0, 1200),
      fingerprint: hash([key, occurrence]),
      lifecycle: "new",
      origin: "taste-lint",
    };
  });
};
export const readReport = (file: string): ScanReport => {
  const raw = readJson(file);
  if (
    !object(raw) ||
    raw.kind !== "taste-lint-scan" ||
    raw.version !== 1 ||
    typeof raw.signature !== "string" ||
    typeof raw.root !== "string" ||
    !["complete", "incomplete", "dry-run"].includes(String(raw.status)) ||
    !Array.isArray(raw.findings) ||
    !Array.isArray(raw.files) ||
    !object(raw.profile) ||
    !object(raw.reporting) ||
    !Array.isArray(raw.reporting.visible) ||
    !raw.reporting.visible.every((id) => typeof id === "string") ||
    !raw.files.every((item) => typeof item === "string") ||
    new Set(raw.findings.map((f) => (object(f) ? f.fingerprint : undefined)))
      .size !== raw.findings.length ||
    !raw.findings.every(
      (f) =>
        object(f) &&
        typeof f.fingerprint === "string" &&
        /^[a-f0-9]{64}$/.test(f.fingerprint) &&
        typeof f.file === "string" &&
        typeof f.ruleId === "string" &&
        typeof f.excerpt === "string" &&
        typeof f.fixHint === "string" &&
        Number.isInteger(f.line) &&
        Number.isInteger(f.endLine) &&
        typeof f.message === "string"
    )
  ) {
    throw new InputError(
      "INVALID_SCAN_REPORT",
      "Expected a version 1 taste-lint scan report."
    );
  }
  return raw as unknown as ScanReport;
};
export type Decisions = Record<
  string,
  { status: "dismissed" | "accepted" | "open"; reason: string }
>;
export const readDecisions = (file?: string, signature?: string): Decisions => {
  if (!file) {
    return {};
  }
  const raw = readJson(file);
  if (!object(raw) || raw.version !== 1 || !object(raw.decisions)) {
    throw new InputError(
      "INVALID_DECISIONS",
      "Expected version 1 decisions with a decisions map."
    );
  }
  if (signature && raw.signature !== signature) {
    throw new InputError(
      "INCOMPATIBLE_DECISIONS",
      "Review decisions belong to a different scan policy. Review them again for this profile and rule set."
    );
  }
  for (const [key, value] of Object.entries(raw.decisions)) {
    if (
      !/^[a-f0-9]{64}$/.test(key) ||
      !object(value) ||
      !["dismissed", "accepted", "open"].includes(String(value.status)) ||
      typeof value.reason !== "string" ||
      !value.reason.trim()
    ) {
      throw new InputError(
        "INVALID_DECISIONS",
        "Every decision needs a fingerprint, accepted/dismissed status, and reason."
      );
    }
  }
  return raw.decisions as Decisions;
};
export const reconcile = (
  current: ScanFinding[],
  previous: ScanReport | undefined,
  complete: boolean,
  unknowns: LintResult["unknowns"],
  decisions: Decisions
): ScanFinding[] => {
  const old = new Map(previous?.findings.map((f) => [f.fingerprint, f]));
  const ids = new Set(current.map((f) => f.fingerprint));
  for (const finding of current) {
    finding.lifecycle = old.has(finding.fingerprint) ? "existing" : "new";
    finding.decision =
      decisions[finding.fingerprint] ?? old.get(finding.fingerprint)?.decision;
  }
  return [...old.values()]
    .filter((f) => !ids.has(f.fingerprint))
    .map((f) => ({
      ...f,
      lifecycle:
        complete &&
        !unknowns.some((u) => u.file === f.file && u.ruleId === f.ruleId)
          ? "resolved"
          : "unverified",
    }));
};
export const renderScan = (report: ScanReport, limit = 20): string => {
  const visible = new Set(report.reporting.visible);
  const groups = new Map<string, ScanFinding[]>();
  for (const finding of report.findings.filter((f) =>
    visible.has(f.fingerprint)
  )) {
    const list = groups.get(finding.ruleId) ?? [];
    list.push(finding);
    groups.set(finding.ruleId, list);
  }
  const ranked = [...groups.values()].toSorted(
    (a, b) =>
      Number(b[0].band === "act") - Number(a[0].band === "act") ||
      b.length - a.length ||
      a[0].ruleId.localeCompare(b[0].ruleId)
  );
  const s = report.summary;
  const coverage = Object.values(report.coverage?.byRule ?? {});
  return [
    `${report.profile.name}: ${report.status}; ${report.files.length} files`,
    `${s.visible} visible checks (${s.failing} failing, ${s.review} review); ${s.total} total; ${s.dismissed} dismissed; ${s.unknown} unknown`,
    ...report.diagnostics,
    `Rule coverage: ${coverage.filter((r) => r.eligible === 0).length} with no applicable inputs; ${coverage.filter((r) => r.eligible > 0 && r.negative === r.eligible).length} with all applicable checks negative; ${coverage.filter((r) => r.pending > 0).length} with pending evaluations`,
    `${s.new} new; ${s.existing} existing; ${s.resolved} resolved; ${s.unverified} unverified`,
    ...ranked
      .slice(0, limit)
      .map(
        (group) =>
          `${group[0].ruleId}: ${group.length} checks in ${new Set(group.map((f) => f.file)).size} files\n  ${group[0].file}:${group[0].line} ${group[0].message}\n  ${group[0].fixHint}`
      ),
    ...(ranked.length > limit
      ? [
          `${ranked.length - limit} further rule groups are available in the JSON report.`,
        ]
      : []),
    ...(report.estimated
      ? [
          `Estimated live work: ${report.estimated.requests} requests, $${report.estimated.costUsd.toFixed(4)}`,
        ]
      : []),
    "",
  ].join("\n");
};
