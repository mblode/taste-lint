// Resolve Tailwind v4 utility classes to typography values. Only the static
// default scale and arbitrary values are resolved. Anything else is listed as
// unresolved so a rule that needs the value can abstain instead of guessing.

import type { Config, ResolvedTypography } from "../types.js";

const ROOT_PX = 16;

const FONT_SIZES: Record<string, [number, number]> = {
  "2xl": [24, 32],
  "3xl": [30, 36],
  "4xl": [36, 40],
  "5xl": [48, 48],
  "6xl": [60, 60],
  "7xl": [72, 72],
  "8xl": [96, 96],
  "9xl": [128, 128],
  base: [16, 24],
  lg: [18, 28],
  sm: [14, 20],
  xl: [20, 28],
  xs: [12, 16],
};

const LEADING: Record<string, number> = {
  loose: 2,
  none: 1,
  normal: 1.5,
  relaxed: 1.625,
  snug: 1.375,
  tight: 1.25,
};

const TRACKING: Record<string, number> = {
  normal: 0,
  tight: -0.025,
  tighter: -0.05,
  wide: 0.025,
  wider: 0.05,
  widest: 0.1,
};

const WEIGHTS: Record<string, number> = {
  black: 900,
  bold: 700,
  extrabold: 800,
  extralight: 200,
  light: 300,
  medium: 500,
  normal: 400,
  semibold: 600,
  thin: 100,
};

const COLOUR_NAMES = new Set([
  "inherit",
  "current",
  "transparent",
  "black",
  "white",
  "slate",
  "gray",
  "zinc",
  "neutral",
  "stone",
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
  "foreground",
  "background",
  "muted",
  "muted-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "card-foreground",
  "popover-foreground",
]);

const parseLength = (raw: string): number | null => {
  const m = raw.match(/^(-?\d*\.?\d+)(px|rem|em)?$/);
  if (!m) {
    return null;
  }
  const value = Number(m[1]);
  if (m[2] === "rem" || m[2] === "em") {
    return value * ROOT_PX;
  }
  return value;
};

const parseEm = (raw: string): number | null => {
  const m = raw.match(/^(-?\d*\.?\d+)(em|px)?$/);
  if (!m) {
    return null;
  }
  const value = Number(m[1]);
  return m[2] === "px" ? value / ROOT_PX : value;
};

const stripVariants = (cls: string): { base: string; variants: string[] } => {
  // Variants are colon-separated prefixes; arbitrary values may contain colons
  // inside brackets, so split only outside brackets.
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of cls) {
    if (ch === "[") {
      depth += 1;
    } else if (ch === "]") {
      depth -= 1;
    }
    if (ch === ":" && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current);
  const base = parts.pop() ?? "";
  return { base, variants: parts };
};

const isColour = (token: string): boolean => {
  if (
    token.startsWith("[#") ||
    token.startsWith("[rgb") ||
    token.startsWith("[hsl") ||
    token.startsWith("[oklch") ||
    token.startsWith("[var(")
  ) {
    return true;
  }
  return COLOUR_NAMES.has(token.replace(/-\d{2,3}$/, ""));
};

