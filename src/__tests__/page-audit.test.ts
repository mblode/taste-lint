import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { expect, it } from "vitest";

import { readAudit } from "../audit/input.js";
import { verifyAudit } from "../audit/verify.js";
import { ProviderError } from "../map/jev.js";
import { readReport, renderScan } from "../scan/report.js";
import { runScan } from "../scan/run.js";
import { writeJson } from "../scan/storage.js";
import { fakeEvaluate } from "./helpers.js";
import { fixture, repair } from "./page-audit-helpers.js";

it("judges all six lenses with the page brief, cited observations and a coherent repair export", async () => {
  const f = fixture();
  // Unrelated repository defects must not leak into a page audit.
  fs.writeFileSync(
    path.join(f.root, "unrelated.tsx"),
    'export const X=()=> <p className="transition-all">Something went wrong</p>;'
  );
  const evaluate = fakeEvaluate(() => 0.95);
  const { report } = await runScan(f.options, { evaluate });
  expect(report.status).toBe("complete");
  expect(report.findings).toHaveLength(6);
  expect(report.findings.every((finding) => finding.band === "review")).toBe(
    true
  );
  expect(
    report.findings.every((finding) => finding.audit?.region === "hero")
  ).toBe(true);
  expect(evaluate.calls).toHaveLength(6);
  expect(evaluate.calls[0].state).toContain("Choose a plan");
  expect(evaluate.calls[0].state).toContain("Quiet and direct");
  expect(evaluate.calls[0].state).toContain("sha256");
  expect(report.audit?.coverage.every((c) => c.status === "reviewed")).toBe(
    true
  );
  expect(renderScan(report)).toContain("hero: 6 findings");
  const again = await runScan(f.options, { evaluate });
  expect(again.report.usage.requests).toBe(0);
  const saved = path.join(f.root, "report.json");
  writeJson(saved, report);
  expect(readReport(saved).audit?.brief).toEqual(f.input.brief);
});

it("feeds rendered typography and full-document SEO through the existing rules", async () => {
  const f = fixture();
  writeJson(f.audit, {
    ...f.input,
    capture: "styles.json",
    document: "page.html",
  });
  const { report } = await runScan(f.options, {
    evaluate: fakeEvaluate((id) => (id.startsWith("typography-") ? 0.95 : 0)),
  });
  expect(
    report.findings.some(
      (finding) => finding.ruleId === "typography-body-below-15px"
    )
  ).toBe(true);
  expect(report.coverage?.byRule["seo-document-title"].eligible).toBe(1);
  expect(report.status).toBe("complete");
  fs.writeFileSync(
    path.join(f.directory, "page.html"),
    "<main>Fragment</main>"
  );
  writeJson(f.audit, { ...f.input, document: "page.html", proposals: [] });
  const partial = await runScan(f.options, { evaluate: fakeEvaluate(() => 0) });
  expect(partial.report.status).toBe("incomplete");
  expect(
    partial.report.unknowns.some((u) => u.reason.includes("complete HTML"))
  ).toBe(true);
});

it("judges clean reviews without inventing proposals and invalidates changed evidence", async () => {
  const f = fixture();
  const evaluate = fakeEvaluate(() => 0);
  writeJson(f.audit, { ...f.input, proposals: [] });
  const { report } = await runScan(f.options, { evaluate });
  expect(report.status).toBe("complete");
  expect(report.findings).toHaveLength(0);
  expect(evaluate.calls).toHaveLength(6);
  expect(
    evaluate.calls.every((call) =>
      String(call.state).includes('"recordType":"review"')
    )
  ).toBe(true);
  fs.appendFileSync(
    path.join(f.directory, "motion.txt"),
    " Motion check repeated."
  );
  const changed = await runScan(f.options, { evaluate });
  expect(changed.report.usage.requests).toBe(1);
  expect(changed.report.audit?.evidenceHash).not.toBe(
    report.audit?.evidenceHash
  );
  writeJson(f.audit, {
    ...f.input,
    proposals: [],
    reviews: f.input.reviews.map((review) =>
      review.lens === "motion"
        ? { ...review, artifacts: ["screen.png"] }
        : review
    ),
  });
  await expect(runScan(f.options, { evaluate })).rejects.toThrow(
    "reviewed motion lens needs motion"
  );
  await expect(
    runScan({ ...f.options, only: ["page-audit-ui"] }, { evaluate })
  ).rejects.toThrow("--only");
});

it("keeps provider failures unknown instead of returning a clean audit", async () => {
  const f = fixture();
  const { report } = await runScan(f.options, {
    evaluate: () => Promise.reject(new ProviderError("auth", 401)),
  });
  expect(report.status).toBe("incomplete");
  expect(report.exitCode).toBe(2);
  expect(report.findings).toHaveLength(0);
  expect(report.unknowns).toHaveLength(6);
  expect(report.audit?.coverage.every((lens) => lens.unknown === 1)).toBe(true);
});

