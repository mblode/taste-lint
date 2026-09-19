// The style-capture CaptureResult (v1) shape and its fail-closed guard, shared
// by the rendered extractor and the CLI text-block parser.

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

// Fail closed on anything that is not the v1 shape the walk below relies on.
export const assertCapture = (raw: unknown): CaptureResult => {
  const c = raw as Partial<CaptureResult> | null;
  if (
    typeof c !== "object" ||
    c === null ||
    c.version !== 1 ||
    typeof c.elements !== "object" ||
    c.elements === null ||
    !Array.isArray(c.order) ||
    !c.order.every((id) => typeof id === "string")
  ) {
    throw new Error(
      "Unsupported capture: expected style-capture CaptureResult version 1 with elements and order"
    );
  }
  return c as CaptureResult;
};
