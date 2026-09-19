// Parse the `<style_capture>` text block the style-capture CLI prints into
// the CaptureResult shape the rendered extractor consumes. The CLI has no
// JSON flag, so this is the bridge: css_capture gives one `selector{...}`
// block per element in document order, and html_capture gives the subtree
// whose text we walk by nth-child position.

import type { CaptureResult, ElementSnapshot } from "./rendered.js";

const VOID = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
]);

interface HtmlNode {
  tag: string;
  children: HtmlNode[];
  text: string[];
  attributes: Record<string, string>;
}

const decode = (s: string): string =>
  s
    .replaceAll("&nbsp;", " ")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&");

const parseAttributes = (raw: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const m of raw.matchAll(
    /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g
  )) {
    out[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return out;
};

// A tolerant tree builder for the cleaned HTML style-capture emits.
export const parseHtmlTree = (html: string): HtmlNode => {
  const root: HtmlNode = {
    attributes: {},
    children: [],
    tag: "#root",
    text: [],
  };
  const stack: HtmlNode[] = [root];
  const re =
    /<!--[\s\S]*?-->|<\/([a-zA-Z][^\s>]*)\s*>|<([a-zA-Z][^\s/>]*)([^>]*?)(\/?)>|([^<]+)/g;
  for (const m of html.matchAll(re)) {
    const [, close, open, attrs, selfClose, text] = m;
    const top = stack.at(-1) as HtmlNode;
    if (text !== undefined) {
      const t = decode(text);
      if (t.trim() !== "") {
        top.text.push(t);
      }
      continue;
    }
    if (close) {
      const tag = close.toLowerCase();
      for (let i = stack.length - 1; i > 0; i -= 1) {
        if (stack[i].tag === tag) {
          stack.length = i;
          break;
        }
      }
      continue;
    }
    if (open) {
      const tag = open.toLowerCase();
      const node: HtmlNode = {
        attributes: parseAttributes(attrs ?? ""),
        children: [],
        tag,
        text: [],
      };
      top.children.push(node);
      if (!selfClose && !VOID.has(tag)) {
        stack.push(node);
      }
    }
  }
  return root;
};

const lastSegment = (selector: string): string =>
  selector.split(">").at(-1) ?? selector;

const tagOf = (segment: string): string =>
  segment.match(/^[a-zA-Z][a-zA-Z0-9-]*/)?.[0] ?? "div";

const nth = (segment: string): number =>
  Number(segment.match(/:nth-child\((\d+)\)/)?.[1] ?? "1");

export const parseStyleCaptureText = (text: string): CaptureResult => {
  const header = text.match(/<style_capture\b([^>]*)>/);
  if (!header) {
    throw new Error("Not a style-capture block: missing <style_capture>");
  }
  const url = header[1].match(/url="([^"]*)"/)?.[1] ?? "unknown";
  const html =
    text.match(/<html_capture>([\s\S]*?)<\/html_capture>/)?.[1] ?? "";
  const css = text.match(/<css_capture>([\s\S]*?)<\/css_capture>/)?.[1] ?? "";
  const tree = parseHtmlTree(html);
  const rootHtmlNode = tree.children[0];
  const elements: Record<string, ElementSnapshot> = {};
  const order: string[] = [];
  const bySelector = new Map<string, string>();
  let rootSelector: string | null = null;
  let index = 0;
  for (const block of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const selector = block[1].trim();
    const styles: Record<string, string> = {};
    for (const decl of block[2].split(";")) {
      const colon = decl.indexOf(":");
      if (colon > 0) {
        styles[decl.slice(0, colon).trim()] = decl.slice(colon + 1).trim();
      }
    }
    const id = `e${index}`;
    index += 1;
    rootSelector ??= selector;
    const segments = selector.split(">");
    const rootDepth = rootSelector.split(">").length;
    // Walk the HTML tree by nth-child positions below the root.
    let node: HtmlNode | undefined = rootHtmlNode;
    for (const segment of segments.slice(rootDepth)) {
      node = node?.children[nth(segment) - 1];
    }
    const parentSelector =
      segments.length > rootDepth ? segments.slice(0, -1).join(">") : null;
    const parentId = parentSelector
      ? (bySelector.get(parentSelector) ?? null)
      : null;
    const segment = lastSegment(selector);
    elements[id] = {
      attributes: node?.attributes ?? {},
      boundingBox: {
        bottom: 0,
        height: 0,
        left: 0,
        right: 0,
        top: 0,
        width: 0,
        x: 0,
        y: 0,
      },
      children: [],
      classList: (node?.attributes.class ?? "").split(/\s+/u).filter(Boolean),
      id,
      parentId,
      selector,
      styles,
      tagName: tagOf(segment).toUpperCase(),
      text: node ? node.text.join(" ") : "",
    };
    if (parentId) {
      elements[parentId].children.push(id);
    }
    bySelector.set(selector, id);
    order.push(id);
  }
  if (order.length === 0) {
    throw new Error("style-capture block has no css_capture elements");
  }
  return {
    elements,
    metadata: { url },
    order,
    rootElementId: order[0],
    rootOuterHtml: html,
    version: 1,
  };
};

// Accept either a CaptureResult JSON file or the CLI's text block.
export const parseCaptureInput = (raw: string): CaptureResult => {
  const trimmed = raw.trimStart();
  if (trimmed.startsWith("{")) {
    return JSON.parse(trimmed) as CaptureResult;
  }
  return parseStyleCaptureText(trimmed);
};
