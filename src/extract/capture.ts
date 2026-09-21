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
  visible?: boolean;
}

export interface CaptureResult {
  elements: Record<string, ElementSnapshot>;
  metadata: {
    url: string;
    title?: string;
    capturedAt?: string;
    state?: string;
    viewport?: { width: number; height: number };
  };
  order: string[];
  rootElementId: string;
  rootOuterHtml: string;
  settings?: unknown;
  version: 1;
}

// Fail closed on anything that is not the v1 shape the walk below relies on.
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");
const stringMap = (value: unknown): boolean =>
  record(value) &&
  Object.values(value).every((item) => typeof item === "string");

export const assertCapture = (raw: unknown): CaptureResult => {
  if (
    !record(raw) ||
    raw.version !== 1 ||
    !record(raw.elements) ||
    !strings(raw.order)
  ) {
    throw new Error(
      "Unsupported capture: expected style-capture CaptureResult version 1 with elements and order"
    );
  }
  for (const [id, element] of Object.entries(raw.elements)) {
    if (
      !record(element) ||
      !["id", "tagName", "selector"].every(
        (key) => typeof element[key] === "string"
      ) ||
      !(element.parentId === null || typeof element.parentId === "string") ||
      !strings(element.children) ||
      !strings(element.classList) ||
      !stringMap(element.styles) ||
      !stringMap(element.attributes) ||
      (element.text !== undefined && typeof element.text !== "string") ||
      (element.visible !== undefined && typeof element.visible !== "boolean")
    ) {
      throw new Error(
        `Unsupported capture element ${id}: expected text identifiers, string maps for styles/attributes and string lists for children/classList`
      );
    }
  }
  return raw as unknown as CaptureResult;
};
