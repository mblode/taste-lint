// Rendered extractor: consume a style-capture CaptureResult (v1) and produce
// `element` units with typography resolved from computed styles. Real values
// replace class parsing, so measure, loaded font family and true weights are
// available to the mechanical checks.

import { spawnCapture } from "../lib/spawn.js";
import type { NeighbourSummary, ResolvedTypography, Unit } from "../types.js";
import { assertCapture } from "./capture.js";
import type { CaptureResult, ElementSnapshot } from "./capture.js";
import { parseCaptureInput } from "./style-capture-text.js";
import { LineIndex, makeUnit, normaliseText, ROLE_BY_TAG } from "./units.js";

export type { BoundingBox, CaptureResult, ElementSnapshot } from "./capture.js";

const px = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }
  const m = value.match(/^(-?\d*\.?\d+)px$/);
  return m ? Number(m[1]) : undefined;
};

export const typographyFromStyles = (
  styles: Record<string, string>
): ResolvedTypography & {
  fontFamily?: string;
  colour?: string;
  background?: string;
  textWrap?: string;
  fontSynthesis?: string;
  numeric?: string;
} => {
  const fontSizePx = px(styles["font-size"]);
  const lineHeightPx = px(styles["line-height"]);
  const letterSpacingPx = px(styles["letter-spacing"]);
  const weightRaw = styles["font-weight"];
  const fontWeight =
    weightRaw === "bold"
      ? 700
      : weightRaw === "normal"
        ? 400
        : Number(weightRaw) || undefined;
  return {
    background: styles["background-color"],
    colour: styles.color,
    colourClasses: [],
    fontFamily: styles["font-family"],
    fontSizePx,
    fontSynthesis: styles["font-synthesis"],
    fontWeight,
    italic:
      styles["font-style"] === "italic" || styles["font-style"] === "oblique",
    letterSpacingEm:
      letterSpacingPx !== undefined && fontSizePx
        ? Math.round((letterSpacingPx / fontSizePx) * 1000) / 1000
        : letterSpacingPx === undefined && styles["letter-spacing"] === "normal"
          ? 0
          : undefined,
    lineHeight:
      fontSizePx && lineHeightPx
        ? Math.round((lineHeightPx / fontSizePx) * 1000) / 1000
        : undefined,
    lineHeightPx,
    numeric: styles["font-variant-numeric"],
    textWrap: styles["text-wrap"] ?? styles["text-wrap-style"],
    unresolved: [],
    uppercase: styles["text-transform"] === "uppercase",
  };
};

// Text directly inside an element. style-capture carries per-element text
// only from the CLI text block; captures that omit it yield units without
// prose, still useful for typography values.
const directTextOf = (el: ElementSnapshot): string => {
  if (typeof el.text === "string") {
    return normaliseText(el.text);
  }
  const attr = el.attributes["data-slop-cop-text"];
  return attr ? normaliseText(attr) : "";
};

export const extractCapture = (raw: CaptureResult, label: string): Unit[] => {
  const capture = assertCapture(raw);
  const file = `rendered:${label}`;
  // Synthetic source: one line per element in document order, so findings
  // point at a stable line number that maps to `order`.
  const lines = capture.order.map((id) => {
    const el = capture.elements[id];
    return el ? `${el.selector} ${directTextOf(el)}` : id;
  });
  const source = lines.join("\n");
  const index = new LineIndex(source);
  const units: Unit[] = [];
  const summaries = new Map<string, NeighbourSummary | null>();
  const summaryFor = (id: string): NeighbourSummary | null => {
    if (summaries.has(id)) {
      return summaries.get(id) ?? null;
    }
    const el = capture.elements[id];
    if (!el) {
      summaries.set(id, null);
      return null;
    }
    const text = directTextOf(el);
    const summary = text
      ? {
          element: el.tagName.toLowerCase(),
          text,
          typography: typographyFromStyles(el.styles),
        }
      : null;
    summaries.set(id, summary);
    return summary;
  };
  const nearestSummary = (
    siblings: string[],
    at: number,
    step: -1 | 1
  ): NeighbourSummary | undefined => {
    for (let i = at + step; i >= 0 && i < siblings.length; i += step) {
      const summary = summaryFor(siblings[i]);
      if (summary) {
        return summary;
      }
    }
    return undefined;
  };
  let offset = 0;
  for (const [i, id] of capture.order.entries()) {
    const el = capture.elements[id];
    const line = lines[i];
    const start = offset;
    offset += line.length + 1;
    if (!el) {
      continue;
    }
    const text = directTextOf(el);
    const tag = el.tagName.toLowerCase();
    if (!text || ["script", "style", "noscript", "svg", "path"].includes(tag)) {
      continue;
    }
    const siblings = el.parentId
      ? (capture.elements[el.parentId]?.children ?? [])
      : [];
    const at = siblings.indexOf(id);
    // An element its parent does not list has no siblings to compare against.
    const prev = at === -1 ? undefined : nearestSummary(siblings, at, -1);
    const next = at === -1 ? undefined : nearestSummary(siblings, at, 1);
    units.push(
      makeUnit(file, index, {
        classes: el.classList,
        context: {
          docType: "ui",
          element: tag,
          role:
            ROLE_BY_TAG[tag] ??
            (el.attributes.role === "button" ? "button" : "body"),
        },
        kind: "element",
        neighbours: { next, prev },
        sourceEnd: start + line.length,
        sourceStart: start,
        text,
        typography: typographyFromStyles(el.styles),
      })
    );
  }
  return units;
};

// Drive the style-capture CLI and parse its text block. Requires the
// `style-capture` package (via npx) and a local Chromium for Playwright.
export const runStyleCapture = async (
  url: string,
  selector: string
): Promise<CaptureResult> => {
  const { stdout } = await spawnCapture(
    "npx",
    ["--yes", "style-capture", url, selector, "--mode", "full"],
    { timeoutMs: 180_000 }
  );
  return parseCaptureInput(stdout);
};
