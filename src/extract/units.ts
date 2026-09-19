import { createHash } from "node:crypto";

import type { DocType, Role, Unit, UnitContext, UnitKind } from "../types.js";

// 1-based line and column lookups over a source string. Offsets are UTF-16
// code unit indexes, which is what both mdast and oxc-parser report.
export class LineIndex {
  private readonly starts: number[] = [0];

  constructor(source: string) {
    for (let i = 0; i < source.length; i += 1) {
      if (source.codePointAt(i) === 10) {
        this.starts.push(i + 1);
      }
    }
  }

  positionAt(offset: number): { line: number; column: number } {
    let lo = 0;
    let hi = this.starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.starts[mid] <= offset) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    return { column: offset - this.starts[lo] + 1, line: lo + 1 };
  }

  offsetAt(line: number, column: number): number {
    const start = this.starts[Math.min(line, this.starts.length) - 1] ?? 0;
    return start + column - 1;
  }
}

export const normaliseText = (text: string): string =>
  text.replaceAll(/[ \t\n\r\f\v]+/gu, " ").trim();

export const unitId = (
  file: string,
  kind: UnitKind,
  sourceStart: number
): string =>
  createHash("sha256")
    .update(`${file}\u0000${kind}\u0000${sourceStart}`)
    .digest("hex")
    .slice(0, 16);

// Element roles shared by the TSX and rendered extractors so the same tag
// gets the same role whichever way it was reached.
export const ROLE_BY_TAG: Record<string, Role> = {
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
  legend: "label",
  li: "list-item",
  option: "label",
  p: "body",
  span: "body",
  summary: "heading",
  td: "cell",
  th: "heading",
};

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  hellip: "…",
  laquo: "«",
  ldquo: "“",
  lsquo: "‘",
  lt: "<",
  mdash: String.fromCodePoint(0x20_14),
  middot: "·",
  nbsp: " ",
  ndash: String.fromCodePoint(0x20_13),
  quot: '"',
  raquo: "»",
  rdquo: "”",
  rsquo: "’",
  times: "×",
};

// One pass over numeric and the named character references copy uses, so
// `&amp;lt;` stays `&lt;` and `&#8217;` becomes a right quote. Unknown names
// are left as written.
export const decodeEntities = (text: string): string =>
  text.replaceAll(
    /&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/giu,
    (whole: string, ref: string) => {
      if (ref.startsWith("#x") || ref.startsWith("#X")) {
        const code = Number.parseInt(ref.slice(2), 16);
        return Number.isFinite(code) && code <= 0x10_ff_ff
          ? String.fromCodePoint(code)
          : whole;
      }
      if (ref.startsWith("#")) {
        const code = Number(ref.slice(1));
        return Number.isFinite(code) && code <= 0x10_ff_ff
          ? String.fromCodePoint(code)
          : whole;
      }
      return NAMED_ENTITIES[ref] ?? whole;
    }
  );

export interface UnitDraft {
  kind: UnitKind;
  text: string;
  sourceStart: number;
  sourceEnd: number;
  inCode?: boolean;
  codeSpans?: [number, number][];
  fixRanges?: [number, number][];
  context: Partial<UnitContext> & { role: Role; docType: DocType };
  typography?: Unit["typography"];
  neighbours?: Unit["neighbours"];
  classes?: string[];
}

export const makeUnit = (
  file: string,
  index: LineIndex,
  draft: UnitDraft
): Unit => {
  const start = index.positionAt(draft.sourceStart);
  const end = index.positionAt(Math.max(draft.sourceStart, draft.sourceEnd));
  return {
    classes: draft.classes,
    codeSpans: draft.codeSpans ?? [],
    column: start.column,
    context: draft.context as UnitContext,
    endColumn: end.column,
    endLine: end.line,
    file,
    fixRanges: draft.fixRanges,
    id: unitId(file, draft.kind, draft.sourceStart),
    inCode: draft.inCode ?? false,
    kind: draft.kind,
    line: start.line,
    neighbours: draft.neighbours,
    sourceEnd: draft.sourceEnd,
    sourceStart: draft.sourceStart,
    text: draft.text,
    typography: draft.typography,
  };
};

// Replace code spans with spaces so regexes cannot match inside them while
// offsets into the text stay valid. Spans are UTF-16 offsets, like `text`.
export const maskCodeSpans = (
  text: string,
  spans: [number, number][]
): string => {
  let out = text;
  for (const [s, e] of spans) {
    const end = Math.min(e, out.length);
    if (s < end) {
      out = out.slice(0, s) + " ".repeat(end - s) + out.slice(end);
    }
  }
  return out;
};
