import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { expect, it } from "vitest";

import { readAudit } from "../audit/input.js";
import { verifyAudit } from "../audit/verify.js";
import { runEval } from "../eval/metrics.js";
import { readReport } from "../scan/report.js";
import { runScan } from "../scan/run.js";
import { labelsToCorpus } from "../scan/samples.js";
import { writeJson } from "../scan/storage.js";
import { fakeEvaluate } from "./helpers.js";
import { fixture, repair } from "./page-audit-helpers.js";

const cli = (...args: string[]) =>
  spawnSync(process.execPath, [path.resolve("dist/cli.js"), "scan", ...args], {
    encoding: "utf-8",
  });

it("rejects invalid or timezone-free timestamps in audit inputs and saved reports", async () => {
  const f = fixture();
  const { report } = await runScan(f.options, {
    evaluate: fakeEvaluate(() => 0),
  });
  const saved = path.join(f.root, "report.json");
  for (const capturedAt of [
    "not-a-time",
    "2026-09-21T00:00:00",
    "09/21/2026",
  ]) {
    writeJson(f.audit, { ...f.input, capturedAt });
    expect(() => readAudit(f.audit, f.root)).toThrow(
      "ISO timestamp with a timezone"
    );
    writeJson(saved, { ...report, audit: { ...report.audit, capturedAt } });
    expect(() => readReport(saved)).toThrow("ISO timestamp with a timezone");
  }
  writeJson(f.audit, { ...f.input, capturedAt: "2026-09-21T10:00:00+10:00" });
  expect(readAudit(f.audit, f.root).audit.capturedAt).toBe(
    "2026-09-21T10:00:00+10:00"
  );
});

it("clears a prior incomplete verification exit code after all checks pass", async () => {
  const { before, after, evidence, input } = await repair();
  writeJson(evidence, {
    ...input,
    checks: input.checks.map((check) => ({ ...check, outcome: "unknown" })),
  });
  const pending = verifyAudit(before, after, evidence);
  expect(pending.exitCode).toBe(2);
  writeJson(evidence, input);
  const verified = verifyAudit(before, pending, evidence);
  expect(verified.exitCode).toBe(0);
  expect(verified.summary.resolved).toBe(6);
  expect(verified.summary.unverified).toBe(0);
});

it("reports malformed capture fields as actionable input errors through the CLI", () => {
  const f = fixture();
  const file = path.join(f.directory, "styles.json");
  const capture = JSON.parse(fs.readFileSync(file, "utf-8"));
  capture.elements[capture.order[1]].styles = null;
  writeJson(file, capture);
  writeJson(f.audit, { ...f.input, capture: "styles.json" });
  const result = cli(
    "--root",
    f.root,
    "--audit",
    f.audit,
    "--dry-run",
    "--output",
    "json"
  );
  expect(result.status).toBe(1);
  expect(JSON.parse(result.stdout)).toMatchObject({
    code: "INVALID_PAGE_AUDIT",
    message: expect.stringMatching(/styles.*Recapture/),
  });
});

it("honors JSON before or after report subcommands and validates before writing", async () => {
  const { f, before, after, evidence } = await repair();
  const beforePath = path.join(f.root, "before.json");
  const afterPath = path.join(f.root, "after.json");
  writeJson(beforePath, before);
  writeJson(afterPath, after);
  for (const beforeCommand of [true, false]) {
    const invoke = (...args: string[]) =>
      cli(
        ...(beforeCommand
          ? ["--output", "json", ...args]
          : [...args, "--output", "json"])
      );
    const guide = invoke("guide");
    expect(guide.status).toBe(0);
    expect(JSON.parse(guide.stdout).guide).toContain("audit");
    const exported = invoke(
      "export",
      beforePath,
      "--out",
      path.join(f.root, "handoff.json")
    );
    expect(exported.status).toBe(0);
    expect(JSON.parse(exported.stdout).tasks).toHaveLength(6);
    const verified = invoke(
      "verify",
      beforePath,
      "--after",
      afterPath,
      "--evidence",
      evidence,
      "--out",
      path.join(f.root, "verified.json")
    );
    expect(verified.status).toBe(0);
    expect(JSON.parse(verified.stdout).summary.resolved).toBe(6);
  }
  const out = path.join(f.root, "must-not-write.json");
  expect(
    cli("export", beforePath, "--out", out, "--output", "invalid").status
  ).toBe(1);
  expect(fs.existsSync(out)).toBe(false);
});

it("preserves audit eligibility when blind samples are imported and evaluated", async () => {
  const f = fixture();
  const ruleId = "page-audit-copywriting";
  const { samples } = await runScan(
    { ...f.options, samples: true },
    { evaluate: fakeEvaluate(() => 0.95) }
  );
  const sample = samples.find(
    (s) => s.ruleId === ruleId && s.item.context?.audit?.lens === "copywriting"
  )!;
  const labels = path.join(f.root, "labels.json");
  writeJson(labels, {
    annotation: {
      model: "test-evaluator",
      promptHash: "a".repeat(64),
      source: "ai",
    },
    samples: [{ ...sample, label: true }],
    version: 2,
  });
  const corpusDir = path.join(f.root, "corpus");
  fs.mkdirSync(corpusDir);
  expect(labelsToCorpus(labels, path.join(corpusDir, "labels.jsonl"))).toBe(1);
  const evaluate = fakeEvaluate(() => 0.95);
  const result = await runEval(
    {
      corpusDir,
      noCache: true,
      only: [ruleId],
      resultsDir: path.join(f.root, "eval"),
    },
    { evaluate }
  );
  expect(evaluate.calls).toHaveLength(1);
  expect(evaluate.calls[0].state).toContain("Choose a plan");
  expect(result.rules[0].pairs[0].probability).toBe(0.95);
});

it("exports page evidence and optional real source locations without synthetic edit targets", async () => {
  const f = fixture();
  fs.writeFileSync(
    path.join(f.root, "page.tsx"),
    "export const Page = () => <main>Plans</main>;"
  );
  writeJson(f.audit, {
    ...f.input,
    capture: "styles.json",
    proposals: f.input.proposals.map((p) =>
      p.lens === "ui" ? { ...p, source: { file: "page.tsx", line: 1 } } : p
    ),
  });
  const { report } = await runScan(f.options, {
    evaluate: fakeEvaluate(() => 0.95),
  });
  const saved = path.join(f.root, "report.json");
  writeJson(saved, report);
  const result = cli(
    "export",
    saved,
    "--out",
    path.join(f.root, "handoff.json"),
    "--output",
    "json"
  );
  expect(result.status).toBe(0);
  const { tasks } = JSON.parse(result.stdout);
  for (const task of tasks) {
    expect(task.location.page).toEqual(f.input.page);
    expect(task.location.artifacts.length).toBeGreaterThan(0);
    for (const artifact of task.location.artifacts) {
      expect(fs.existsSync(path.join(task.location.directory, artifact))).toBe(
        true
      );
    }
    expect(task.verification.join("\n")).not.toMatch(
      /Inspect.*(?:__taste_audit__|rendered:)/
    );
    if (task.audit.lens === "ui") {
      expect(task.location.file).toBe("page.tsx");
      expect(task.verification.join("\n")).toContain("page.tsx:1");
    } else {
      expect(task.location.file).toBeUndefined();
    }
  }
});