export const resolveTypography = (
  classes: string[],
  config?: Config
): ResolvedTypography => {
  const out: ResolvedTypography = { colourClasses: [], unresolved: [] };
  const theme = config?.tailwind.theme ?? {};
  // A size class brings a default line height; an explicit leading wins, and a
  // later size class replaces an earlier size's default (cn("text-sm", "text-lg")).
  let lineHeightFromSize = false;
  const applyLeading = (token: string, cls: string): void => {
    lineHeightFromSize = false;
    resolveLeading(out, token, cls);
  };
  for (const cls of classes) {
    const { base, variants } = stripVariants(cls);
    // Responsive and state variants are recorded but not judged in v1.
    if (variants.some((v) => !["dark"].includes(v))) {
      continue;
    }
    if (base.startsWith("text-")) {
      const token = base.slice("text-".length);
      const [sizeToken, leadingToken] = token.split("/");
      if (isColour(sizeToken)) {
        out.colourClasses.push(cls);
        continue;
      }
      if (
        [
          "left",
          "center",
          "right",
          "justify",
          "start",
          "end",
          "wrap",
          "nowrap",
          "balance",
          "pretty",
          "ellipsis",
          "clip",
        ].includes(sizeToken)
      ) {
        continue;
      }
      const known = FONT_SIZES[sizeToken];
      if (known) {
        out.fontSizePx = known[0];
        if (
          !leadingToken &&
          (lineHeightFromSize ||
            (out.lineHeightPx === undefined && out.lineHeight === undefined))
        ) {
          out.lineHeightPx = known[1];
          out.lineHeight = undefined;
          lineHeightFromSize = true;
        }
      } else if (sizeToken.startsWith("[") && sizeToken.endsWith("]")) {
        const px = parseLength(sizeToken.slice(1, -1));
        if (px === null) {
          out.unresolved.push(cls);
        } else {
          out.fontSizePx = px;
        }
      } else if (theme[sizeToken]) {
        const px = parseLength(theme[sizeToken]);
        if (px === null) {
          out.unresolved.push(cls);
        } else {
          out.fontSizePx = px;
        }
      } else {
        out.unresolved.push(cls);
      }
      if (leadingToken) {
        applyLeading(leadingToken, cls);
      }
      continue;
    }
    if (base.startsWith("leading-")) {
      applyLeading(base.slice("leading-".length), cls);
      continue;
    }
    if (base.startsWith("tracking-")) {
      const token = base.slice("tracking-".length);
      if (TRACKING[token] !== undefined) {
        out.letterSpacingEm = TRACKING[token];
      } else if (token.startsWith("[") && token.endsWith("]")) {
        const em = parseEm(token.slice(1, -1));
        if (em === null) {
          out.unresolved.push(cls);
        } else {
          out.letterSpacingEm = em;
        }
      } else {
        out.unresolved.push(cls);
      }
      continue;
    }
    if (base.startsWith("font-")) {
      const token = base.slice("font-".length);
      if (WEIGHTS[token] !== undefined) {
        out.fontWeight = WEIGHTS[token];
      } else if (token === "mono" || token === "sans" || token === "serif") {
        out.family = token;
      } else if (token.startsWith("[") && token.endsWith("]")) {
        const n = Number(token.slice(1, -1));
        if (Number.isFinite(n) && n >= 100 && n <= 900) {
          out.fontWeight = n;
        } else {
          out.unresolved.push(cls);
        }
      } else {
        out.unresolved.push(cls);
      }
      continue;
    }
    if (base === "uppercase") {
      out.uppercase = true;
      continue;
    }
    if (
      base === "normal-case" ||
      base === "lowercase" ||
      base === "capitalize"
    ) {
      out.uppercase = false;
      continue;
    }
    if (base === "italic") {
      out.italic = true;
    }
  }
  if (
    out.fontSizePx !== undefined &&
    out.lineHeightPx !== undefined &&
    out.lineHeight === undefined
  ) {
    out.lineHeight =
      Math.round((out.lineHeightPx / out.fontSizePx) * 1000) / 1000;
  }
  return out;
};

const resolveLeading = (
  out: ResolvedTypography,
  token: string,
  cls: string
): void => {
  if (LEADING[token] !== undefined) {
    out.lineHeight = LEADING[token];
    out.lineHeightPx = undefined;
    return;
  }
  if (/^\d+$/.test(token)) {
    out.lineHeightPx = Number(token) * 4;
    out.lineHeight = undefined;
    return;
  }
  if (token.startsWith("[") && token.endsWith("]")) {
    const inner = token.slice(1, -1);
    if (/^\d*\.?\d+$/.test(inner)) {
      out.lineHeight = Number(inner);
      out.lineHeightPx = undefined;
      return;
    }
    const px = parseLength(inner);
    if (px !== null) {
      out.lineHeightPx = px;
      out.lineHeight = undefined;
      return;
    }
  }
  out.unresolved.push(cls);
};

// Split a className string into classes.
export const splitClasses = (value: string): string[] =>
  value.split(/\s+/u).filter(Boolean);
