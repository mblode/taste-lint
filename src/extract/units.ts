import { createHash } from "node:crypto";

import type { DocType, Role, Unit, UnitContext, UnitKind } from "../types.js";

// 1-based line and column lookups over a source string. Offsets are UTF-16
// code unit indexes, which is what both mdast and oxc-parser report.
export class LineIndex {
  private readonly starts: number[] = [0];

  constructor(private readonly source: string) {
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

  get length(): number {
    return this.source.length;
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

export interface UnitDraft {
  kind: UnitKind;
  text: string;
  sourceStart: number;
  sourceEnd: number;
  inCode?: boolean;
  codeSpans?: [number, number][];
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
// offsets into the text stay valid.
export const maskCodeSpans = (
  text: string,
  spans: [number, number][]
): string => {
  if (spans.length === 0) {
    return text;
  }
  const chars = [...text];
  for (const [s, e] of spans) {
    for (let i = s; i < e && i < chars.length; i += 1) {
      chars[i] = " ";
    }
  }
  return chars.join("");
};
