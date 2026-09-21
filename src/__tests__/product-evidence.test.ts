import fs from "node:fs";
import path from "node:path";

import { afterEach, expect, it } from "vitest";

import { loadCorpus } from "../eval/corpus.js";
import { corpusCoverage } from "../eval/coverage.js";
import { evaluateRules, runEval } from "../eval/metrics.js";
import { extractTsx } from "../extract/tsx.js";
import { runLint } from "../lint.js";
import { ProviderError } from "../map/jev.js";
import { planRequests } from "../map/plan.js";
import { buildState } from "../map/state.js";
import { renderTty } from "../report/tty.js";
import { loadRules } from "../rules/load.js";
import { profileFor, profileRules } from "../scan/profiles.js";
import { config, fakeEvaluate, temporary } from "./helpers.js";

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
const rules = loadRules(path.resolve("data/rules"));

it("gives copy checks adjacent recovery evidence and abstains when it is unavailable", () => {
  const id = "copywriting-empty-state-no-action";
  const rule = rules.find((r) => r.id === id)!;
  const units = extractTsx(
    "card.tsx",
    "<section><p>No invoices yet</p><button>New invoice</button></section>",
    { config: config("."), docType: "ui" }
  );
  const unit = units.find(
    (u) => u.kind === "jsx-text" && u.text === "No invoices yet"
  )!;
  const plan = planRequests([unit], [rule], config("."));
  expect(plan.jobs).toHaveLength(1);
  expect(plan.mechanical).toHaveLength(0);
  expect(buildState(unit, [rule]).state).toContain("New invoice");
  for (const section of [undefined, "x".repeat(20_000)]) {
    const missing = planRequests(
      [{ ...unit, context: { ...unit.context, section } }],
      [rule],
      config(".")
    );
    expect(missing.jobs).toHaveLength(0);
    expect(missing.unknowns).toHaveLength(1);
    expect(missing.negatives.size).toBe(0);
  }
});

it("uses Jev for recovery even when an unrelated catch exists, and fails closed", async () => {
  const root = temp();
  fs.writeFileSync(
    path.join(root, "page.tsx"),
    'function log(){try{logEvent()}catch{}} export function Page(){const {data}=useQuery({queryKey:["invoices"],queryFn:loadInvoices});return <p>{data?.length}</p>}'
  );
  const options = {
    only: ["interaction-no-error-state"],
    resultsDir: path.join(root, "results"),
    root,
    targets: ["."],
  };
  const evaluate = fakeEvaluate(() => 0.9);
  const first = await runLint(options, { evaluate });
  expect(evaluate.calls).toHaveLength(1);
  expect(evaluate.calls[0].state).toContain("catch");
  expect(first.findings).toHaveLength(1);
  expect(first.findings[0].band).toBe("review");
  const failed = await runLint(
    { ...options, resultsDir: path.join(root, "failed") },
    { evaluate: () => Promise.reject(new ProviderError("provider_error", 503)) }
  );
  expect(failed.findings).toHaveLength(0);
  expect(failed.status).toBe("incomplete");
  expect(failed.unknowns.length).toBeGreaterThan(0);
});

it("scopes profiles by domain and never changes a rule's status", () => {
  const product = profileRules(profileFor("product"), rules);
  const ids = new Set(product.map((r) => r.id));
  for (const id of [
    "motion-transition-all",
    "motion-duration-over-300ms",
    "copywriting-click-here-links",
    "typography-straight-quotes",
    "copywriting-vague-error",
  ]) {
    expect(ids.has(id), id).toBe(true);
  }
  expect(ids.has("authoring-generic-verification")).toBe(false);
  expect(ids.has("copywriting-readme-scaffold")).toBe(false);
  const writing = profileRules(profileFor("writing"), rules);
  expect(
    writing.every((r) => ["copywriting", "typography"].includes(r.domain))
  ).toBe(true);
  expect(
    writing.some((r) => r.id === "copywriting-document-broken-local-link")
  ).toBe(false);
  const instructions = profileRules(profileFor("instructions"), rules);
  expect(
    instructions.some((r) => r.id === "authoring-generic-verification")
  ).toBe(true);
  expect(
    instructions.some((r) => r.id === "copywriting-document-broken-local-link")
  ).toBe(true);
  expect(profileRules(profileFor("all"), rules)).toHaveLength(rules.length);
  expect(
    [...product, ...writing, ...instructions].every(
      (r) => r.status === rules.find((x) => x.id === r.id)!.status
    )
  ).toBe(true);
});

