// Build the Jev wire-format question from a rule. The structured criteria
// form ({ what, examples }) is what the API documents under primitives/advanced.

import type { Rule, SystemOneNoul } from "../types.js";

export const buildQuestion = (rule: Rule): SystemOneNoul => {
  if (!rule.question) {
    throw new Error(`Rule ${rule.id} has no question`);
  }
  const q = rule.question;
  const out: SystemOneNoul = {
    instructions: q.instructions,
    type: "noul",
  };
  if (q.criteria) {
    out.criteria = {
      false: {
        examples: q.criteria.false.examples,
        what: q.criteria.false.what,
      },
      true: { examples: q.criteria.true.examples, what: q.criteria.true.what },
    };
  }
  return out;
};