it("consolidates repeated rendered findings within the same page region", async () => {
  const f = fixture();
  const file = path.join(f.directory, "styles.json");
  const capture = JSON.parse(fs.readFileSync(file, "utf-8"));
  capture.elements.e5 = {
    ...capture.elements.e3,
    id: "e5",
    selector: "main > p:nth-child(4)",
    text: "More running text that the visitor needs to read before choosing a plan for the team.",
  };
  capture.order.push("e5");
  capture.elements.e0.children.push("e5");
  writeJson(file, capture);
  writeJson(f.audit, { ...f.input, capture: "styles.json", proposals: [] });
  const { report } = await runScan(f.options, {
    evaluate: fakeEvaluate((id) =>
      id === "typography-body-below-15px" ? 0.95 : 0
    ),
  });
  const related = report.findings.filter(
    (finding) => finding.ruleId === "typography-body-below-15px"
  );
  expect(related).toHaveLength(2);
  expect(related.every((finding) => finding.audit?.region === "main")).toBe(
    true
  );
  expect(renderScan(report)).toContain("2 related findings");
  capture.elements.e5.visible = false;
  capture.elements.e2.visible = false;
  writeJson(file, capture);
  let nextText;
  let renderedTexts: string[] = [];
  await runScan(f.options, {
    evaluate: fakeEvaluate(() => 0),
    onEvidence: (units) => {
      renderedTexts = units
        .filter((unit) => unit.kind === "element")
        .map((unit) => unit.text);
      nextText = units.find((unit) => unit.text === "Notification rules")
        ?.neighbours?.next?.text;
    },
  });
  expect(nextText).toBe(capture.elements.e3.text);
  expect(renderedTexts).toContain(capture.elements.e3.text);
  expect(renderedTexts).not.toContain(capture.elements.e2.text);
  expect(renderedTexts).not.toContain(capture.elements.e5.text);
  delete capture.elements.e5.visible;
  writeJson(file, capture);
  await expect(
    runScan(f.options, { evaluate: fakeEvaluate(() => 1) })
  ).rejects.toThrow("visibility evidence");
});

it("keeps unsupported observations, missing lenses and oversized context incomplete", async () => {
  const f = fixture();
  const evaluate = fakeEvaluate(() => 0.95);
  writeJson(f.audit, {
    ...f.input,
    proposals: [
      {
        ...f.input.proposals[4],
        evidence: [
          {
            artifact: "screen.png",
            observation: "A screenshot cannot establish motion",
          },
        ],
      },
    ],
    reviews: f.input.reviews.filter((r) => r.lens !== "seo"),
  });
  const { report } = await runScan(f.options, { evaluate });
  expect(report.status).toBe("incomplete");
  expect(report.exitCode).toBe(2);
  expect(
    evaluate.calls.every((call) => !("page-audit-motion" in call.questions))
  ).toBe(true);
  expect(report.unknowns[0].reason).toContain("Missing motion evidence");
  expect(report.audit?.coverage.find((c) => c.lens === "seo")?.status).toBe(
    "not-assessed"
  );
  writeJson(f.audit, {
    ...f.input,
    brief: { ...f.input.brief, character: "Long context ".repeat(1500) },
  });
  const long = await runScan(f.options, { evaluate });
  expect(long.report.status).toBe("incomplete");
  expect(long.report.unknowns).toHaveLength(6);
});

it("rejects invented quotes, mismatched capture identity, path escapes and source targets before model calls", async () => {
  const f = fixture();
  const evaluate = fakeEvaluate(() => 1);
  writeJson(f.audit, {
    ...f.input,
    proposals: [
      {
        ...f.input.proposals[2],
        evidence: [
          {
            artifact: "page.html",
            observation: "Invented",
            quote: "not present",
          },
        ],
      },
    ],
  });
  await expect(runScan(f.options, { evaluate })).rejects.toThrow(
    "verbatim quote"
  );
  writeJson(f.audit, {
    ...f.input,
    capture: "styles.json",
    page: { ...f.input.page, viewport: { height: 800, width: 375 } },
  });
  await expect(runScan(f.options, { evaluate })).rejects.toThrow("viewport");
  writeJson(f.audit, {
    ...f.input,
    artifacts: [{ kind: "dom", path: "../outside.txt" }],
  });
  fs.writeFileSync(path.join(f.root, "outside.txt"), "outside");
  expect(() => readAudit(f.audit, f.root)).toThrow("escapes");
  fs.symlinkSync(
    path.join(f.root, "outside.txt"),
    path.join(f.directory, "linked.txt")
  );
  writeJson(f.audit, {
    ...f.input,
    artifacts: [{ kind: "dom", path: "linked.txt" }],
  });
  expect(() => readAudit(f.audit, f.root)).toThrow("escapes");
  await expect(
    runScan({ ...f.options, targets: ["src"] }, { evaluate })
  ).rejects.toThrow("no source targets");
  expect(evaluate.calls).toHaveLength(0);
});