it("measures visible findings and rejects a model that flags both paired variants", () => {
  const rule = rules.find((r) => r.id === "copywriting-empty-state-no-action")!;
  const items = loadCorpus(path.resolve("data/benchmarks/product"), [rule], {
    knownRuleIds: new Set(rules.map((r) => r.id)),
  });
  expect(corpusCoverage(items, [rule]).overlappingFamilies).toBe(0);
  const probabilities = new Map(items.map((i) => [i.id, { [rule.id]: 0.6 }]));
  const allPositive = evaluateRules(items, [rule], probabilities)[0];
  expect(allPositive.contrast?.passed).toBe(0);
  expect(allPositive.contrast?.failed).toBeGreaterThan(0);
  expect(allPositive.reviewMetrics?.fp).toBeGreaterThan(0);
  expect(allPositive.metrics.tp).toBe(0);
  for (const item of items) {
    probabilities.set(item.id, { [rule.id]: item.labels[rule.id] ? 0.6 : 0.1 });
  }
  const correct = evaluateRules(items, [rule], probabilities)[0];
  expect(correct.contrast?.passed).toBe(correct.contrast?.families);
  probabilities.delete(items[0].id);
  expect(
    evaluateRules(items, [rule], probabilities)[0].contrast?.unresolved
  ).toBe(1);
});

it("lists act findings and counts review notes by rule unless verbose", async () => {
  const root = temp();
  fs.writeFileSync(
    path.join(root, "page.tsx"),
    '<button className="transition-all">Open</button>'
  );
  const report = await runLint({
    only: ["motion-transition-all"],
    root,
    targets: ["."],
  });
  const original = report.findings[0];
  const findings = Array.from({ length: 7 }, (_, i) => ({
    ...original,
    band: i === 0 ? ("act" as const) : ("review" as const),
    ruleId: `rule-${i}`,
  }));
  const rendered = renderTty({ ...report, findings, ruleFindings: findings });
  expect(rendered).toContain("rule-0 ");
  expect(rendered).not.toContain("[MINOR?] rule-1");
  expect(rendered).toContain("6 review notes from 6 rules");
  const verbose = renderTty(
    { ...report, findings, ruleFindings: findings },
    { verbose: true }
  );
  expect(verbose).toContain("[MINOR?] rule-1");
  expect(report.exitCode).toBe(1);
});

it("does not judge a static error prefix when dynamic text can explain it", () => {
  const rule = rules.find((r) => r.id === "copywriting-vague-error")!;
  const units = extractTsx(
    "card.tsx",
    "<p>Failed to load: {error.message}</p>",
    { config: config("."), docType: "ui" }
  );
  const unit = units.find((u) => u.kind === "jsx-text")!;
  const plan = planRequests([unit], [rule], config("."));
  expect(plan.jobs).toHaveLength(0);
  expect(plan.unknowns[0].reason).toContain("Dynamic text");
  expect(plan.negatives.size).toBe(0);
});

it("rejects split leakage across variants even when their source paths differ", () => {
  const items = loadCorpus(path.resolve("data/benchmarks/product"), rules);
  const first = items[0];
  const sibling = {
    ...items[1],
    source: { ...first.source, path: "another.tsx" },
    split: first.split === "dev" ? ("holdout" as const) : ("dev" as const),
  };
  const coverage = corpusCoverage([first, sibling], rules);
  expect(coverage.overlappingSources).toHaveLength(0);
  expect(coverage.overlappingFamilies).toBe(1);
});

it("preserves adjacent actions across JSX fragments and nested dynamic explanations", () => {
  const options = { config: config("."), docType: "ui" as const };
  const units = extractTsx(
    "card.tsx",
    "<><p>No invoices yet</p><button>New invoice</button></>",
    options
  );
  const message = units.find(
    (u) => u.kind === "jsx-text" && u.text === "No invoices yet"
  )!;
  expect(message.context.section).toContain("New invoice");
  const dynamic = extractTsx(
    "card.tsx",
    "<p>Failed: <span>{error.message}</span></p>",
    options
  ).find((u) => u.kind === "jsx-text")!;
  expect(dynamic.context.dynamic).toBe(true);
});

