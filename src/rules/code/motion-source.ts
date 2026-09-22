// Source checks from ui-animation that Tailwind class lists cannot see:
// hand-written CSS declarations and the motion package import.

import { none } from "../../reduce/mechanical.js";
import type { MechanicalHit, Unit } from "../../types.js";
import { codeRule } from "./rule.js";

const ANIMATION = "skills/ui-animation/SKILL.md";

// Blank comments so a commented-out declaration or import never fires, while
// keeping offsets aligned with the file.
const stripComments = (text: string): string =>
  text.replaceAll(/\/\*[\s\S]*?\*\/|(?<![:"'\w])\/\/[^\n]*/gu, (m) =>
    m.replaceAll(/[^\n]/gu, " ")
  );

const first = (unit: Unit, re: RegExp, evidence: string): MechanicalHit => {
  const m = re.exec(stripComments(unit.text));
  return m ? { evidence, fired: true, offset: m.index } : none;
};

export const MOTION_SOURCE_RULES = [
  codeRule(
    {
      categoryId: "motion-restraint",
      check: (unit) =>
        first(
          unit,
          /(?:^|[{;\s])transition(?:-property)?\s*:\s*["'`]?all\b/mu,
          "transition: all"
        ),
      hint: "List the properties: transition: transform 200ms, opacity 200ms. `all` animates layout and silently adopts properties added later.",
      id: "motion-css-transition-all",
      scope: {
        include: ["**/*.css", "**/*.scss", "**/*.tsx", "**/*.jsx"],
      },
      source: { line: 67, path: ANIMATION, repo: "mblode/agent-skills" },
      title: "transition: all animates every property, layout included",
      unit: ["source"],
    },
    "src/rules/code/motion-source.ts"
  ),
  codeRule(
    {
      categoryId: "motion-restraint",
      check: (unit) =>
        first(
          unit,
          /\bfrom\s*["']framer-motion(?:\/[^"']*)?["']|\b(?:import|require)\s*\(\s*["']framer-motion["']/u,
          "imports framer-motion"
        ),
      hint: 'Install `motion` and import from "motion/react". A mixed codebase compiles but ships two copies of the library.',
      id: "motion-framer-motion-import",
      scope: {
        include: [
          "**/*.tsx",
          "**/*.jsx",
          "**/*.ts",
          "**/*.js",
          "**/*.mjs",
          "**/*.mts",
        ],
      },
      source: { line: 153, path: ANIMATION, repo: "mblode/agent-skills" },
      title: "Imports framer-motion instead of motion/react",
      unit: ["source"],
    },
    "src/rules/code/motion-source.ts"
  ),
];
