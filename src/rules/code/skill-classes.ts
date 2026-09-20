import { baseClass, none, hit } from "../../reduce/mechanical.js";
import type { Unit } from "../../types.js";
import { codeRule } from "./rule.js";

const make = (
  id: string,
  title: string,
  categoryId: string,
  source: string,
  check: (u: Unit) => ReturnType<typeof hit>,
  hint: string
) =>
  codeRule(
    {
      categoryId,
      check,
      hint,
      id,
      source: {
        line: 1,
        path: `skills/${source}`,
        repo: "mblode/agent-skills",
      },
      status: "review-only",
      title,
      unit: ["class-list"],
    },
    "src/rules/code/skill-classes.ts"
  );

export const SKILL_CLASS_RULES = [
  make(
    "motion-reduced-motion-animation",
    "Continuous animation explicitly targets reduced-motion users",
    "motion-restraint",
    "ui-animation/references/live-tuning.md",
    (u) => {
      const found = u.classes?.find(
        (c) =>
          c.split(":").includes("motion-reduce") &&
          ["animate-spin", "animate-ping", "animate-bounce"].includes(
            baseClass(c)
          )
      );
      return found ? hit(found) : none;
    },
    "Check the rendered reduced-motion state. Prefer a static indicator or motion-safe animation for continuous motion."
  ),
  make(
    "typography-justify-without-hyphens",
    "Justified text explicitly disables hyphenation",
    "reading-comfort",
    "typography-audit/rules/layout-justified-text.md",
    (u) => {
      const list = u.classes ?? [];
      return list.includes("text-justify") && list.includes("hyphens-none")
        ? hit("text-justify with hyphens-none")
        : none;
    },
    "Prefer start alignment, or enable language-aware hyphenation and verify the rendered measure."
  ),
  make(
    "typography-disabled-kerning",
    "Text explicitly disables font kerning",
    "typographic-detail",
    "typography-audit/rules/opentype-kerning.md",
    (u) =>
      u.text.trim() && u.classes?.includes("[font-kerning:none]")
        ? hit("font-kerning: none")
        : none,
    "Use the font's kerning unless the design has a deliberate exception."
  ),
  make(
    "typography-stretched-glyphs",
    "Text glyphs are horizontally stretched",
    "type-quality",
    "typography-audit/rules/font-condensed-extended.md",
    (u) => {
      if (
        !u.text.trim() ||
        !["body", "heading", "label"].includes(u.context.role)
      ) {
        return none;
      }
      const distorted = u.classes?.find((c) =>
        /^scale-x-(?:50|75|90|95|105|110|125|150|200)$/.test(c)
      );
      return distorted ? hit(distorted) : none;
    },
    "Use a condensed/extended font or supported width axis; inspect intentional animation transforms separately."
  ),
  make(
    "motion-layout-property-transition",
    "Transition explicitly animates layout properties",
    "motion-restraint",
    "ui-animation/references/performance-deep-dive.md",
    (u) => {
      const cls = u.classes?.find((c) =>
        /^transition-\[(?:[^\]]*,)?(?:width|height|top|left|right|bottom|margin|padding)(?:,|\])/.test(
          baseClass(c)
        )
      );
      return cls ? hit(cls) : none;
    },
    "Prefer transform/opacity for frequent motion; measure deliberate container resizing before changing it."
  ),
];
