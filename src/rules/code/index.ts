// Code rules: the same `Rule` shape the YAML loader produces, with the check
// attached instead of a `mechanical` section. A rule that counts, compares or
// measures lives here; a rule a regex or a Jev question can express lives in
// data/rules. Both load through `loadRules` and obey the same tuning overlay.

import type { Rule } from "../../types.js";
import { CLASS_RULES } from "./classes.js";
import { DOCUMENT_RULES } from "./documents.js";
import { ENGINEERING_RULES } from "./engineering.js";
import { IMAGE_RULES } from "./images.js";
import { MOTION_SOURCE_RULES } from "./motion-source.js";
import { PROSE_RULES } from "./prose.js";
import { SEO_RULES } from "./seo.js";
import { SKILL_CLASS_RULES } from "./skill-classes.js";
import { SLOP_SOURCE_RULES } from "./slop-source.js";
import { TYPOGRAPHY_RULES } from "./typography.js";

export { codeRule } from "./rule.js";
export type { CodeRuleSpec } from "./rule.js";

export const CODE_RULES: Rule[] = [
  ...TYPOGRAPHY_RULES,
  ...CLASS_RULES,
  ...DOCUMENT_RULES,
  ...IMAGE_RULES,
  ...SKILL_CLASS_RULES,
  ...MOTION_SOURCE_RULES,
  ...SLOP_SOURCE_RULES,
  ...PROSE_RULES,
  ...ENGINEERING_RULES,
  ...SEO_RULES,
];
