// Rendered extractor: consume a style-capture CaptureResult (v1) and produce
// `element` units with typography resolved from computed styles. Real values
// replace class parsing, so measure, loaded font family and true weights are
// available to the mechanical checks.

import { spawnCapture } from "../lib/spawn.js";
import type {
  NeighbourSummary,
  ResolvedTypography,
  Role,
  Unit,
} from "../types.js";
import { LineIndex, makeUnit, normaliseText } from "./units.js";

export interface BoundingBox {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
  x: number;
  y: number;
}

export interface ElementSnapshot {
  attributes: Record<string, string>;
  boundingBox: BoundingBox;
  children: string[];
  classList: string[];
  id: string;
  parentId: string | null;
  selector: string;
  styles: Record<string, string>;
  tagName: string;
  text?: string;
}

export interface CaptureResult {
  elements: Record<string, ElementSnapshot>;
  metadata: { url: string; title?: string; capturedAt?: string };
  order: string[];
  rootElementId: string;
  rootOuterHtml: string;
  settings?: unknown;
  version: 1;
}

const ROLE_BY_TAG: Record<string, Role> = {
  a: "link",
  button: "button",
  caption: "caption",
  figcaption: "caption",
  h1: "heading",
  h2: "heading",
  h3: "heading",
  h4: "heading",
  h5: "heading",
  h6: "heading",
  label: "label",
  li: "list-item",
  p: "body",
  span: "body",
  td: "cell",
  th: "heading",
};

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

// Text directly inside an element: style-capture v1 carries the subtree HTML
// at the root only, so we derive direct text from `text` when present, else
// from the root HTML by id lookup is not possible; capture tools that omit
// text yield units without prose, still useful for typography values.
const directTextOf = (el: ElementSnapshot, root: string): string => {
  if (typeof el.text === "string") {
    return normaliseText(el.text);
  }
  const attr = el.attributes["data-slop-cop-text"];
  if (attr) {
    return normaliseText(attr);
  }
  void root;
  return "";
};

export const extractCapture = (
  capture: CaptureResult,
  label: string
): Unit[] => {
  if (capture.version !== 1 || typeof capture.elements !== "object") {
    throw new Error(
      "Unsupported capture: expected style-capture CaptureResult version 1"
    );
  }
  const file = `rendered:${label}`;
  // Synthetic source: one line per element in document order, so findings
  // point at a stable line number that maps to `order`.
  const lines = capture.order.map((id) => {
    const el = capture.elements[id];
    return el
      ? `${el.selector} ${directTextOf(el, capture.rootOuterHtml)}`
      : id;
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
    const text = directTextOf(el, capture.rootOuterHtml);
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
  let offset = 0;
  for (const [i, id] of capture.order.entries()) {
    const el = capture.elements[id];
    const line = lines[i];
    const start = offset;
    offset += line.length + 1;
    if (!el) {
      continue;
    }
    const text = directTextOf(el, capture.rootOuterHtml);
    const tag = el.tagName.toLowerCase();
    if (!text || ["script", "style", "noscript", "svg", "path"].includes(tag)) {
      continue;
    }
    const siblings = el.parentId
      ? (capture.elements[el.parentId]?.children ?? [])
      : [];
    const at = siblings.indexOf(id);
    const prev =
      siblings
        .slice(0, Math.max(0, at))
        .toReversed()
        .map(summaryFor)
        .find(Boolean) ?? undefined;
    const next =
      siblings
        .slice(at + 1)
        .map(summaryFor)
        .find(Boolean) ?? undefined;
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

// Drive the style-capture CLI and parse its JSON output. Requires the
// `style-capture` package (npx) and a local Chromium via Playwright.
export const runStyleCapture = async (
  url: string,
  selector: string
): Promise<CaptureResult> => {
  const { stdout } = await spawnCapture(
    "npx",
    [
      "--yes",
      "style-capture",
      url,
      selector,
      "--mode",
      "full",
      "--format",
      "json",
    ],
    { timeoutMs: 120_000 }
  );
  const start = stdout.indexOf("{");
  if (start === -1) {
    throw new Error(
      "style-capture returned no JSON. Update style-capture or pass --capture with a saved CaptureResult."
    );
  }
  return JSON.parse(stdout.slice(start)) as CaptureResult;
};
