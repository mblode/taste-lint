import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { InputError } from "../lib/errors.js";
import { hash, object, readJson } from "../scan/storage.js";
import { ARTIFACT_KINDS, AUDIT_EVIDENCE_KINDS, AUDIT_LENSES } from "./types.js";
import type {
  AuditArtifact,
  AuditEvidence,
  AuditProposal,
  AuditRecord,
  PageAudit,
} from "./types.js";

export const invalidAudit = (message: string): never => {
  throw new InputError("INVALID_PAGE_AUDIT", message);
};
const record = (value: unknown, label: string): Record<string, unknown> =>
  object(value) ? value : invalidAudit(`${label} must be an object.`);
export const auditText = (value: unknown, label: string): string =>
  typeof value === "string" && value.trim() && value.length <= 20_000
    ? value
    : invalidAudit(
        `${label} must be nonempty text of at most 20000 characters.`
      );
const timestamp = (value: unknown): string => {
  const text = auditText(value, "capturedAt");
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      text
    ) ||
    !Number.isFinite(Date.parse(text))
  ) {
    invalidAudit("capturedAt must be an ISO timestamp with a timezone.");
  }
  return text;
};
const list = (value: unknown, label: string): unknown[] =>
  Array.isArray(value) && value.length <= 200
    ? value
    : invalidAudit(`${label} must be a list of at most 200 items.`);
const texts = (value: unknown, label: string): string[] =>
  list(value, label).map((v) => auditText(v, label));
const choice = <T extends string>(
  value: unknown,
  choices: readonly T[],
  label: string
): T =>
  typeof value === "string" && choices.includes(value as T)
    ? (value as T)
    : invalidAudit(`Invalid ${label}: choose ${choices.join(", ")}.`);
const positive = (value: unknown, label: string): number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : invalidAudit(`${label} must be a positive integer.`);
export const auditObserver = (raw: unknown): PageAudit["observer"] => {
  const value = record(raw, "observer");
  return {
    kind: choice(value.kind, ["agent", "human"], "observer kind"),
    name: auditText(value.name, "observer name"),
  };
};

// Resolve real paths, including symlinks, before reading any external input.
export const auditFile = (base: string, relative: string): string => {
  if (path.isAbsolute(relative)) {
    invalidAudit(
      "Evidence paths must be relative to their audit directory; source paths to the repository."
    );
  }
  try {
    const root = fs.realpathSync(base);
    const file = fs.realpathSync(path.resolve(root, relative));
    const rel = path.relative(root, file);
    if (
      !rel ||
      rel.startsWith(`..${path.sep}`) ||
      rel === ".." ||
      path.isAbsolute(rel)
    ) {
      invalidAudit(`Evidence escapes its root: ${relative}`);
    }
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size > 25_000_000) {
      invalidAudit(`Evidence must be a file smaller than 25 MB: ${relative}`);
    }
    return file;
  } catch (error) {
    if (error instanceof InputError) {
      throw error;
    }
    return invalidAudit(`Cannot read evidence file: ${relative}`);
  }
};
export const artifactAt = (
  base: string,
  relative: string,
  kind: AuditArtifact["kind"]
): AuditArtifact => ({
  kind,
  path: relative,
  sha256: createHash("sha256")
    .update(fs.readFileSync(auditFile(base, relative)))
    .digest("hex"),
});

