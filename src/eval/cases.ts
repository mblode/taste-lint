// One JSONL line per (item, rule) case: the offline HTML report and any
// future tooling read this, never the tty prose. See docs/eval.mdx.

import type { RecorderHandle, CorpusItem, Rule } from "../types.js";
import type { RuleEval } from "./metrics.js";

export const recordCases = (
  recorder: RecorderHandle | undefined,
  evals: RuleEval[],
  items: CorpusItem[],
  rules: Rule[]
): void => {
  if (!recorder) {
    return;
  }
  const itemById = new Map(items.map((i) => [i.id, i]));
  for (const e of evals) {
    const rule = rules.find((r) => r.id === e.ruleId);
    for (const pair of e.pairs) {
      const item = itemById.get(pair.id);
      recorder.append({
        categoryId: item?.categoryId,
        correct:
          rule === undefined
            ? undefined
            : pair.probability >= rule.thresholds.act === pair.label,
        kind: "case",
        label: pair.label,
        predicted: rule ? pair.probability >= rule.thresholds.act : undefined,
        probability: pair.probability,
        ruleId: e.ruleId,
        source: item?.source,
        split: item?.split,
        unitId: pair.id,
      });
    }
  }
};
