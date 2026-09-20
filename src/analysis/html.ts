import { parse } from "parse5";
import type { DefaultTreeAdapterMap } from "parse5";

export interface HtmlElement {
  tag: string;
  attrs: Record<string, string>;
  text: string;
  offset: number;
  inHead: boolean;
}

const text = (node: DefaultTreeAdapterMap["node"]): string =>
  "value" in node
    ? node.value
    : "childNodes" in node
      ? node.childNodes.map(text).join("")
      : "";

// Parse real HTML elements, not strings in scripts or SVG title elements.
export const htmlElements = (source: string): HtmlElement[] => {
  const output: HtmlElement[] = [];
  const visit = (node: DefaultTreeAdapterMap["node"], inHead = false): void => {
    const head = inHead || ("tagName" in node && node.tagName === "head");
    if (
      "tagName" in node &&
      node.namespaceURI === "http://www.w3.org/1999/xhtml" &&
      node.sourceCodeLocation &&
      ["title", "meta", "link", "script", "img"].includes(node.tagName)
    ) {
      output.push({
        attrs: Object.fromEntries(node.attrs.map((a) => [a.name, a.value])),
        inHead: head,
        offset: node.sourceCodeLocation.startOffset,
        tag: node.tagName,
        text: text(node),
      });
    }
    if ("childNodes" in node) {
      for (const child of node.childNodes) {
        visit(child, head);
      }
    }
  };
  visit(parse(source, { sourceCodeLocationInfo: true }));
  return output;
};
