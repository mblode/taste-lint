// Headroom check: a rule already scoring near-perfect on its held-out
// evidence has no quality room left to hillclimb. Chasing it further mostly
// fits noise. Past this floor the right lever is cost (a cheaper model,
// fewer calls, or a mechanical replacement of the question), not the rubric.
// See docs/eval.mdx.

import type { RuleEval } from "./metrics.js";

export const HEADROOM_FLOOR = 0.95;
/** Below this many evaluated items a 95%+ reading is not evidence of headroom. */
const MIN_ITEMS_FOR_HEADROOM = 20;

export interface HeadroomWarning {
  ruleId: string;
  metric: "precision" | "recall";
  value: number;
  n: number;
}

// Warn once per rule, on whichever of precision/recall is closer to the
// promotion gate (precision) first, then recall; a rule can be at ceiling on
// one and not the other.
export const headroomWarnings = (evals: RuleEval[]): HeadroomWarning[] =>
  evals.flatMap((e) => {
    if (e.n < MIN_ITEMS_FOR_HEADROOM) {
      return [];
    }
    const warnings: HeadroomWarning[] = [];
    if (e.metrics.precisionCI[0] >= HEADROOM_FLOOR) {
      warnings.push({
        metric: "precision",
        n: e.n,
        ruleId: e.ruleId,
        value: e.metrics.precision,
      });
    }
    if (e.metrics.recallCI[0] >= HEADROOM_FLOOR) {
      warnings.push({
        metric: "recall",
        n: e.n,
        ruleId: e.ruleId,
        value: e.metrics.recall,
      });
    }
    return warnings;
  });

export const renderHeadroomWarnings = (warnings: HeadroomWarning[]): string =>
  warnings.length === 0
    ? ""
    : `${[
        "Headroom:",
        ...warnings.map(
          (w) =>
            `  ${w.ruleId}: ${w.metric} ${(w.value * 100).toFixed(0)}% (lower bound clears ${(HEADROOM_FLOOR * 100).toFixed(0)}%, n=${w.n}). No quality headroom left; tune for cost instead (cheaper model, fewer calls, or a mechanical replacement).`
        ),
      ].join("\n")}\n`;
