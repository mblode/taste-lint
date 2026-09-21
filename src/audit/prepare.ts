import fs from "node:fs";

import { Repository } from "../analysis/repository.js";
import type { CaptureResult } from "../extract/capture.js";
import { extractSource } from "../extract/index.js";
import { extractCapture } from "../extract/rendered.js";
import { parseCaptureInput } from "../extract/style-capture-text.js";
import { LineIndex, makeUnit } from "../extract/units.js";
import { hash } from "../scan/storage.js";
import type { Config, Rule, Unit } from "../types.js";
import { auditFile, auditPolicy, invalidAudit, readAudit } from "./input.js";
import { AUDIT_EVIDENCE_KINDS } from "./types.js";

const renderedRegion = (capture: CaptureResult, id: string): string => {
  let element = capture.elements[id];
  const visited = new Set<string>();
  while (element && !visited.has(element.id)) {
    visited.add(element.id);
    if (
      /^(section|article|main|nav|header|footer|dialog|body)$/i.test(
        element.tagName
      )
    ) {
      return (
        element.attributes["aria-label"] ??
        (element.attributes.id
          ? `${element.tagName}#${element.attributes.id}`
          : element.selector)
      );
    }
    element = capture.elements[element.parentId ?? ""];
  }
  return "page";
};

export const auditRules = (rules: Rule[]): Rule[] =>
  rules.filter(
    (rule) =>
      rule.unit.includes("audit") ||
      rule.unit.includes("element") ||
      (rule.domain === "seo" &&
        rule.scope.include.some((glob) => /\.html?$/.test(glob)))
  );

export const prepareAudit = (file: string, config: Config) => {
  const { audit, directory } = readAudit(file, config.root);
  const label = hash(auditPolicy(audit)).slice(0, 16);
  const artifacts = new Map(audit.artifacts.map((a) => [a.path, a]));
  const units: Unit[] = [];
  if (audit.capture) {
    let capture;
    try {
      capture = parseCaptureInput(
        fs.readFileSync(auditFile(directory, audit.capture), "utf-8")
      );
    } catch (error) {
      return invalidAudit(
        `Cannot parse the declared style capture: ${error instanceof Error ? error.message : "invalid capture"}. Recapture with the packaged capture helper.`
      );
    }
    if (
      !capture.metadata ||
      capture.metadata.url !== audit.page.url ||
      capture.metadata.state !== audit.page.state ||
      capture.metadata.viewport?.width !== audit.page.viewport.width ||
      capture.metadata.viewport?.height !== audit.page.viewport.height ||
      capture.metadata.capturedAt !== audit.capturedAt
    ) {
      invalidAudit(
        "Capture URL, state, viewport and timestamp must match the audited page. Use the packaged capture helper."
      );
    }
    if (
      capture.order.some(
        (id) => typeof capture.elements[id]?.visible !== "boolean"
      )
    ) {
      invalidAudit(
        "Page audits need per-element visibility evidence. Recapture with the packaged capture helper."
      );
    }
    const visibleCapture = {
      ...capture,
      elements: Object.fromEntries(
        Object.entries(capture.elements).map(([id, element]) => [
          id,
          element.visible ? element : { ...element, text: "" },
        ])
      ),
    };
    for (const unit of extractCapture(visibleCapture, label)) {
      unit.context.audit = {
        lens: "typography",
        region: renderedRegion(capture, capture.order[unit.line - 1]),
      };
      units.push(unit);
    }
  }
  if (audit.document) {
    const source = fs.readFileSync(
      auditFile(directory, audit.document),
      "utf-8"
    );
    const document = extractSource(
      config,
      `__taste_audit__/${label}.html`,
      source,
      new Repository(config.root, config.architecture)
    );
    for (const unit of document) {
      unit.context.audit = { lens: "seo", region: "document" };
    }
    units.push(...document);
  }
  for (const [i, proposal] of audit.proposals.entries()) {
    const evidence = proposal.evidence.map((e) => ({
      ...e,
      kind: artifacts.get(e.artifact)!.kind,
      sha256: artifacts.get(e.artifact)!.sha256,
    }));
    const missing =
      proposal.unresolved ??
      (!evidence.some((e) =>
        AUDIT_EVIDENCE_KINDS[proposal.lens].includes(e.kind)
      )
        ? `Missing ${proposal.lens} evidence: needs ${AUDIT_EVIDENCE_KINDS[proposal.lens].join(" or ")} observations`
        : undefined);
    const unit = makeUnit(
      proposal.source?.file ?? `__taste_audit__/${label}.audit`,
      new LineIndex(proposal.problem),
      {
        context: {
          audit: {
            lens: proposal.lens,
            missing,
            proposalId: proposal.id,
            region: proposal.region,
          },
          docType: "ui",
          role: "body",
          section: JSON.stringify({
            brief: audit.brief,
            consequence: proposal.consequence,
            evidence,
            observer: audit.observer,
            page: audit.page,
            preserve: proposal.preserve,
            problem: proposal.problem,
            recordType: "proposal",
          }),
        },
        kind: "audit",
        sourceEnd: proposal.problem.length,
        sourceStart: 0,
        text: proposal.problem,
      }
    );
    unit.id = hash([label, proposal.id]).slice(0, 16);
    unit.line = proposal.source?.line ?? i + 1;
    unit.endLine = unit.line;
    units.push(unit);
  }
  // Clean lens reviews are also judged. An observation-only audit can finish
  // without inventing a defect just to give the evaluator an input.
  for (const review of audit.reviews.filter(
    (r) =>
      r.status === "reviewed" && !audit.proposals.some((p) => p.lens === r.lens)
  )) {
    const unit = makeUnit(
      `__taste_audit__/${label}.audit`,
      new LineIndex(review.summary),
      {
        context: {
          audit: { lens: review.lens, region: `${review.lens} review` },
          docType: "ui",
          role: "body",
          section: JSON.stringify({
            artifacts: review.artifacts.map((ref) => artifacts.get(ref)),
            brief: audit.brief,
            observations: review.summary,
            observer: audit.observer,
            page: audit.page,
            recordType: "review",
          }),
        },
        kind: "audit",
        sourceEnd: review.summary.length,
        sourceStart: 0,
        text: review.summary,
      }
    );
    unit.id = hash([label, "review", review.lens]).slice(0, 16);
    units.push(unit);
  }
  return { audit, directory, units };
};
