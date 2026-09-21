export const AUDIT_LENSES = [
  "ui",
  "typography",
  "copywriting",
  "interaction",
  "motion",
  "seo",
] as const;
export type AuditLens = (typeof AUDIT_LENSES)[number];
export const ARTIFACT_KINDS = [
  "screenshot",
  "styles",
  "dom",
  "document",
  "interaction",
  "motion",
  "source",
] as const;
export interface AuditArtifact {
  path: string;
  kind: (typeof ARTIFACT_KINDS)[number];
  sha256: string;
}
export const AUDIT_EVIDENCE_KINDS: Record<AuditLens, AuditArtifact["kind"][]> =
  {
    copywriting: ["dom", "document", "screenshot"],
    interaction: ["interaction"],
    motion: ["motion"],
    seo: ["document"],
    typography: ["styles", "screenshot"],
    ui: ["screenshot"],
  };
export interface AuditEvidence {
  artifact: string;
  observation: string;
  quote?: string;
}
export interface AuditProposal {
  id: string;
  lens: AuditLens;
  region: string;
  problem: string;
  consequence: string;
  correction: string;
  preserve: string;
  verification: string;
  evidence: AuditEvidence[];
  unresolved?: string;
  source?: { file: string; line: number };
}
export interface PageAudit {
  version: 1;
  page: {
    url: string;
    state: string;
    viewport: { width: number; height: number };
  };
  brief: {
    purpose: string;
    audience: string;
    character: string;
    constraints: string[];
  };
  observer: { kind: "agent" | "human"; name: string };
  capturedAt: string;
  artifacts: AuditArtifact[];
  reviews: {
    lens: AuditLens;
    status: "reviewed" | "not-assessed" | "not-applicable";
    summary: string;
    artifacts: string[];
  }[];
  proposals: AuditProposal[];
  capture?: string;
  document?: string;
}
export interface AuditRecord extends PageAudit {
  directory: string;
  evidenceHash: string;
  coverage: {
    lens: AuditLens;
    status: PageAudit["reviews"][number]["status"];
    summary: string;
    evaluated: number;
    unknown: number;
    findings: number;
  }[];
  verification?: {
    beforeEvidenceHash: string;
    afterEvidenceHash: string;
    observer: PageAudit["observer"];
    checks: {
      fingerprint: string;
      outcome: "passed" | "failed" | "unknown";
      procedure: string;
      observed: string;
      preserved: string;
      artifacts: AuditArtifact[];
    }[];
  };
}

export interface AuditUnitContext {
  lens: string;
  proposalId?: string;
  region: string;
  missing?: string;
}
