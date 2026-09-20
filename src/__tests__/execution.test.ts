import fs from "node:fs";

import { afterEach, expect, it } from "vitest";

import { scoreItems } from "../eval/metrics.js";
import { prepareRequests, runRequests } from "../map/batch.js";
import { AnswerCache } from "../map/cache.js";
import { ProviderError } from "../map/jev.js";
import { judge, prepareJudgement, executeJudgement } from "../map/judge.js";
import { Limiter } from "../map/limiter.js";
import type { Unit, Progress } from "../types.js";
import { config, fakeEvaluate, rule, temporary } from "./helpers.js";

const dirs: string[] = [];
const cache = () => {
  const dir = temporary();
  dirs.push(dir);
  return new AnswerCache(dir);
};
afterEach(() => {
  for (const dir of dirs.splice(0)) {
    fs.rmSync(dir, { force: true, recursive: true });
  }
});
const unit = (id: string, text = "Shared copy."): Unit => ({
  codeSpans: [],
  column: 1,
  context: { docType: "explanation", role: "body" },
  endColumn: 10,
  endLine: 1,
  file: `${id}.md`,
  id,
  inCode: false,
  kind: "paragraph",
  line: 1,
  sourceEnd: text.length,
  sourceStart: 0,
  text,
});
it("prepares once and shares requests without losing provenance", async () => {
  const evaluate = fakeEvaluate(() => 0.8);
  const options = { cache: cache(), config: config("."), model: "jev-latest" };
  const prepared = prepareJudgement([unit("a"), unit("b")], [rule()], options);
  const preview = await executeJudgement(prepared, options);
  expect(preview.estimatedRequests).toBe(1);
  const events: Progress[] = [];
  const run = await executeJudgement(prepared, {
    ...options,
    evaluate,
    onProgress: (e) => events.push(e),
  });
  expect(evaluate.calls).toHaveLength(1);
  expect(run.answers.get("a")).toEqual(run.answers.get("b"));
  expect(run.usage.sharedAnswers).toBe(1);
  expect(events.at(-1)).toMatchObject({
    completed: 1,
    phase: "complete",
    planned: 1,
  });
  expect(run.coverage.byRule[rule().id]).toMatchObject({
    answered: 2,
    eligible: 2,
    pending: 0,
    unknown: 0,
  });
});
it("retries only unresolved units and preserves cached success", async () => {
  const units = [unit("a", "Good"), unit("b", "Retry")];
  const options = { cache: cache(), config: config("."), model: "jev-latest" };
  const good = fakeEvaluate(() => 0.2);
  const first = await judge(units, [rule()], {
    ...options,
    evaluate: (req) =>
      String(req.state).includes("Retry")
        ? Promise.reject(new ProviderError("provider_error", 503))
        : good(req),
  });
  expect(first.unknowns).toHaveLength(1);
  const retry = fakeEvaluate(() => 0.3);
  const second = await judge(units, [rule()], { ...options, evaluate: retry });
  expect(retry.calls).toHaveLength(1);
  expect(second.usage.cached).toBe(1);
  expect(second.unknowns).toHaveLength(0);
});
it("does not turn inapplicable corpus checks into negative labels", async () => {
  const r = rule({
    check: () => ({ evidence: "", fired: false }),
    preconditions: { docType: ["marketing"] },
    question: undefined,
    tier: "mechanical",
  });
  const item = {
    categoryId: r.categoryId,
    context: { docType: "reference" as const },
    id: "sample",
    kind: "paragraph" as const,
    labelSource: "hand" as const,
    labels: { [r.id]: true },
    source: { path: "sample.md", repo: "test" },
    split: "dev" as const,
    text: "Text",
  };
  const result = await scoreItems([item], [r], {
    cache: cache(),
    model: "jev-latest",
  });
  expect(result.probabilities.get("sample")).toEqual({});
  expect(result.skipped).toEqual([
    { itemId: "sample", reason: "precondition", ruleId: r.id },
  ]);
});
it("schedules 5123 requests within the concurrency bound using a fake clock", async () => {
  let clock = 0;
  let inFlight = 0;
  let maximum = 0;
  const limiter = new Limiter(
    20,
    8,
    () => clock,
    (ms) => {
      clock += ms;
      return Promise.resolve();
    }
  );
  const c = cache();
  const jobs = Array.from({ length: 5123 }, (_, i) => ({
    rules: [{ rule: rule() }],
    unit: unit(`${i}`, `Unique ${i}`),
  }));
  const evaluate = fakeEvaluate(() => 0.1);
  const result = await runRequests(prepareRequests(jobs, c, "jev-latest"), {
    cache: c,
    evaluate: async (req) => {
      inFlight += 1;
      maximum = Math.max(maximum, inFlight);
      const response = await evaluate(req);
      inFlight -= 1;
      return response;
    },
    limiter,
    model: "jev-latest",
  });
  expect(maximum).toBeLessThanOrEqual(8);
  expect(result.requests).toBe(5123);
  expect(result.errors).toBe(0);
  expect(clock).toBeGreaterThan(0);
});

