// Mechanical checks over a class list: motion utilities (from the
// ui-animation skill's debugging tables) and design-system hygiene (the
// shadcn/lint rules). Each fires on the element's own classes; variants are
// stripped so `hover:ease-in` counts as `ease-in`.

import type { MechanicalHit, Unit } from "../types.js";

const none: MechanicalHit = { evidence: "", fired: false };

// The utility without its variant prefixes, split outside brackets.
const baseOf = (cls: string): string => {
  let depth = 0;
  let cut = 0;
  for (let i = 0; i < cls.length; i += 1) {
    const ch = cls[i];
    if (ch === "[") {
      depth += 1;
    } else if (ch === "]") {
      depth -= 1;
    } else if (ch === ":" && depth === 0) {
      cut = i + 1;
    }
  }
  return cls.slice(cut);
};

const bases = (unit: Unit): string[] => (unit.classes ?? []).map(baseOf);

const hit = (evidence: string): MechanicalHit => ({ evidence, fired: true });

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

export const CLASS_FUNCTIONS: Record<string, (unit: Unit) => MechanicalHit> = {
  // Any animate-* utility with no motion-reduce or motion-safe variant on the
  // element: the animation runs for users who asked for less motion.
  animateWithoutMotionPreference: (unit) => {
    const classes = unit.classes ?? [];
    const animated = classes
      .map(baseOf)
      .filter((c) => c.startsWith("animate-") && c !== "animate-none");
    if (animated.length === 0) {
      return none;
    }
    const guarded = classes.some(
      (c) => c.startsWith("motion-reduce:") || c.startsWith("motion-safe:")
    );
    return guarded ? none : hit(animated.join(" "));
  },
  // Any arbitrary value in brackets: a size, colour or spacing the theme does
  // not name. Selector variants such as `[&>svg]:` are variants, not values.
  arbitraryValueClass: (unit) => {
    const found = bases(unit).filter((c) => /-\[[^\]]+\]/u.test(c));
    return found.length > 0 ? hit(found.join(" ")) : none;
  },
  // A transition longer than 300ms on product UI.
  durationOver300: (unit) => {
    const list = bases(unit);
    if (!list.some((c) => c.startsWith("transition"))) {
      return none;
    }
    const slow = list.filter((c) => (durationMs(c) ?? 0) > 300);
    return slow.length > 0 ? hit(slow.join(" ")) : none;
  },
  // `ease-in` (not ease-in-out) on a transition: the motion starts slow at
  // the moment the user is watching.
  easeInOnTransition: (unit) => {
    const list = bases(unit);
    return list.includes("ease-in") && animates(list) ? hit("ease-in") : none;
  },
  // A className built from a template with `${...}`: Tailwind cannot see the
  // class, so it is not generated.
  interpolatedClassString: (unit) =>
    unit.context.interpolated ? hit((unit.classes ?? []).join(" ")) : none,
  // `ease-linear` on a transition that is not a spinner or marquee.
  linearEasingOnTransition: (unit) => {
    const list = bases(unit);
    if (!list.includes("ease-linear") || !animates(list)) {
      return none;
    }
    const constant = list.some(
      (c) => c === "animate-spin" || c.includes("marquee")
    );
    return constant ? none : hit("ease-linear");
  },
  // A palette colour with a numeric shade (bg-pink-500) rather than a theme token.
  rawColourClass: (unit) => {
    const found = bases(unit).filter((c) => PALETTE.test(c));
    return found.length > 0 ? hit(found.join(" ")) : none;
  },
  // An entrance from nothing: scale-0 or zoom-in-0 on an animated element.
  scaleFromZero: (unit) => {
    const list = bases(unit);
    const zero = list.filter((c) => c === "scale-0" || c === "zoom-in-0");
    return zero.length > 0 && animates(list) ? hit(zero.join(" ")) : none;
  },
  // `transition-all` animates every property, layout included.
  transitionAll: (unit) =>
    bases(unit).includes("transition-all") ? hit("transition-all") : none,
};
