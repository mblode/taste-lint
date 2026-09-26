import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { afterEach, expect, it } from "vitest";
import { parse, stringify } from "yaml";

import { runEval } from "../eval/metrics.js";
import { extractTsx } from "../extract/tsx.js";
import { runLint } from "../lint.js";
import { planRequests } from "../map/plan.js";
import { renderSarif } from "../report/sarif.js";
import { formatFinding } from "../report/tty.js";
import { loadRules } from "../rules/load.js";
import { isCandidateRule, reviewProcedure } from "../rules/review.js";
import { validateRule } from "../rules/validate.js";
import { config, fakeEvaluate, temporary } from "./helpers.js";

const rules = loadRules(path.resolve("data/rules"));
const dirs: string[] = [];
const temp = () => {
  const root = temporary();
  dirs.push(root);
  return root;
};
afterEach(() => {
  for (const root of dirs.splice(0)) {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

it("ships an evidence procedure for every raw-source candidate", () => {
  const candidates = rules.filter(isCandidateRule);
  expect(candidates).toHaveLength(58);
  for (const rule of candidates) {
    expect(rule.status).toBe("review-only");
    expect(reviewProcedure(rule.review, rule.file)).toEqual(rule.review);
    expect(rule.review).toBeDefined();
    if (rule.source.repo === "mblode/agent-skills") {
      expect(rule.review?.sourceHash).toMatch(/^[a-f0-9]{64}$/);
    }
  }
});

it("rejects incomplete procedures and candidate promotion by a tuning overlay", () => {
  const rule = rules.find(
    (r) => r.id === "interaction-use-form-status-misuse"
  )!;
  const raw = parse(fs.readFileSync(rule.file, "utf-8"));
  expect(() =>
    validateRule({ ...raw, review: undefined }, rule.file, rule.id)
  ).toThrow("source candidates need review");
  expect(() =>
    reviewProcedure({ ...raw.review, exceptions: "" }, rule.file)
  ).toThrow("nonempty");
  const root = temp();
  fs.mkdirSync(path.join(root, "interaction"));
  fs.copyFileSync(rule.file, path.join(root, "interaction", `${rule.id}.yaml`));
  fs.writeFileSync(
    path.join(root, "tuning.json"),
    JSON.stringify({ [rule.id]: { status: "active" } })
  );
  expect(() => loadRules(root)).toThrow("cannot be active");
});

it("does not turn a valid child form hook or primitive focus default into a confirmed defect", async () => {
  const root = temp();
  fs.writeFileSync(
    path.join(root, "form.tsx"),
    'import {useFormStatus} from "react-dom"; function Submit(){const {pending}=useFormStatus();return <button disabled={pending}>Save</button>} export function Form(){return <form><Submit /></form>}'
  );
  fs.writeFileSync(
    path.join(root, "dialog.tsx"),
    'import {Dialog} from "./radix-wrapper"; export function Page(){return <Dialog>Content</Dialog>}'
  );
  const evaluate = fakeEvaluate(() => 1);
  const report = await runLint(
    {
      only: ["interaction-use-form-status-misuse", "interaction-not-restored"],
      resultsDir: path.join(root, "results"),
      root,
      targets: ["."],
    },
    { evaluate }
  );
  expect(report.summary?.failing).toBe(0);
  expect(report.findings).toHaveLength(2);
  expect(evaluate.calls).toHaveLength(0);
  const sarif = JSON.parse(renderSarif(report, rules, "test"));
  expect(sarif.runs[0].results[0].properties.assessment).toBe("candidate");
  expect(sarif.runs[0].results[0].properties.review).toEqual(
    report.findings[0].review
  );

  for (const finding of report.findings) {
    expect(formatFinding(finding)).toContain(
      "candidate; verification required"
    );
    expect(formatFinding(finding)).not.toContain("p=1.00");
    expect(finding.assessment).toBe("candidate");
    expect(finding.band).toBe("review");
    expect(finding.message).toMatch(/^Inspect:/);
    expect(finding.evidence).toContain("does not establish a defect");
    expect(finding.review?.exceptions).toBeTruthy();
    expect(finding.review?.verification).toBeTruthy();
  }
});

it("does not count candidate matches or misses as successful defect evaluations", async () => {
  const root = temp();
  const id = "interaction-use-form-status-misuse";
  const corpus = path.join(root, "corpus");
  fs.mkdirSync(corpus);
  const items = ["useFormStatus()", "export const label = 'Submit'"].map(
    (text, i) => ({
      categoryId: rules.find((r) => r.id === id)!.categoryId,
      id: `candidate-${i}`,
      kind: "source",
      labelSource: "hand",
      labels: { [id]: i === 0 },
      source: { path: `case-${i}.tsx`, repo: "test" },
      split: "holdout",
      text,
    })
  );
  fs.writeFileSync(
    path.join(corpus, "cases.jsonl"),
    items.map((item) => JSON.stringify(item)).join("\n")
  );
  const result = await runEval(
    {
      check: true,
      corpusDir: corpus,
      only: [id],
      resultsDir: path.join(root, "results"),
    },
    { evaluate: fakeEvaluate(() => 1) }
  );
  expect(result.exitCode).toBe(2);
  expect(result.rules[0].n).toBe(0);
  expect(result.rules[0].unknown).toBe(2);
});

it("abstains on missing comparison context and truncated text for every semantic tier", () => {
  const source = rules.find((r) => r.id === "copywriting-vague-error")!;
  const unit = extractTsx("view.tsx", "<p>Something went wrong</p>", {
    config: config("."),
    docType: "ui",
  }).find((u) => u.kind === "jsx-text")!;
  for (const tier of ["jev", "both"] as const) {
    const rule = {
      ...source,
      tier,
      ...(tier === "jev" ? { mechanical: undefined } : {}),
    };
    const dynamic = planRequests(
      [{ ...unit, context: { ...unit.context, dynamic: true } }],
      [rule],
      config(".")
    );
    expect(dynamic.jobs).toHaveLength(0);
    expect(dynamic.unknowns[0].reason).toContain("Dynamic text");
    const local = { ...rule, question: { ...rule.question!, context: [] } };
    const long = planRequests(
      [{ ...unit, text: `${unit.text} ${"words ".repeat(10_000)}` }],
      [local],
      config(".")
    );
    expect(long.jobs).toHaveLength(0);
    expect(long.unknowns[0].reason).toContain("context budget");
    const pair = {
      ...rule,
      question: { ...rule.question!, context: ["neighbours" as const] },
    };
    const missing = planRequests(
      [{ ...unit, neighbours: undefined }],
      [pair],
      config(".")
    );
    expect(missing.jobs).toHaveLength(0);
    expect(missing.unknowns[0].reason).toContain("comparison neighbour");
  }
});

it("splits individually complete questions when combined evidence would be truncated", () => {
  const base = rules.find((r) => r.id === "copywriting-vague-error")!;
  const unit = extractTsx("view.tsx", "<p>Something went wrong</p>", {
    config: config("."),
    docType: "ui",
  }).find((u) => u.kind === "jsx-text")!;
  unit.context.headingAbove = "x ".repeat(2000);
  unit.context.section = "y ".repeat(2000);
  const first = {
    ...base,
    id: "first",
    question: { ...base.question!, context: ["headingAbove" as const] },
  };
  const second = {
    ...base,
    id: "second",
    question: { ...base.question!, context: ["section" as const] },
  };
  const plan = planRequests([unit], [first, second], config("."));
  expect(plan.unknowns).toHaveLength(0);
  expect(plan.jobs).toHaveLength(2);
});

const portFixture = (root: string) => {
  const skills = path.join(root, "skills-repo");
  const sourcePath = "skills/ui-design/rules/forms-fixture.md";
  const sourceFile = path.join(skills, sourcePath);
  const sourceText = [
    "---",
    "id: forms-fixture",
    "title: Fixture",
    "detect: static",
    "defaultTier: backlog",
    "---",
    "",
    "## Fixture",
    "",
    "Review the parent form.",
    "",
    "## Detection",
    "",
    "```bash",
    "rg -n 'useFormStatus' --type=ts",
    "```",
    "",
    "A child component is an exception.",
    "",
  ].join("\n");
  fs.mkdirSync(path.dirname(sourceFile), { recursive: true });
  fs.writeFileSync(sourceFile, sourceText);
  const original = rules.find(
    (r) => r.id === "interaction-use-form-status-misuse"
  )!;
  const raw = parse(fs.readFileSync(original.file, "utf-8"));
  raw.id = "interaction-fixture";
  raw.source = {
    line: 8,
    path: sourcePath,
    repo: "mblode/agent-skills",
    ruleId: "forms-fixture",
  };
  raw.review.sourceHash = createHash("sha256").update(sourceText).digest("hex");
  const out = path.join(root, "data/rules");
  fs.mkdirSync(path.join(out, "interaction"), { recursive: true });
  fs.writeFileSync(
    path.join(out, "interaction/interaction-fixture.yaml"),
    stringify(raw)
  );
  return { out, skills, sourceFile };
};

it("detects changed source exceptions even when the regex and citation stay the same", () => {
  const { out, skills, sourceFile } = portFixture(temp());
  const args = [
    "--experimental-strip-types",
    "scripts/port-rules.ts",
    "--skills-dir",
    skills,
    "--out",
    out,
    "--only",
    "ui-design",
    "--check",
  ];
  const initial = spawnSync(process.execPath, args, { encoding: "utf-8" });
  expect(initial.status, initial.stderr).toBe(0);
  fs.appendFileSync(
    sourceFile,
    "\nA newly documented exception requires review.\n"
  );
  const result = spawnSync(process.execPath, args, { encoding: "utf-8" });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("evidence procedure source changed");
  expect(result.stderr).toContain("interaction-fixture");
});

it("generates new static ports as drafts until their evidence procedures are reviewed", () => {
  const root = temp();
  const { skills } = portFixture(root);
  const out = path.join(root, "generated/rules");
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "scripts/port-rules.ts",
      "--skills-dir",
      skills,
      "--out",
      out,
      "--only",
      "ui-design",
      "--write",
    ],
    { encoding: "utf-8" }
  );
  expect(result.status, result.stderr).toBe(0);
  expect(fs.existsSync(out)).toBe(false);
  const draftsRoot = path.join(root, "generated/rule-drafts");
  const drafts = [...fs.globSync("**/*.yaml", { cwd: draftsRoot })].map(
    (file) => parse(fs.readFileSync(path.join(draftsRoot, file), "utf-8"))
  );
  expect(drafts.some((rule) => rule.mechanical)).toBe(true);
  expect(drafts.every((rule) => rule.status === "draft")).toBe(true);
});
