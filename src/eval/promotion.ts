import { binaryMetrics } from "../lib/stats.js";
import type { CorpusItem } from "../types.js";
import { corpusCoverage } from "./coverage.js";
import type { RuleEval } from "./metrics.js";

export interface PromotionEvidence {
  eligible: boolean;
  n: number;
  precisionLower: number;
  reason: string;
}

// Threshold selection owns dev data. This gate only validates that fixed choice.
export const promotionEvidence = (
  items: CorpusItem[],
  ruleId: string,
  pairs: RuleEval["pairs"],
  threshold: number,
  floor: number,
  minItems: number
): PromotionEvidence => {
  const labeled = items.filter((item) => ruleId in item.labels);
  const holdout = labeled.filter((item) => item.split === "holdout");
  const coverage = corpusCoverage(labeled, []);
  const metrics = binaryMetrics(
    pairs.map((pair) => ({
      label: pair.label,
      predicted: pair.probability >= threshold,
    }))
  );
  const rejection =
    coverage.overlappingSources.length ||
    coverage.overlappingTexts ||
    coverage.overlappingFamilies
      ? "Dev and holdout share source files or duplicate text; rebuild independent splits."
      : pairs.length !== holdout.length
        ? "Some holdout labels were skipped or unresolved."
        : pairs.length < minItems
          ? `Need at least ${minItems} evaluated holdout items.`
          : !pairs.some((pair) => pair.label) ||
              !pairs.some((pair) => !pair.label)
            ? "Holdout needs both positive and negative labels."
            : metrics.precisionCI[0] < floor
              ? "Held-out precision lower bound does not clear the floor."
              : undefined;
  return {
    eligible: rejection === undefined,
    n: pairs.length,
    precisionLower: metrics.precisionCI[0],
    reason: rejection ?? "Independent holdout clears the precision floor.",
  };
};
