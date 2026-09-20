import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { afterEach, expect, it } from "vitest";

import { loadCorpus } from "../eval/corpus.js";
import { extractMarkdown } from "../extract/markdown.js";
import { AnswerCache } from "../map/cache.js";
import { judge } from "../map/judge.js";
import { planRequests } from "../map/plan.js";
import { buildState } from "../map/state.js";
import { loadRules } from "../rules/load.js";
import { importArchitecture } from "../scan/architecture.js";
import { changedLines, touchesChange } from "../scan/git.js";
import { profileFor, profileIncludes } from "../scan/profiles.js";
import { reconcile, readReport } from "../scan/report.js";
import { runScan } from "../scan/run.js";
import { makeSamples, labelsToCorpus } from "../scan/samples.js";
import { writeJson } from "../scan/storage.js";
import { config, temporary } from "./helpers.js";

const run = (...args: string[]) =>
  spawnSync(process.execPath, [path.resolve("dist/cli.js"), "scan", ...args], {
    encoding: "utf-8",
  });

const dirs: string[] = [];
const fixture = () => {
  const root = temporary();
  dirs.push(root);
  fs.writeFileSync(path.join(root, "README.md"), 'A "quoted" description.\n');
  return root;
};
afterEach(() => {
  for (const dir of dirs.splice(0)) {
    fs.rmSync(dir, { force: true, recursive: true });
  }
});
const optionsFor = (root: string) => ({
  only: ["typography-straight-quotes"],
  profile: "writing",
  resultsDir: path.join(root, "results"),
  root,
  targets: ["."],
});
it("scopes product, writing, instructions and architecture profiles", () => {
  expect(profileIncludes(profileFor("product"), "apps/web/page.tsx")).toBe(
    true
  );
  expect(
    profileIncludes(profileFor("product"), ".captain/browser/report.md")
  ).toBe(false);
  expect(profileIncludes(profileFor("writing"), "docs/archive/old.md")).toBe(
    false
  );
  expect(
    profileIncludes(profileFor("writing"), "content/writing/story.mdx")
  ).toBe(true);
  expect(
    profileIncludes(profileFor("instructions"), "apps/web/AGENTS.md")
  ).toBe(true);
  expect(() => profileFor("typo")).toThrow();
});
it("keeps identity across inserted lines and supports baseline, dismissal and reopen", async () => {
  const root = fixture();
  const options = optionsFor(root);
  const { report: first } = await runScan(options);
  expect(first.findings).toHaveLength(1);
  expect(first.exitCode).toBe(0);
  expect(first.findings[0].band).toBe("review");
  const baseline = path.join(root, "results/base.json");
  writeJson(baseline, first);
  fs.writeFileSync(
    path.join(root, "README.md"),
    '\n\nA "quoted" description.\n'
  );
  const { report: second } = await runScan({
    ...options,
    baseline,
    newOnly: true,
  });
  expect(second.findings[0].fingerprint).toBe(first.findings[0].fingerprint);
  expect(second.summary.existing).toBe(1);
  expect(second.summary.visible).toBe(0);
  const decisions = path.join(root, "results/decisions.json");
  writeJson(decisions, {
    decisions: {
      [first.findings[0].fingerprint]: {
        reason: "Raw text policy",
        status: "dismissed",
      },
    },
    signature: first.signature,
    version: 1,
  });
  const dismissed = await runScan({ ...options, decisions });
  expect(dismissed.report.summary.dismissed).toBe(1);
  writeJson(decisions, {
    decisions: {
      [first.findings[0].fingerprint]: {
        reason: "Review again",
        status: "open",
      },
    },
    signature: first.signature,
    version: 1,
  });
  const reopened = await runScan({ ...options, decisions });
  expect(reopened.report.summary.visible).toBe(1);
  fs.writeFileSync(path.join(root, "README.md"), "A “quoted” description.\n");
  const fixed = await runScan({ ...options, baseline });
  expect(fixed.report.summary.resolved).toBe(1);
});
it("rejects incompatible baselines and never calls missing evidence resolved", async () => {
  const root = fixture();
  const options = optionsFor(root);
  const { report: first } = await runScan(options);
  const baseline = path.join(root, "results/base.json");
  writeJson(baseline, first);
  await expect(
    runScan({ ...options, baseline, profile: "all" })
  ).rejects.toThrow("Baseline");
  const unknown = [
    {
      file: first.findings[0].file,
      line: 1,
      reason: "missing evidence",
      ruleId: first.findings[0].ruleId,
      unitId: "u",
    },
  ];
  expect(reconcile([], first, true, unknown, {})[0].lifecycle).toBe(
    "unverified"
  );
  expect(reconcile([], first, false, [], {})[0].lifecycle).toBe("unverified");
  fs.unlinkSync(path.join(root, "README.md"));
  const empty = await runScan(options);
  expect(empty.report.exitCode).toBe(2);
});
it("distinguishes repeated text and rejects malformed review artifacts", async () => {
  const root = fixture();
  fs.appendFileSync(
    path.join(root, "README.md"),
    '\nA "quoted" description.\n'
  );
  const { report: result } = await runScan(optionsFor(root));
  expect(new Set(result.findings.map((f) => f.fingerprint)).size).toBe(2);
  const bad = path.join(root, "bad.json");
  writeJson(bad, { kind: "taste-lint-scan", version: 1 });
  expect(() => readReport(bad)).toThrow("version 1");
});
it("uses source-file context and abstains instead of truncating section comparisons", () => {
  const rules = loadRules(path.resolve("data/rules"), {
    only: ["copywriting-idea-repetition", "copywriting-generic-framing"],
  });
  const units = extractMarkdown(
    "README.md",
    "## First\n\nSpeed matters.\n\nSpeed is important.\n\n## Second\n\nOther facts.",
    { config: config("."), docType: "readme" }
  );
  const unit = units.find((u) => u.text === "Speed matters.")!;
  expect(unit.context.section).toContain("Speed is important.");
  expect(unit.context.section).not.toContain("Other facts.");
  const plan = planRequests([unit], rules, config("."));
  expect(plan.jobs).toHaveLength(2);
  expect(
    buildState(
      unit,
      plan.jobs
        .find((j) => j.rules[0].rule.id === "copywriting-idea-repetition")!
        .rules.map((r) => r.rule)
    ).state
  ).toContain("SECTION:");
  unit.context.section = "Large section ".repeat(2000);
  expect(planRequests([unit], rules, config(".")).unknowns).toHaveLength(1);
});
it("compares staged, unstaged and untracked changes without shell expansion", () => {
  const root = fixture();
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", root, ...args], { stdio: "pipe" });
  fs.mkdirSync(path.join(root, "workspace"));
  fs.writeFileSync(path.join(root, "workspace/note.md"), "Original.\n");
  git("init");
  git("add", ".");
  git(
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.com",
    "commit",
    "-m",
    "Initial"
  );
  fs.writeFileSync(
    path.join(root, "README.md"),
    "New first line\n\nOriginal.\n"
  );
  git("add", "README.md");
  fs.appendFileSync(path.join(root, "README.md"), "Unstaged line\n");
  fs.writeFileSync(path.join(root, "new.ts"), "export {};\n");
  fs.writeFileSync(path.join(root, "workspace/note.md"), "Changed.\n");
  const nested = changedLines(path.join(root, "workspace"), "HEAD");
  expect(touchesChange(nested, "note.md", 1, 1)).toBe(true);
  const diff = changedLines(root, "HEAD");
  expect(touchesChange(diff, "README.md", 1, 1)).toBe(true);
  expect(touchesChange(diff, "README.md", 4, 4)).toBe(true);
  expect(touchesChange(diff, "new.ts", 1, 1)).toBe(true);
  expect(touchesChange(diff, "README.md", 100, 100)).toBe(false);
  expect(() => changedLines(root, "--bad-ref")).toThrow("Git");
});
it("imports declared graph violations without executing configuration", () => {
  const root = fixture();
  const file = path.join(root, "graph.json");
  writeJson(file, {
    modules: [{ source: "src/a.ts" }],
    summary: {
      violations: [
        {
          from: "src/a.ts",
          rule: { name: "boundary", severity: "error" },
          to: "src/b.ts",
        },
      ],
    },
  });
  const result = importArchitecture(file);
  expect(result.findings[0]).toMatchObject({
    band: "act",
    file: "src/a.ts",
    origin: "dependency-cruiser",
  });
  writeJson(file, {
    modules: [],
    summary: { violations: [{ from: "../outside", rule: {} }] },
  });
  expect(() => importArchitecture(file)).toThrow("dependency-cruiser");
});
it("exports blind positive and negative samples and requires reviewed labels", () => {
  const root = fixture();
  const rules = loadRules(path.resolve("data/rules"), {
    only: ["copywriting-generic-framing"],
  });
  const units = extractMarkdown(
    "README.md",
    "Concrete facts.\n\nGeneric thoughts.",
    { config: config(root), docType: "readme" }
  );
  const answers = new Map(
    units.map((u, i) => [u.id, { [rules[0].id]: i ? 0.9 : 0.1 }])
  );
  const samples = makeSamples(units, rules, answers, new Map());
  expect(samples).toHaveLength(2);
  expect(JSON.stringify(samples)).not.toContain("probability");
  expect(samples[0].item.split).toBe(samples[1].item.split);
  const file = path.join(root, "samples.json");
  writeJson(file, { samples, version: 1 });
  expect(() => labelsToCorpus(file, path.join(root, "labels.jsonl"))).toThrow(
    "No labels"
  );
  samples[0].label = true;
  samples[1].label = false;
  writeJson(file, { samples, version: 1 });
  expect(labelsToCorpus(file, path.join(root, "labels.jsonl"))).toBe(2);
  expect(loadCorpus(root, rules)).toHaveLength(2);
});
it("exercises the packaged scan CLI and SARIF fingerprints", () => {
  const root = fixture();
  const cli = path.resolve("dist/cli.js");
  const result = spawnSync(
    process.execPath,
    [
      cli,
      "scan",
      ".",
      "--root",
      root,
      "--profile",
      "writing",
      "--only",
      "typography-straight-quotes",
      "--output",
      "sarif",
    ],
    { encoding: "utf-8" }
  );
  expect(result.status).toBe(0);
  expect(
    JSON.parse(result.stdout).runs[0].results[0].partialFingerprints[
      "tasteLint/v1"
    ]
  ).toMatch(/^[a-f0-9]{64}$/);
});

