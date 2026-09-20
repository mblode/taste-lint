// Motion utilities (from the ui-animation skill's flag-on-sight table) and
// design-system hygiene (the shadcn/lint rules) over an element's own class
// list. Variants are stripped so `hover:ease-in` counts as `ease-in`.

import { compareScale } from "../../extract/tailwind.js";
import {
  baseClass,
  hit,
  none,
  UnresolvedError,
} from "../../reduce/mechanical.js";
import type { Rule, Unit } from "../../types.js";
import { codeRule } from "./rule.js";

const MODULE = "src/rules/code/classes.ts";
const ANIMATION = "skills/ui-animation/references";

const bases = (unit: Unit): string[] => (unit.classes ?? []).map(baseClass);

const animates = (list: string[]): boolean =>
  list.some(
    (c) =>
      c.startsWith("transition") ||
      c.startsWith("duration-") ||
      (c.startsWith("animate-") && c !== "animate-none")
  );

const durationMs = (cls: string): number | undefined => {
  const named = cls.match(/^duration-(\d+)$/u);
  if (named) {
    return Number(named[1]);
  }
  const arbitrary = cls.match(/^duration-\[(\d+(?:\.\d+)?)(ms|s)\]$/u);
  if (arbitrary) {
    return Number(arbitrary[1]) * (arbitrary[2] === "s" ? 1000 : 1);
  }
  return undefined;
};

const PALETTE =
  /^(?:bg|text|border|ring|fill|stroke|from|via|to|outline|shadow|accent|caret|decoration|divide|placeholder)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}(?:\/\d{1,3})?$/u;

const rule = (spec: Parameters<typeof codeRule>[0]): Rule =>
  codeRule(spec, MODULE);

const motion = (
  spec: Omit<Parameters<typeof codeRule>[0], "unit" | "source"> & {
    source: { path: string; line: number };
  }
): Rule =>
  rule({
    ...spec,
    source: { ...spec.source, repo: "mblode/agent-skills" },
    unit: ["class-list"],
  });

// The registry's own components are exempt: they are the design system.
const shadcn = (
  spec: Omit<
    Parameters<typeof codeRule>[0],
    "unit" | "source" | "scope" | "status"
  > & {
    ruleId: string;
  }
): Rule =>
  rule({
    ...spec,
    scope: { exclude: ["**/components/ui/**"] },
    source: {
      line: 1,
      path: "README.md",
      repo: "shadcn-ui/lint",
      ruleId: spec.ruleId,
    },
    status: "review-only",
    unit: ["class-list"],
  });