export const readAudit = (
  file: string,
  root: string
): { audit: PageAudit; directory: string } => {
  const directory = path.dirname(path.resolve(file));
  const raw = record(
    readJson(auditFile(directory, path.basename(file))),
    "audit"
  );
  if (raw.version !== 1) {
    invalidAudit("Expected version 1 page audit.");
  }
  const p = record(raw.page, "page");
  const viewport = record(p.viewport, "viewport");
  const url = auditText(p.url, "page URL");
  try {
    const parsed = new URL(url);
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password
    ) {
      invalidAudit("Use an HTTP(S) page URL without embedded credentials.");
    }
  } catch {
    invalidAudit("Use an HTTP(S) page URL without embedded credentials.");
  }
  const brief = record(raw.brief, "brief");
  const capturedAt = timestamp(raw.capturedAt);
  const artifacts = list(raw.artifacts, "artifacts").map((item) => {
    const a = record(item, "artifact");
    return artifactAt(
      directory,
      auditText(a.path, "artifact path"),
      choice(a.kind, ARTIFACT_KINDS, "artifact kind")
    );
  });
  const byPath = new Map(artifacts.map((a) => [a.path, a]));
  if (byPath.size !== artifacts.length) {
    invalidAudit("Artifact paths must be unique.");
  }
  const refs = (value: unknown): string[] =>
    texts(value, "artifact references").map((ref) => {
      if (!byPath.has(ref)) {
        invalidAudit(`Undeclared artifact: ${ref}`);
      }
      return ref;
    });
  const reviews = list(raw.reviews, "reviews").map((item) => {
    const r = record(item, "review");
    const status = choice(
      r.status,
      ["reviewed", "not-assessed", "not-applicable"],
      "review status"
    );
    const evidence = refs(r.artifacts);
    const lens = choice(r.lens, AUDIT_LENSES, "lens");
    if (status === "reviewed" && !evidence.length) {
      invalidAudit("A reviewed lens needs an evidence artifact.");
    }
    if (
      status === "reviewed" &&
      !evidence.some((ref) =>
        AUDIT_EVIDENCE_KINDS[lens].includes(byPath.get(ref)!.kind)
      )
    ) {
      invalidAudit(
        `A reviewed ${lens} lens needs ${AUDIT_EVIDENCE_KINDS[lens].join(" or ")} evidence.`
      );
    }
    return {
      artifacts: evidence,
      lens,
      status,
      summary: auditText(r.summary, "review summary"),
    };
  });
  if (new Set(reviews.map((r) => r.lens)).size !== reviews.length) {
    invalidAudit("Each lens may appear only once in reviews.");
  }
  const proposals = list(raw.proposals, "proposals").map(
    (item): AuditProposal => {
      const r = record(item, "proposal");
      const id = auditText(r.id, "proposal ID");
      if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id)) {
        invalidAudit("Proposal IDs must be short kebab-case identifiers.");
      }
      const lens = choice(r.lens, AUDIT_LENSES, "lens");
      if (
        !reviews.some(
          (review) => review.lens === lens && review.status === "reviewed"
        )
      ) {
        invalidAudit(`Proposal ${id} needs a reviewed ${lens} lens.`);
      }
      const evidence = list(r.evidence, "proposal evidence").map(
        (observation): AuditEvidence => {
          const e = record(observation, "evidence");
          const artifact = auditText(e.artifact, "artifact reference");
          refs([artifact]);
          const quote =
            e.quote === undefined ? undefined : auditText(e.quote, "quote");
          if (byPath.get(artifact)?.kind !== "screenshot") {
            if (
              !quote ||
              !fs
                .readFileSync(auditFile(directory, artifact), "utf-8")
                .includes(quote)
            ) {
              invalidAudit(
                `A text observation needs a verbatim quote in ${artifact}.`
              );
            }
          } else if (quote !== undefined) {
            invalidAudit(
              "Screenshots carry observer descriptions, not verified text quotes."
            );
          }
          return {
            artifact,
            observation: auditText(e.observation, "observation"),
            quote,
          };
        }
      );
      let source: AuditProposal["source"];
      if (r.source !== undefined) {
        const s = record(r.source, "source");
        source = {
          file: auditText(s.file, "source file"),
          line: positive(s.line, "source line"),
        };
        const text = fs.readFileSync(auditFile(root, source.file), "utf-8");
        if (source.line > text.split("\n").length) {
          invalidAudit(`Source line is outside ${source.file}.`);
        }
      }
      return {
        consequence: auditText(r.consequence, "consequence"),
        correction: auditText(r.correction, "correction"),
        evidence,
        id,
        lens,
        preserve: auditText(r.preserve, "preserve"),
        problem: auditText(r.problem, "problem"),
        region: auditText(r.region, "region"),
        source,
        unresolved:
          r.unresolved === undefined
            ? undefined
            : auditText(r.unresolved, "unresolved evidence"),
        verification: auditText(r.verification, "verification"),
      };
    }
  );
  if (
    new Set(proposals.map((proposal) => proposal.id)).size !== proposals.length
  ) {
    invalidAudit("Proposal IDs must be unique.");
  }
  const artifact = (
    name: "capture" | "document",
    kind: AuditArtifact["kind"]
  ) => {
    if (raw[name] === undefined) {
      return;
    }
    const ref = auditText(raw[name], name);
    if (byPath.get(ref)?.kind !== kind) {
      invalidAudit(`${name} must reference a declared ${kind} artifact.`);
    }
    return ref;
  };
  return {
    audit: {
      artifacts,
      brief: {
        audience: auditText(brief.audience, "audience"),
        character: auditText(brief.character, "character"),
        constraints: texts(brief.constraints, "constraints"),
        purpose: auditText(brief.purpose, "purpose"),
      },
      capture: artifact("capture", "styles"),
      capturedAt,
      document: artifact("document", "document"),
      observer: auditObserver(raw.observer),
      page: {
        state: auditText(p.state, "page state"),
        url,
        viewport: {
          height: positive(viewport.height, "viewport height"),
          width: positive(viewport.width, "viewport width"),
        },
      },
      proposals,
      reviews,
      version: 1,
    },
    directory,
  };
};

