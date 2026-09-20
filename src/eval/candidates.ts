import { isCandidateRule } from "../rules/review.js";
import type { CorpusItem, Rule } from "../types.js";

/** A pattern's presence or absence is not a labeled defect judgment. */
export const abstainCandidates = (
  items: CorpusItem[],
  rules: Rule[],
  probabilities: Map<string, Record<string, number>>,
  unknowns: { itemId: string; ruleId: string; reason: string }[]
): void => {
  for (const rule of rules.filter(isCandidateRule)) {
    for (const item of items) {
      const answers = probabilities.get(item.id);
      if (answers?.[rule.id] === undefined) {
        continue;
      }
      probabilities.set(
        item.id,
        Object.fromEntries(
          Object.entries(answers).filter(([id]) => id !== rule.id)
        )
      );
      unknowns.push({
        itemId: item.id,
        reason:
          "Candidate search requires verification before a defect judgment",
        ruleId: rule.id,
      });
    }
  }
};
