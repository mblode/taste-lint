// Code rules: the same `Rule` shape the YAML loader produces, with the check
// attached instead of a `mechanical` section. A rule that counts, compares or
// measures lives here; a rule a regex or a Jev question can express lives in
// data/rules. Both load through `loadRules` and obey the same tuning overlay.

import type { Rule } from "../../types.js";
import { ARCHITECTURE_RULES } from "./architecture.js";
import { CLASS_RULES } from "./classes.js";
import { DISCOVERY_RULES } from "./discovery.js";
import { DOCUMENT_RULES } from "./documents.js";
import { IMAGE_RULES } from "./images.js";
import { REPOSITORY_RULES } from "./repository.js";
import { SKILL_CLASS_RULES } from "./skill-classes.js";
import { TYPOGRAPHY_RULES } from "./typography.js";

export { codeRule } from "./rule.js";
export type { CodeRuleSpec } from "./rule.js";

export const CODE_RULES: Rule[] = [
  ...TYPOGRAPHY_RULES,
  ...CLASS_RULES,
  ...DOCUMENT_RULES,
  ...DISCOVERY_RULES,
  ...IMAGE_RULES,
  ...REPOSITORY_RULES,
  ...SKILL_CLASS_RULES,
  ...ARCHITECTURE_RULES,
];