export const auditPolicy = (audit: PageAudit) => ({
  brief: audit.brief,
  page: audit.page,
});
export const auditHash = (audit: PageAudit): string => hash(audit);

// Saved reports must remain readable without the original evidence directory.
export const savedAudit = (value: unknown): AuditRecord => {
  const a = record(value, "saved audit");
  auditText(a.directory, "evidence directory");
  const page = record(a.page, "saved page");
  const viewport = record(page.viewport, "saved viewport");
  auditText(page.url, "saved URL");
  auditText(page.state, "saved state");
  positive(viewport.width, "viewport width");
  positive(viewport.height, "viewport height");
  const brief = record(a.brief, "saved brief");
  for (const key of ["purpose", "audience", "character"]) {
    auditText(brief[key], key);
  }
  texts(brief.constraints, "constraints");
  auditObserver(a.observer);
  timestamp(a.capturedAt);
  if (
    a.version !== 1 ||
    typeof a.evidenceHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(a.evidenceHash)
  ) {
    invalidAudit("Invalid saved audit version or evidence hash.");
  }
  for (const item of list(a.artifacts, "saved artifacts")) {
    const artifact = record(item, "saved artifact");
    auditText(artifact.path, "artifact path");
    choice(artifact.kind, ARTIFACT_KINDS, "artifact kind");
    if (
      typeof artifact.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(artifact.sha256)
    ) {
      invalidAudit("Invalid artifact hash.");
    }
  }
  const coverage = list(a.coverage, "saved coverage");
  if (
    coverage.length !== AUDIT_LENSES.length ||
    new Set(coverage.map((c) => record(c, "coverage").lens)).size !==
      AUDIT_LENSES.length
  ) {
    invalidAudit("Saved audit needs coverage for every lens.");
  }
  for (const item of coverage) {
    const c = record(item, "coverage");
    choice(c.lens, AUDIT_LENSES, "lens");
    choice(
      c.status,
      ["reviewed", "not-assessed", "not-applicable"],
      "coverage status"
    );
    auditText(c.summary, "coverage summary");
    for (const key of ["evaluated", "unknown", "findings"]) {
      if (
        typeof c[key] !== "number" ||
        !Number.isSafeInteger(c[key]) ||
        c[key] < 0
      ) {
        invalidAudit("Invalid coverage count.");
      }
    }
  }
  list(a.reviews, "saved reviews");
  list(a.proposals, "saved proposals");
  return a as unknown as AuditRecord;
};
