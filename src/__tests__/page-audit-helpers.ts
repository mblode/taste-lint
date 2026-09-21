import fs from "node:fs";
import path from "node:path";

import { afterEach } from "vitest";

import { AUDIT_LENSES } from "../audit/types.js";
import { runScan } from "../scan/run.js";
import { writeJson } from "../scan/storage.js";
import { fakeEvaluate, FIXTURES, temporary } from "./helpers.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { force: true, recursive: true });
  }
});
export const fixture = (root = temporary(), name = "before") => {
  if (!roots.includes(root)) {
    roots.push(root);
  }
  const directory = path.join(root, name);
  fs.mkdirSync(directory, { recursive: true });
  const page = {
    state: "initial",
    url: "http://localhost:3000/pricing",
    viewport: { height: 800, width: 1280 },
  };
  const capturedAt =
    name === "before" ? "2026-09-21T00:00:00Z" : "2026-09-21T00:01:00Z";
  const capture = JSON.parse(
    fs.readFileSync(path.join(FIXTURES, "capture.json"), "utf-8")
  );
  capture.metadata = { ...page, capturedAt };
  for (const id of capture.order) {
    capture.elements[id].visible = true;
  }
  writeJson(path.join(directory, "styles.json"), capture);
  fs.writeFileSync(path.join(directory, "screen.png"), name);
  const observed = `Observed ${name}: the task is blocked.`;
  fs.writeFileSync(path.join(directory, "interaction.txt"), observed);
  fs.writeFileSync(path.join(directory, "motion.txt"), observed);
  fs.writeFileSync(
    path.join(directory, "page.html"),
    `<!doctype html><html><head><title>Plans</title></head><body><h1>${observed}</h1></body></html>`
  );
  const evidence = {
    copywriting: "page.html",
    interaction: "interaction.txt",
    motion: "motion.txt",
    seo: "page.html",
    typography: "styles.json",
    ui: "screen.png",
  };
  const input = {
    artifacts: [
      { kind: "screenshot", path: "screen.png" },
      { kind: "styles", path: "styles.json" },
      { kind: "interaction", path: "interaction.txt" },
      { kind: "motion", path: "motion.txt" },
      { kind: "document", path: "page.html" },
    ],
    brief: {
      audience: "Small teams",
      character: "Quiet and direct",
      constraints: ["Preserve honest pricing"],
      purpose: "Choose a plan",
    },
    capturedAt,
    observer: { kind: "agent", name: "test observer" },
    page,
    proposals: AUDIT_LENSES.map((lens) => ({
      consequence: "The visitor cannot compare plans",
      correction: "Clarify the comparison",
      evidence: [
        {
          artifact: evidence[lens],
          observation: observed,
          ...(lens === "ui"
            ? {}
            : { quote: lens === "typography" ? "font-size" : observed }),
        },
      ],
      id: `problem-${lens}`,
      lens,
      preserve: "The quiet presentation",
      problem: `The ${lens} problem blocks choosing a plan`,
      region: "hero",
      verification: `Repeat the ${lens} check in the same page state`,
    })),
    reviews: AUDIT_LENSES.map((lens) => ({
      artifacts: [evidence[lens]],
      lens,
      status: "reviewed",
      summary: `Inspected ${lens}`,
    })),
    version: 1,
  };
  const audit = path.join(directory, "audit.json");
  writeJson(audit, input);
  const options = {
    audit,
    resultsDir: path.join(root, "cache"),
    root,
    targets: ["."],
  };
  return { audit, directory, input, options, root };
};

export const repair = async () => {
  const f = fixture();
  const { report: before } = await runScan(f.options, {
    evaluate: fakeEvaluate(() => 0.95),
  });
  const g = fixture(f.root, "after");
  const baseline = path.join(f.root, "before.json");
  writeJson(baseline, before);
  const { report: after } = await runScan(
    { ...g.options, baseline },
    { evaluate: fakeEvaluate(() => 0.01) }
  );
  const evidence = path.join(g.directory, "verification.json");
  const input = {
    afterEvidenceHash: after.audit!.evidenceHash,
    beforeEvidenceHash: before.audit!.evidenceHash,
    checks: before.findings.map((finding) => ({
      artifacts: [
        (
          {
            copywriting: "page.html",
            interaction: "interaction.txt",
            motion: "motion.txt",
            seo: "page.html",
            typography: "styles.json",
            ui: "screen.png",
          } as Record<string, string>
        )[finding.audit!.lens],
      ],
      fingerprint: finding.fingerprint,
      observed: "Repeated the check successfully",
      outcome: "passed",
      preserved: "Existing presentation and behavior remain",
      procedure: finding.audit!.verification,
    })),
    observer: { kind: "agent", name: "independent verification" },
    version: 1,
  };
  writeJson(evidence, input);
  return { after, before, evidence, f, g, input };
};