it("skips the explicitly excluded document types before scheduling polish checks", async () => {
  const { loadRules } = await import("../rules/load.js");
  const rules = loadRules("data/rules", {
    only: ["copywriting-unnatural-polish"],
  });
  const evaluate = fakeEvaluate(() => 0.9);
  const reference = {
    ...unit("reference"),
    context: { docType: "reference" as const, role: "body" as const },
  };
  const ui = {
    ...unit("ui"),
    context: { docType: "ui" as const, role: "body" as const },
  };
  const result = await judge([reference, ui, unit("essay")], rules, {
    cache: cache(),
    config: config("."),
    evaluate,
    model: "jev-latest",
  });
  expect(evaluate.calls).toHaveLength(1);
  expect(result.skipped.get("reference")).toEqual({
    "copywriting-unnatural-polish": "precondition",
  });
  expect(result.coverage.byRule["copywriting-unnatural-polish"]).toMatchObject({
    answered: 1,
    eligible: 1,
    skipped: 2,
  });
});

it("treats disabled model rules as skipped, never pending", async () => {
  const result = await judge([unit("a")], [rule()], {
    cache: cache(),
    config: config("."),
    mechanicalOnly: true,
    model: "jev-latest",
  });
  expect(result.coverage.byRule[rule().id]).toMatchObject({
    eligible: 0,
    pending: 0,
    skipped: 1,
  });
  expect(result.skipped.get("a")?.[rule().id]).toBe("mechanical_only");
});

it("keeps the sentence threshold independent of quoted versus unquoted prose", async () => {
  const { check } = await import("./helpers.js");
  const longSentence = check("copywriting-long-sentence");
  const words = Array.from({ length: 26 }, () => "word").join(" ");
  expect(longSentence(unit("quote", `“${words}.”`)).fired).toBe(true);
  expect(longSentence(unit("plain", words)).fired).toBe(true);
});

it("propagates recorder failure without relabeling successful provider output", async () => {
  const prepared = prepareRequests(
    [{ rules: [{ rule: rule() }], unit: unit("a") }],
    cache(),
    "jev-latest"
  );
  const failure = new Error("Recorder unavailable");
  const seen: Record<string, unknown>[] = [];
  const evaluate = fakeEvaluate(() => 0.9);
  await expect(
    runRequests(prepared, {
      cache: cache(),
      evaluate,
      model: "jev-latest",
      recorder: {
        append: (record) => {
          seen.push(record);
          throw failure;
        },
        file: "unused",
        summary: (record) => record,
      },
    })
  ).rejects.toBe(failure);
  expect(evaluate.calls).toHaveLength(1);
  expect(seen).toMatchObject([{ status: "ok" }]);
});