it("includes nested recovery without crossing into a neighboring card", () => {
  const source =
    "<><Card><CardHeader><CardTitle>Something went wrong</CardTitle></CardHeader><CardContent><div><button>Retry upload</button></div></CardContent></Card><Card><button>Delete account</button></Card></>";
  const u = extractTsx("card.tsx", source, {
    config: config("."),
    docType: "ui",
  }).find((unit) => unit.kind === "jsx-text")!;
  const context = JSON.parse(u.context.section!);
  expect(context.regionSource).toContain("Retry upload");
  expect(context.regionSource).not.toContain("Delete account");
  expect(context.target.text).toBe("Something went wrong");
});

it("omits mutually exclusive recovery while retaining the target branch and condition", () => {
  const source =
    "<section>{items.length === 0 ? <p>No items</p> : <button>Create item</button>}</section>";
  const unit = extractTsx("card.tsx", source, {
    config: config("."),
    docType: "ui",
  }).find((u) => u.kind === "jsx-text")!;
  const region = JSON.parse(unit.context.section!).regionSource;
  expect(region).toContain("items.length === 0");
  expect(region).toContain("<p>No items</p>");
  expect(region).not.toContain("Create item");
  expect(region).toContain("mutually exclusive branch omitted");
});

it("stores the context that led to a finding for an agent to verify", async () => {
  const root = temp();
  fs.writeFileSync(
    path.join(root, "card.tsx"),
    '<section role="dialog"><p>Delete project permanently?</p><button>Confirm</button></section>'
  );
  const evaluate = fakeEvaluate(() => 0.9);
  const report = await runLint(
    {
      only: ["copywriting-bare-confirm-label"],
      resultsDir: path.join(root, "results"),
      root,
      targets: ["."],
    },
    { evaluate }
  );
  expect(report.findings).toHaveLength(1);
  expect(String(evaluate.calls[0].state)).toContain(
    "Delete project permanently?"
  );
});

it("fails the opt-in regression check on false positives and refuses incomplete or dry runs", async () => {
  const root = temp();
  const id = "copywriting-bare-confirm-label";
  const items = loadCorpus(
    path.resolve("data/benchmarks/product"),
    rules
  ).filter((i) => id in i.labels);
  fs.writeFileSync(
    path.join(root, "cases.jsonl"),
    items.map((i) => JSON.stringify(i)).join("\n")
  );
  const options = {
    check: true,
    corpusDir: root,
    noCache: true,
    only: [id],
    resultsDir: path.join(root, "results"),
  };
  const wrong = await runEval(options, { evaluate: fakeEvaluate(() => 0.9) });
  expect(wrong.exitCode).toBe(1);
  expect(wrong.report).toContain("FAIL (reference disagreement)");
  const good = await runEval(options, {
    evaluate: fakeEvaluate((_id, state) =>
      state.includes("permanently") || state.includes("Pay $500") ? 0.9 : 0.1
    ),
  });
  expect(good.exitCode).toBe(0);
  await expect(runEval({ ...options, dryRun: true })).rejects.toThrow(
    "--check"
  );
  fs.writeFileSync(
    path.join(root, "cases.jsonl"),
    items
      .map((i) =>
        JSON.stringify({ ...i, context: { ...i.context, section: undefined } })
      )
      .join("\n")
  );
  const incomplete = await runEval(options, {
    evaluate: fakeEvaluate(() => 0.1),
  });
  expect(incomplete.exitCode).toBe(2);
  expect(incomplete.report).toContain("INCOMPLETE");
});

it("includes a task toolbar outside Empty presentation chrome", () => {
  const source =
    "<section><header><button>Add team</button></header><Empty><EmptyHeader><EmptyTitle>No teams assigned</EmptyTitle></EmptyHeader></Empty></section>";
  const unit = extractTsx("card.tsx", source, {
    config: config("."),
    docType: "ui",
  }).find((u) => u.text === "No teams assigned" && u.kind === "jsx-text")!;
  expect(JSON.parse(unit.context.section!).regionSource).toContain("Add team");
});