it("keeps local and section judgments when replaying the shared cache", async () => {
  const root = fixture();
  const rules = loadRules(path.resolve("data/rules"), {
    only: ["copywriting-idea-repetition", "copywriting-generic-framing"],
  });
  const units = extractMarkdown(
    "README.md",
    "Speed matters. Speed is important.",
    { config: config(root), docType: "readme" }
  );
  const cache = new AnswerCache(path.join(root, "cache"));
  const live = await judge(units, rules, {
    cache,
    config: config(root),
    evaluate: (request) =>
      Promise.resolve({
        answers: Object.fromEntries(
          Object.keys(request.questions).map((id) => [id, { noul: 0.8 }])
        ),
        model: "test",
        usage: { input_tokens: 1, output_tokens: 0 },
      }),
    model: "test",
  });
  expect(live.usage.requests).toBe(2);
  const replay = await judge(units, rules, {
    cache,
    config: config(root),
    model: "test",
  });
  expect(replay.answers.get(units[0].id)).toEqual(
    live.answers.get(units[0].id)
  );
  expect(replay.usage.cached).toBe(2);
});
it("accepts real dependency-cruiser 18.3.1 output and rejects empty coverage", () => {
  const graph = importArchitecture(
    path.resolve("src/__tests__/fixtures/dependency-cruiser.json")
  );
  expect(graph.incomplete).toBe(false);
  expect(graph.findings[0].ruleId).toBe("dependency-cruiser/no-a-to-b");
  const root = fixture();
  const file = path.join(root, "empty.json");
  writeJson(file, { modules: [], summary: { violations: [] } });
  expect(importArchitecture(file).incomplete).toBe(true);
});
it("review and remediation commands preserve decisions and evidence", async () => {
  const root = fixture();
  const { report } = await runScan(optionsFor(root));
  const file = path.join(root, "scan.json");
  const decisions = path.join(root, "decisions.json");
  writeJson(file, report);
  expect(
    run(
      "review",
      file,
      report.findings[0].fingerprint,
      "--decisions",
      decisions,
      "--status",
      "dismissed",
      "--reason",
      "Source text convention"
    ).status
  ).toBe(0);
  expect(
    run(
      "review",
      file,
      report.findings[0].fingerprint,
      "--decisions",
      decisions,
      "--status",
      "open"
    ).status
  ).toBe(0);
  const output = path.join(root, "handoff.json");
  expect(run("export", file, "--out", output).status).toBe(0);
  const handoff = JSON.parse(fs.readFileSync(output, "utf-8"));
  expect(handoff.tasks[0].evidence).toContain('"quoted"');
  expect(handoff.tasks[0].automaticFix).toBe(false);
});
