// Diagnostics that run alongside a baseline: grader consistency, headroom,
// and the general-policy guard against quoting corpus items in rule text.
// An injected evaluate keeps this offline; nothing reaches a model.
import path from "node:path";

import { expect, it } from "vitest";

import { runConsistency } from "../eval/consistency.js";
import { loadCorpus, resolveCorpusDir } from "../eval/corpus.js";
import { HEADROOM_FLOOR, headroomWarnings } from "../eval/headroom.js";
import type { RuleEval } from "../eval/metrics.js";
import { checkGeneralPolicy, questionStrings } from "../eval/originality.js";
import { renderHtmlReport } from "../eval/report.js";
import { loadRules, resolveRulesDir } from "../rules/load.js";
import type { CorpusItem, Question } from "../types.js";
import { fakeEvaluate, temporary } from "./helpers.js";

const root = path.resolve(import.meta.dirname, "../..");
const RULE_ID = "copywriting-claim-without-evidence";

it("reports a flip whenever the same (item, rule) is judged differently across two live passes", async () => {
  const rulesDir = resolveRulesDir(path.join(root, "data/rules"));
  const rules = loadRules(rulesDir, { only: [RULE_ID] });
  const knownRuleIds = new Set(
    loadRules(rulesDir, { allowDraft: true }).map((r) => r.id)
  );
  const items = loadCorpus(
    resolveCorpusDir(path.join(root, "data/corpus")),
    rules,
    { knownRuleIds }
  )
    .filter((i) => i.split === "dev" && RULE_ID in i.labels)
    .slice(0, 3);
  expect(items.length).toBeGreaterThan(0);
  // Every (item, rule) pair is asked twice, once per pass; the first call
  // for a key answers 1, the second answers 0, guaranteeing a flip so the
  // counting logic (not the judge) is what this test proves.
  const seen = new Map<string, number>();
  const evaluate = fakeEvaluate((ruleId, state) => {
    const key = `${ruleId}::${state}`;
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    return count === 1 ? 1 : 0;
  });
  const result = await runConsistency(items, rules, evaluate, {
    resultsDir: temporary(),
    sampleSize: items.length,
  });
  // Items a mechanical precondition already resolved never reach the judge,
  // so only the items that actually asked Jev twice can flip; the flip rate
  // reflects exactly that share.
  expect(result.n).toBeGreaterThan(0);
  expect(result.flips.length).toBeGreaterThan(0);
  expect(result.flipRate).toBe(result.flips.length / result.n);
  expect(result.flipRateCI[0]).toBeGreaterThanOrEqual(0);
});

it("reports no flips when both passes agree", async () => {
  const rulesDir = resolveRulesDir(path.join(root, "data/rules"));
  const rules = loadRules(rulesDir, { only: [RULE_ID] });
  const knownRuleIds = new Set(
    loadRules(rulesDir, { allowDraft: true }).map((r) => r.id)
  );
  const items = loadCorpus(
    resolveCorpusDir(path.join(root, "data/corpus")),
    rules,
    { knownRuleIds }
  )
    .filter((i) => i.split === "dev" && RULE_ID in i.labels)
    .slice(0, 2);
  const result = await runConsistency(
    items,
    rules,
    fakeEvaluate(() => 1),
    {
      resultsDir: temporary(),
      sampleSize: items.length,
    }
  );
  expect(result.flips).toEqual([]);
  expect(result.flipRate).toBe(0);
});

it("warns on headroom only once a rule's lower-bound CI clears the floor with enough items", () => {
  const highPrecision: RuleEval = {
    calibration: [],
    metrics: {
      f1: 0.97,
      fn: 1,
      fp: 0,
      precision: 1,
      precisionCI: [0.97, 1],
      recall: 0.97,
      recallCI: [0.9, 0.99],
      tn: 0,
      tnr: 0,
      tnrCI: [0, 1],
      tp: 40,
    },
    n: 41,
    pairs: [],
    reviewRate: 0,
    ruleId: "high-precision-rule",
    unknown: 0,
  };
  const smallSample: RuleEval = {
    ...highPrecision,
    n: 5,
    ruleId: "small-sample-rule",
  };
  const warnings = headroomWarnings([highPrecision, smallSample]);
  expect(warnings.map((w) => w.ruleId)).toEqual(["high-precision-rule"]);
  expect(warnings[0].value).toBeGreaterThanOrEqual(HEADROOM_FLOOR);
});

it("flags rule text that shares a long run of words with a corpus item", () => {
  const corpus: Pick<CorpusItem, "id" | "text">[] = [
    {
      id: "item-1",
      text: "Save 40% on your first order when you subscribe today",
    },
  ];
  const quoting: Question = {
    criteria: {
      false: { examples: [], what: "does not apply" },
      true: {
        examples: ["Save 40% on your first order when you subscribe today"],
        what: "makes an unverifiable claim",
      },
    },
    instructions: "Flag copy that makes a claim with no evidence nearby.",
  };
  const general: Question = {
    criteria: {
      false: { examples: [], what: "does not apply" },
      true: {
        examples: ["Best-selling product in its category"],
        what: "makes an unverifiable claim",
      },
    },
    instructions: "Flag copy that makes a claim with no evidence nearby.",
  };
  expect(
    checkGeneralPolicy(questionStrings(quoting), corpus).length
  ).toBeGreaterThan(0);
  expect(checkGeneralPolicy(questionStrings(general), corpus)).toEqual([]);
});

it("renders a static HTML report with a row per case and no network dependencies", () => {
  const evals: RuleEval[] = [
    {
      calibration: [],
      metrics: {
        f1: 1,
        fn: 0,
        fp: 0,
        precision: 1,
        precisionCI: [0.5, 1],
        recall: 1,
        recallCI: [0.5, 1],
        tn: 0,
        tnr: 0,
        tnrCI: [0, 1],
        tp: 1,
      },
      n: 1,
      pairs: [{ id: "case-1", label: true, probability: 0.9 }],
      reviewRate: 0,
      ruleId: RULE_ID,
      unknown: 0,
    },
  ];
  const items: CorpusItem[] = [
    {
      categoryId: "copywriting",
      id: "case-1",
      kind: "paragraph",
      labelSource: "hand",
      labels: { [RULE_ID]: true },
      source: { path: "app.tsx", repo: "fixture" },
      split: "dev",
      text: "Guaranteed to work every time.",
    },
  ];
  const html = renderHtmlReport(evals, items);
  expect(html).toContain("<!doctype html>");
  expect(html).toContain(RULE_ID);
  expect(html).toContain("case-1");
  expect(html).not.toMatch(/https?:\/\//);
  expect(html).not.toContain("<script");
});