it("requires fresh repeated checks before disappeared findings become verified repairs", async () => {
  const { before, after, evidence } = await repair();
  expect(after.summary.resolved).toBe(0);
  expect(after.summary.unverified).toBe(6);
  const verified = verifyAudit(before, after, evidence);
  expect(verified.summary.resolved).toBe(6);
  expect(verified.audit?.verification?.observer.name).toBe(
    "independent verification"
  );
  expect(after.summary.resolved).toBe(0);
});
it("rejects incomplete, stale, mismatched, partial or contradicted repair claims", async () => {
  const { g, before, after, evidence, input } = await repair();
  expect(() =>
    verifyAudit(before, { ...after, status: "incomplete" }, evidence)
  ).toThrow("complete");
  expect(() => verifyAudit(before, before, evidence)).toThrow("fresh");
  expect(() =>
    verifyAudit(before, { ...after, signature: "different" }, evidence)
  ).toThrow("same root");
  writeJson(evidence, { ...input, afterEvidenceHash: "stale" });
  expect(() => verifyAudit(before, after, evidence)).toThrow(
    "current beforeEvidenceHash"
  );
  writeJson(evidence, { ...input, checks: input.checks.slice(1) });
  expect(() => verifyAudit(before, after, evidence)).toThrow("every visible");
  writeJson(evidence, input);
  expect(() =>
    verifyAudit(before, { ...after, findings: before.findings }, evidence)
  ).toThrow("still reported");
  fs.writeFileSync(path.join(g.directory, "screen.png"), "changed again");
  expect(() => verifyAudit(before, after, evidence)).toThrow(
    "artifacts have changed"
  );
});

it("requires a fresh artifact of the right kind for each passed check", async () => {
  const { f, g, before, after, evidence, input } = await repair();
  const motion = input.checks.find(
    (check) =>
      before.findings.find(
        (finding) => finding.fingerprint === check.fingerprint
      )?.audit?.lens === "motion"
  )!;
  motion.artifacts = ["screen.png"];
  writeJson(evidence, input);
  expect(() => verifyAudit(before, after, evidence)).toThrow(
    "fresh after evidence of the appropriate kind"
  );
  motion.artifacts = ["motion.txt"];
  fs.copyFileSync(
    path.join(f.directory, "motion.txt"),
    path.join(g.directory, "motion.txt")
  );
  const original = before.audit!.artifacts.find((a) => a.kind === "motion")!;
  after.audit!.artifacts.find((a) => a.kind === "motion")!.sha256 =
    original.sha256;
  writeJson(evidence, input);
  expect(() => verifyAudit(before, after, evidence)).toThrow(
    "fresh after evidence of the appropriate kind"
  );
});

it("retains failed and unknown repairs in the machine report", async () => {
  const { before, after, evidence, input } = await repair();
  input.checks[0].outcome = "failed";
  input.checks[1].outcome = "unknown";
  writeJson(evidence, input);
  const verified = verifyAudit(before, after, evidence);
  expect(verified.summary.resolved).toBe(4);
  expect(verified.summary.unverified).toBe(2);
  expect(verified.exitCode).toBe(2);
});
const cli = (...args: string[]) =>
  spawnSync(process.execPath, [path.resolve("dist/cli.js"), "scan", ...args], {
    encoding: "utf-8",
  });
it("exposes audit, export and verify through the packaged CLI", async () => {
  const { f, before, after, evidence, input } = await repair();
  const beforePath = path.join(f.root, "before.json");
  const afterPath = path.join(f.root, "after.json");
  const out = path.join(f.root, "verified.json");
  writeJson(beforePath, before);
  writeJson(afterPath, after);
  const preview = cli(
    "--root",
    f.root,
    "--audit",
    f.audit,
    "--dry-run",
    "--output",
    "json"
  );
  expect(preview.status).toBe(0);
  expect(JSON.parse(preview.stdout).audit.page).toEqual(f.input.page);
  const handoff = path.join(f.root, "handoff.json");
  expect(cli("export", beforePath, "--out", handoff).status).toBe(0);
  expect(
    JSON.parse(fs.readFileSync(handoff, "utf-8")).tasks[0].audit.preserve
  ).toBe("The quiet presentation");
  const verified = cli(
    "verify",
    beforePath,
    "--after",
    afterPath,
    "--evidence",
    evidence,
    "--out",
    out
  );
  expect(verified.stderr).toBe("");
  expect(verified.status).toBe(0);
  expect(readReport(out).summary.resolved).toBe(6);
  writeJson(afterPath, { ...after, findings: before.findings, resolved: [] });
  writeJson(evidence, {
    ...input,
    checks: input.checks.map((check) => ({ ...check, outcome: "failed" })),
  });
  const failed = cli(
    "verify",
    beforePath,
    "--after",
    afterPath,
    "--evidence",
    evidence,
    "--out",
    out
  );
  expect(failed.status).toBe(2);
  expect(failed.stdout).toContain("0 passed, 6 failed, 0 unknown");
});