export const CLASS_RULES: Rule[] = [
  rule({
    categoryId: "look-constraints",
    check: (unit) => {
      const compared = compareScale(unit.classes ?? [], unit.context.fontScale);
      if (!compared.matches.length) {
        if (compared.unresolved.length) {
          throw new UnresolvedError(compared.unresolved.join("; "));
        }
        return none;
      }
      if (unit.context.dynamic) {
        throw new UnresolvedError(
          "Dynamic classes may override the near-scale candidate"
        );
      }
      return hit(
        compared.matches
          .map(
            ({ className, token, stepPx, difference }) =>
              `${className} is ${difference}px from ${token} (${stepPx}px)`
          )
          .join("; ")
      );
    },
    hint: "Review the matching font token before changing this value. If the difference is intentional or recurring, name the existing size in the theme instead of changing its appearance. This comparison does not establish design intent.",
    id: "craft-near-duplicate-scale",
    source: {
      line: 10,
      path: "skills/ui-design/rules/slop-near-duplicate-scale.md",
      repo: "mblode/agent-skills",
      ruleId: "slop-near-duplicate-scale",
    },
    status: "review-only",
    title: "Arbitrary font size within 1px of a declared theme step",
    unit: ["class-list"],
  }),
  motion({
    categoryId: "easing-and-duration",
    check: (unit) => {
      const list = bases(unit);
      return list.includes("ease-in") && animates(list) ? hit("ease-in") : none;
    },
    hint: "Swap ease-in for a strong ease-out (ease-out or a custom curve). The same duration reads as faster because the movement is visible at once.",
    id: "motion-ease-in-on-transition",
    source: { line: 27, path: `${ANIMATION}/debugging-symptoms.md` },
    title: "Transition eases in, so it starts slow while the user is watching",
  }),
  motion({
    categoryId: "easing-and-duration",
    check: (unit) => {
      const list = bases(unit);
      if (!list.includes("ease-linear") || !animates(list)) {
        return none;
      }
      const constant = list.some(
        (c) => c === "animate-spin" || c.includes("marquee")
      );
      return constant ? none : hit("ease-linear");
    },
    hint: "Nothing physical moves at constant speed. Use ease-out for enter and exit and ease-in-out for on-screen movement; keep ease-linear for spinners, marquees and scrubbed scroll.",
    id: "motion-linear-easing-on-transition",
    source: { line: 37, path: `${ANIMATION}/debugging-symptoms.md` },
    title: "Linear easing on motion that is not a spinner or marquee",
  }),
  motion({
    categoryId: "easing-and-duration",
    check: (unit) => {
      const list = bases(unit);
      if (!list.some((c) => c.startsWith("transition"))) {
        return none;
      }
      const slow = list.filter((c) => (durationMs(c) ?? 0) > 300);
      return slow.length > 0 ? hit(slow.join(" ")) : none;
    },
    hint: "Cut the duration. A 180ms dropdown feels more responsive than a 400ms one; only a very steep curve earns a long duration.",
    id: "motion-duration-over-300ms",
    source: { line: 29, path: `${ANIMATION}/debugging-symptoms.md` },
    title: "Transition longer than 300ms on product UI",
  }),
  motion({
    categoryId: "motion-restraint",
    check: (unit) =>
      bases(unit).includes("transition-all") ? hit("transition-all") : none,
    hint: "Name the properties: transition-transform, transition-opacity or transition-colors. transition-all also animates width, height and margin off the GPU.",
    id: "motion-transition-all",
    source: { line: 58, path: `${ANIMATION}/review-format.md` },
    title: "transition-all animates every property, layout included",
  }),
  motion({
    categoryId: "spatial-continuity",
    check: (unit) => {
      const list = bases(unit);
      const zero = list.filter((c) => c === "scale-0" || c === "zoom-in-0");
      return zero.length > 0 && animates(list) ? hit(zero.join(" ")) : none;
    },
    hint: "Start from scale-95 (0.9 to 0.96) plus opacity. Nothing real appears from nothing; a near-full start reads as already there.",
    id: "motion-scale-from-zero",
    source: { line: 46, path: `${ANIMATION}/debugging-symptoms.md` },
    title: "Entrance from scale zero",
  }),
  motion({
    categoryId: "motion-restraint",
    check: (unit) => {
      const classes = unit.classes ?? [];
      const animated = classes
        .map(baseClass)
        .filter((c) => c.startsWith("animate-") && c !== "animate-none");
      if (animated.length === 0) {
        return none;
      }
      const guarded =
        classes.includes("motion-reduce:animate-none") ||
        classes
          .filter(
            (c) =>
              baseClass(c).startsWith("animate-") &&
              baseClass(c) !== "animate-none"
          )
          .every((c) => c.split(":").includes("motion-safe"));
      return guarded ? none : hit(animated.join(" "));
    },
    hint: "Check shared CSS and component policy first. If no reduced-motion handling exists, use motion-safe:animate-* or motion-reduce:animate-none.",
    id: "motion-animate-without-reduced-motion",
    source: { line: 57, path: `${ANIMATION}/live-tuning.md` },
    // Local class evidence cannot establish global or component motion policy.
    status: "review-only",
    title: "Animation has no local reduced-motion guard",
  }),
  shadcn({
    categoryId: "colour-system",
    check: (unit) => {
      const found = bases(unit).filter((c) => PALETTE.test(c));
      return found.length > 0 ? hit(found.join(" ")) : none;
    },
    hint: "Use the theme token (bg-primary, text-muted-foreground, border-destructive). A raw bg-pink-500 escapes the colour system and ignores dark mode.",
    id: "craft-raw-colour-class",
    ruleId: "shadcn/no-raw-colors",
    title: "Palette colour with a numeric shade instead of a theme token",
  }),
  shadcn({
    categoryId: "look-constraints",
    // Selector variants such as `[&>svg]:` are variants, not values. The
    // typography pack reads arbitrary values on purpose; this is the
    // design-system view of the same class.
    check: (unit) => {
      const found = bases(unit).filter((c) => /-\[[^\]]+\]/u.test(c));
      return found.length > 0 ? hit(found.join(" ")) : none;
    },
    hint: "Step the scale (p-3, text-sm, rounded-md) or register the value in the theme so the next component can reach it by name. p-[13px] is a nudge, not a decision.",
    id: "craft-arbitrary-value-class",
    ruleId: "shadcn/no-arbitrary-values",
    title: "Arbitrary value in a utility class",
  }),
  shadcn({
    categoryId: "look-constraints",
    check: (unit) =>
      unit.context.interpolated ? hit((unit.classes ?? []).join(" ")) : none,
    hint: "Tailwind only generates classes it can read in full. Map the variable to complete class names (a lookup object or cva variants) instead of interpolating a colour into bg-...-500.",
    id: "craft-interpolated-class-string",
    ruleId: "shadcn/require-static-classes",
    title: "Class name built from a template expression",
  }),
];
