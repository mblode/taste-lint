import fs from "node:fs";
import path from "node:path";

import { afterEach, expect, it } from "vitest";

import { loadCorpus, unitFromItem } from "../eval/corpus.js";
import { extractTsx } from "../extract/tsx.js";
import { runLint } from "../lint.js";
import { AnswerCache } from "../map/cache.js";
import { ProviderError } from "../map/jev.js";
import { judge } from "../map/judge.js";
import { planRequests } from "../map/plan.js";
import { buildState } from "../map/state.js";
import { CLASS_RULES } from "../rules/code/classes.js";
import { makeSamples } from "../scan/samples.js";
import { config, fakeEvaluate, rule, temporary } from "./helpers.js";

const style = CLASS_RULES.find((r) => r.id === "craft-arbitrary-value-class")!;
const dirs: string[] = [];
const temp = () => {
  const dir = temporary();
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of dirs.splice(0)) {
    fs.rmSync(dir, { force: true, recursive: true });
  }
});
const extract = (source: string) =>
  extractTsx("card.tsx", source, { config: config("."), docType: "ui" });
const source =
  '<section aria-label="Invoice status"><span className="text-sm">Paid</span><span className="text-[13px]">Pending</span></section>';
const target = () =>
  extract(source).find((u) => u.classes?.includes("text-[13px]"))!;

it("captures the target, enclosing element and nearby JSX for a contextual style judgment", () => {
  const unit = target();
  const context = JSON.parse(unit.context.section!);
  expect(context.target).toMatchObject({
    candidates: ["text-[13px]"],
    text: "Pending",
  });
  expect(context.parent.opening).toContain('aria-label="Invoice status"');
  expect(context.nearby).toEqual([
    { opening: '<span className="text-sm">', text: "Paid" },
  ]);
  const plan = planRequests([unit], [style], config("."));
  expect(plan.mechanical).toHaveLength(0);
  expect(plan.jobs).toHaveLength(1);
  expect(style.tier).toBe("both");
  expect(style.status).toBe("review-only");
});

it("requires complete static context only after a literal candidate is found", () => {
  const unit = target();
  for (const context of [
    { ...unit.context, section: undefined },
    { ...unit.context, section: "x".repeat(20_000) },
    { ...unit.context, dynamic: true },
  ]) {
    const plan = planRequests([{ ...unit, context }], [style], config("."));
    expect(plan.jobs).toHaveLength(0);
    expect(plan.unknowns).toHaveLength(1);
    expect(plan.negatives.size).toBe(0);
  }
  const plan = planRequests(
    [
      {
        ...unit,
        classes: ["h-[var(--height)]"],
        context: { ...unit.context, section: undefined },
      },
    ],
    [style],
    config(".")
  );
  expect(plan.unknowns).toHaveLength(0);
  expect(plan.negatives.get(unit.id)?.has(style.id)).toBe(true);
});

it("isolates enriched style questions, reuses answers and invalidates changed contextual evidence", async () => {
  const unit = target();
  const local = rule({ id: "copywriting-local", unit: ["class-list"] });
  const evaluate = fakeEvaluate(() => 0.9);
  const options = {
    cache: new AnswerCache(temp()),
    config: config("."),
    evaluate,
    model: "jev-latest",
  };
  const first = await judge([unit], [style, local], options);
  expect(first.usage.requests).toBe(2);
  expect(
    evaluate.calls.find((c) => c.questions[local.id])?.state
  ).not.toContain("SECTION:");
  expect(evaluate.calls.find((c) => c.questions[style.id])?.state).toContain(
    "Invoice status"
  );
  const warm = await judge([unit], [style, local], options);
  expect(warm.usage.requests).toBe(0);
  const changed = {
    ...unit,
    context: {
      ...unit.context,
      section: unit.context.section!.replace("Invoice status", "Partner logo"),
    },
  };
  const refreshed = await judge([changed], [style, local], options);
  expect(refreshed.usage.requests).toBe(1);
  expect(Object.keys(evaluate.calls.at(-1)!.questions)).toEqual([style.id]);
});

it("preserves style evidence in exported samples and corpus replay", () => {
  const unit = target();
  const sample = makeSamples(
    [unit],
    [style],
    new Map([[unit.id, { [style.id]: 0.9 }]]),
    new Map()
  )[0];
  const directory = temp();
  const file = path.join(directory, "style.jsonl");
  const item = {
    ...sample.item,
    labelSource: "hand",
    labels: { [style.id]: true },
  };
  fs.writeFileSync(file, JSON.stringify(item));
  const replay = unitFromItem(loadCorpus(directory, [style])[0]);
  expect(buildState(replay, [style])).toEqual(buildState(unit, [style]));
  fs.writeFileSync(
    file,
    JSON.stringify({ ...item, context: { ...item.context, section: {} } })
  );
  expect(() => loadCorpus(directory, [style])).toThrow(
    /section must be a string/
  );
});

it("lets Jev decide reporting and never falls back to a mechanical warning on provider failure", async () => {
  const root = temp();
  fs.writeFileSync(path.join(root, "card.tsx"), source);
  const options = {
    only: [style.id],
    resultsDir: path.join(root, "positive"),
    root,
    targets: ["card.tsx"],
  };
  const positive = await runLint(options, {
    evaluate: fakeEvaluate(() => 0.9),
  });
  expect(positive.findings).toMatchObject([
    { band: "review", probability: 0.9, tier: "both" },
  ]);
  const negative = await runLint(
    { ...options, resultsDir: path.join(root, "negative") },
    { evaluate: fakeEvaluate(() => 0.05) }
  );
  expect(negative.findings).toHaveLength(0);
  expect(negative.coverage?.byRule[style.id].answered).toBe(1);
  const failed = await runLint(
    { ...options, resultsDir: path.join(root, "failed") },
    { evaluate: () => Promise.reject(new ProviderError("provider_error", 503)) }
  );
  expect(failed.status).toBe("incomplete");
  expect(failed.findings).toHaveLength(0);
  expect(failed.unknowns).toMatchObject([
    { reason: "provider_error", ruleId: style.id },
  ]);
});
