// Code rules: the same `Rule` shape the YAML loader produces, with the check
// attached instead of a `mechanical` section. A rule that counts, compares or
// measures lives here; a rule a regex or a Jev question can express lives in
// data/rules. Both load through `loadRules` and obey the same tuning overlay.

import type { Rule } from "../../types.js";
import { CLASS_RULES } from "./classes.js";
import { TYPOGRAPHY_RULES } from "./typography.js";

export { codeRule } from "./rule.js";
export type { CodeRuleSpec } from "./rule.js";

export const CODE_RULES: Rule[] = [...TYPOGRAPHY_RULES, ...CLASS_RULES];
