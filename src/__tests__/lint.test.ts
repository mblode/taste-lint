import fs from "node:fs";
import path from "node:path";

import { afterEach, expect, it, vi } from "vitest";

import { runLint } from "../lint.js";
import { renderSarif } from "../report/sarif.js";
import {
  copyFixtures,
  fakeEvaluate,
  FIXTURES,
  silence,
  temporary,
} from "./helpers.js";

const folders: string[] = [];
const setup = () => {
  const root = temporary();
  folders.push(root);
  copyFixtures(root, ["lesson.mdx", "card.tsx"]);
  return {
    resultsDir: path.join(root, "results"),
    root,
    rulesDir: path.join(FIXTURES, "rules"),
  };
};
afterEach(() => {
  vi.restoreAllMocks();
  for (const root of folders.splice(0)) {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

it("dry run plans requests, reports mechanical findings and makes no calls", async () => {
  const { root, rulesDir, resultsDir } = setup();
  const evaluate = fakeEvaluate({});
  const result = await runLint(
    { dryRun: true, resultsDir, root, rulesDir, targets: ["."] },
    { evaluate }
  );
  expect(evaluate.calls).toHaveLength(0);
  expect(result.status).toBe("dry-run");
  expect(result.estimated?.requests).toBeGreaterThan(0);
  const quotes = result.findings.filter(
    (f) => f.ruleId === "typography-straight-quotes"
  );
  expect(quotes.length).toBeGreaterThan(0);
  expect(quotes.every((f) => f.band === "act" && f.probability === 1)).toBe(
    true
  );
  // A straight quote inside inline code is masked, so the measure paragraph is clean.
  expect(quotes.some((f) => f.line === 15)).toBe(false);
  expect(fs.existsSync(resultsDir)).toBe(false);
});

it("bands Jev answers, keeps severity independent of the band and caches answers", async () => {
  const { root, rulesDir, resultsDir } = setup();
  silence();
  const evaluate = fakeEvaluate((ruleId, state) => {
    if (ruleId === "copywriting-claim-without-evidence") {
      return state.includes("powerful") ? 0.91 : 0.5;
    }
    return state.includes("Notification rules") ? 0.86 : 0.1;
  });
  const first = await runLint(
    { resultsDir, root, rulesDir, targets: ["."] },
    { evaluate }
  );
  expect(first.status).toBe("complete");
  const claim = first.findings.find(
    (f) => f.ruleId === "copywriting-claim-without-evidence" && f.band === "act"
  );
  expect(claim).toMatchObject({
    file: "lesson.mdx",
    probability: 0.91,
    severity: "minor",
  });
  const review = first.findings.find(
    (f) =>
      f.ruleId === "copywriting-claim-without-evidence" && f.band === "review"
  );
  expect(review).toBeDefined();
  const hierarchy = first.findings.find(
    (f) => f.ruleId === "typography-hierarchy-size-only"
  );
  // The code rule ships review-only until tune promotes it, so 0.86 is a
  // review note; the severity stays what the rule says.
  expect(hierarchy).toMatchObject({
    band: "review",
    file: "card.tsx",
    probability: 0.86,
    severity: "minor",
  });
  expect(hierarchy?.evidence).toMatch(/ratio 1\.13/);
  expect(first.exitCode).toBe(1);
  const calls = evaluate.calls.length;
  expect(calls).toBeGreaterThan(0);
  const second = await runLint(
    { resultsDir, root, rulesDir, targets: ["."] },
    { evaluate }
  );
  expect(evaluate.calls.length).toBe(calls);
  expect(second.usage.cached).toBeGreaterThan(0);
  expect(second.findings.length).toBe(first.findings.length);
});

it("never persists provider errors and marks the run incomplete", async () => {
  const { root, rulesDir, resultsDir } = setup();
  silence();
  const result = await runLint(
    { resultsDir, root, rulesDir, targets: ["."] },
    {
      evaluate: () =>
        Promise.reject(
          new Error("sensitive fixture text that must not be logged")
        ),
    }
  );
  expect(result.status).toBe("incomplete");
  expect(result.exitCode).toBe(2);
  const log =
    fs.readdirSync(resultsDir).find((f) => f.endsWith(".jsonl")) ?? "";
  const text = fs.readFileSync(path.join(resultsDir, log), "utf-8");
  expect(text).not.toContain("sensitive fixture");
  expect(text).toContain('"error":"provider_error"');
});

it("refuses to run Jev rules without a key or an injected evaluate", async () => {
  const { root, rulesDir, resultsDir } = setup();
  await expect(
    runLint({ apiKey: undefined, resultsDir, root, rulesDir, targets: ["."] })
  ).rejects.toThrow(/AI_GATEWAY_API_KEY/);
  const preview = await runLint({
    dryRun: true,
    resultsDir,
    root,
    rulesDir,
    targets: ["."],
  });
  expect(preview.usage.requests).toBe(0);
  expect(preview.status).toBe("dry-run");
});

it("prints request payloads with sorted keys and renders SARIF", async () => {
  const { root, rulesDir, resultsDir } = setup();
  const lines: string[] = [];
  const result = await runLint(
    {
      dryRun: true,
      printRequests: true,
      resultsDir,
      root,
      rulesDir,
      targets: ["card.tsx"],
    },
    { stdout: (t) => lines.push(t) }
  );
  const payload = JSON.parse(lines[0]);
  expect(payload).toMatchObject({ model: "jev-latest" });
  expect(payload.state).toMatch(
    /^FIRST: Notification rules\nSECOND: Choose which/
  );
  expect(Object.keys(payload.questions)).toEqual([
    "typography-hierarchy-size-only",
  ]);
  const sarif = JSON.parse(renderSarif(result, result.rulesLoaded, "0.0.1"));
  expect(sarif.runs[0].tool.driver.rules[0].helpUri).toMatch(
    /github\.com\/mblode\/agent-skills\/blob\/main\/.*#L7/
  );
  expect(sarif.runs[0].results.length).toBe(
    result.ruleFindings?.filter((f) => !f.suppressed).length
  );
});

it("honours smartQuotesAtBuild and suppression comments", async () => {
  const { root, rulesDir, resultsDir } = setup();
  fs.writeFileSync(
    path.join(root, "taste-lint.config.json"),
    JSON.stringify({ smartQuotesAtBuild: true })
  );
  fs.writeFileSync(
    path.join(root, "note.tsx"),
    'export const N = () => (\n  <>\n    {/* taste-lint-ignore: typography-straight-quotes */}\n    <p>A "quoted" line</p>\n    <p>Another "quoted" line</p>\n  </>\n);\n'
  );
  const result = await runLint({
    only: ["typography-straight-quotes"],
    resultsDir,
    root,
    rulesDir,
    targets: ["."],
  });
  expect(
    result.findings.some(
      (f) =>
        f.file === "lesson.mdx" && f.ruleId === "typography-straight-quotes"
    )
  ).toBe(false);
  const note = result.findings.filter((f) => f.file === "note.tsx");
  expect(note.map((f) => f.suppressed)).toEqual([true, false]);
});
