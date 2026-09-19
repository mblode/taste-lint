// Markdown and MDX extractor. Produces paragraph, heading and attr-string
// units with mdast positions mapped back to the original source.

import type {
  Blockquote,
  Heading,
  ListItem,
  Node,
  Paragraph,
  Parent,
  Root,
  TableCell,
} from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import type {
  MdxJsxAttribute,
  MdxJsxFlowElement,
  MdxJsxTextElement,
} from "mdast-util-mdx";
import { mdxFromMarkdown } from "mdast-util-mdx";
import { gfm } from "micromark-extension-gfm";
import { mdxjs } from "micromark-extension-mdxjs";

import { parseFrontmatter } from "../lib/frontmatter.js";
import type { Config, DocType, Role, Unit } from "../types.js";
import { LineIndex, makeUnit, normaliseText } from "./units.js";
import type { UnitDraft } from "./units.js";

const ATTR_STRING_NAMES = new Set([
  "title",
  "caption",
  "label",
  "alt",
  "description",
  "placeholder",
]);

interface Rendered {
  text: string;
  /** UTF-16 ranges inside `text` that came from inline code. */
  codeSpans: [number, number][];
  /** Source ranges of the text nodes, the only prose a fix may touch. */
  fixRanges: [number, number][];
}

type AnyNode = Node & {
  children?: AnyNode[];
  value?: string;
  name?: string | null;
};

type Offsets = (node: Node) => { start: number; end: number } | null;

const parseTree = (source: string, mdx: boolean): Root => {
  const extensions = mdx ? [gfm(), mdxjs()] : [gfm()];
  const mdastExtensions = mdx
    ? [gfmFromMarkdown(), mdxFromMarkdown()]
    : [gfmFromMarkdown()];
  return fromMarkdown(source, { extensions, mdastExtensions });
};

// Render phrasing content to text, recording inline code as code spans and
// dropping expressions and images. `onInline` sees each inline MDX element so
// its string attributes become units too.
const renderPhrasing = (
  nodes: AnyNode[],
  out: Rendered,
  offsets: Offsets,
  onInline?: (node: MdxJsxTextElement) => void
): void => {
  for (const node of nodes) {
    switch (node.type) {
      case "text": {
        out.text += node.value ?? "";
        const range = offsets(node);
        if (range && range.end > range.start && (node.value ?? "").trim()) {
          out.fixRanges.push([range.start, range.end]);
        }
        break;
      }
      case "inlineCode": {
        const start = out.text.length;
        out.text += node.value ?? "";
        out.codeSpans.push([start, out.text.length]);
        break;
      }
      case "break": {
        out.text += " ";
        break;
      }
      case "mdxJsxTextElement": {
        onInline?.(node as MdxJsxTextElement);
        renderPhrasing(node.children ?? [], out, offsets, onInline);
        break;
      }
      case "emphasis":
      case "strong":
      case "delete":
      case "link":
      case "linkReference": {
        renderPhrasing(node.children ?? [], out, offsets, onInline);
        break;
      }
      default: {
        // image, imageReference, html, footnoteReference, mdxTextExpression:
        // nothing rendered.
        break;
      }
    }
  }
};

// Collapse whitespace in the rendered text while keeping code span offsets
// pointing at the same characters. Everything indexes UTF-16 code units.
const collapse = (rendered: Rendered): Rendered => {
  let text = "";
  const source = rendered.text;
  // Indexed by UTF-16 code unit, matching the span offsets; a for...of over
  // the string would step by code point and shift every span after an emoji.
  const map: number[] = Array.from({ length: source.length + 1 }, () => 0);
  let pendingSpace = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source.charAt(i);
    map[i] = text.length;
    if (/[ \t\n\r\f\v]/u.test(ch)) {
      pendingSpace = text.length > 0;
      continue;
    }
    if (pendingSpace) {
      text += " ";
      pendingSpace = false;
      map[i] = text.length;
    }
    text += ch;
  }
  map[source.length] = text.length;
  const codeSpans = rendered.codeSpans.map(
    ([s, e]) => [map[s] ?? 0, map[e] ?? text.length] as [number, number]
  );
  return { codeSpans, fixRanges: rendered.fixRanges, text };
};

// The inside of a quoted attribute value, so a fix never touches the quotes.
const quotedValueRange = (
  source: string,
  start: number,
  end: number
): [number, number] | null => {
  const slice = source.slice(start, end);
  const eq = slice.indexOf("=");
  if (eq === -1) {
    return null;
  }
  const quote = slice[eq + 1];
  if ((quote !== '"' && quote !== "'") || slice.at(-1) !== quote) {
    return null;
  }
  const inner: [number, number] = [start + eq + 2, end - 1];
  return inner[1] > inner[0] ? inner : null;
};

export interface MarkdownExtractOptions {
  config: Config;
  docType: DocType;
}

export const extractMarkdown = (
  file: string,
  source: string,
  options: MarkdownExtractOptions
): Unit[] => {
  const { config, docType } = options;
  const index = new LineIndex(source);
  const isMdx = file.endsWith(".mdx");
  // `blanked` keeps every offset aligned with `source` (a BOM becomes a space).
  const { blanked } = parseFrontmatter(source);
  let tree: Root;
  let mdxFallback = false;
  try {
    tree = parseTree(blanked, isMdx);
  } catch {
    if (!isMdx) {
      return [fileUnit(file, index, source, docType, "markdown did not parse")];
    }
    try {
      tree = parseTree(blanked, false);
      mdxFallback = true;
    } catch (error) {
      return [
        fileUnit(
          file,
          index,
          source,
          docType,
          `parse error: ${(error as Error).message}`
        ),
      ];
    }
  }
  const units: Unit[] = [];
  let headingAbove: string | undefined;

  const push = (draft: UnitDraft): void => {
    if (draft.text.length === 0) {
      return;
    }
    if (mdxFallback) {
      draft.context.mdxFallback = true;
    }
    units.push(makeUnit(file, index, draft));
  };

  const offsets: Offsets = (node) => {
    const pos = node.position;
    if (!pos) {
      return null;
    }
    return {
      end: index.offsetAt(pos.end.line, pos.end.column),
      start: index.offsetAt(pos.start.line, pos.start.column),
    };
  };

  const attrUnits = (
    node: MdxJsxFlowElement | MdxJsxTextElement,
    component: string
  ): void => {
    for (const attr of node.attributes) {
      if (attr.type !== "mdxJsxAttribute") {
        continue;
      }
      const a = attr as MdxJsxAttribute;
      if (!ATTR_STRING_NAMES.has(a.name) || typeof a.value !== "string") {
        continue;
      }
      const range = offsets(a as unknown as Node) ?? offsets(node);
      if (!range) {
        continue;
      }
      const inner = quotedValueRange(source, range.start, range.end);
      push({
        context: {
          attr: a.name,
          component,
          docType,
          headingAbove,
          role: "caption",
        },
        fixRanges: inner ? [inner] : undefined,
        kind: "attr-string",
        sourceEnd: range.end,
        sourceStart: range.start,
        text: normaliseText(a.value),
      });
    }
  };

  const render = (
    nodes: AnyNode[],
    component: string | undefined
  ): Rendered => {
    const out: Rendered = { codeSpans: [], fixRanges: [], text: "" };
    renderPhrasing(nodes, out, offsets, (inline) => {
      const name = inline.name ?? "fragment";
      if (!config.components.skip.includes(name)) {
        attrUnits(inline, component ?? name);
      }
    });
    return collapse(out);
  };

  const textUnit = (
    node: Parent,
    kind: "paragraph" | "heading",
    role: Role,
    component?: string
  ): void => {
    const range = offsets(node);
    if (!range) {
      return;
    }
    const rendered = render(node.children as AnyNode[], component);
    if (rendered.text.trim() === "") {
      return;
    }
    push({
      codeSpans: rendered.codeSpans,
      context: { component, docType, headingAbove, role },
      fixRanges: rendered.fixRanges,
      kind,
      sourceEnd: range.end,
      sourceStart: range.start,
      text: rendered.text,
    });
  };

  const walk = (nodes: AnyNode[], role: Role, component?: string): void => {
    for (const node of nodes) {
      switch (node.type) {
        case "heading": {
          const h = node as Heading;
          textUnit(h, "heading", "heading", component);
          const out: Rendered = { codeSpans: [], fixRanges: [], text: "" };
          renderPhrasing(h.children as AnyNode[], out, offsets);
          headingAbove = normaliseText(out.text).slice(0, 120);
          break;
        }
        case "paragraph": {
          textUnit(node as Paragraph, "paragraph", role, component);
          break;
        }
        case "list": {
          walk(node.children ?? [], "list-item", component);
          break;
        }
        case "listItem": {
          walk(
            (node as ListItem).children as AnyNode[],
            "list-item",
            component
          );
          break;
        }
        case "blockquote": {
          walk((node as Blockquote).children as AnyNode[], role, component);
          break;
        }
        case "table":
        case "tableRow": {
          walk(node.children ?? [], "cell", component);
          break;
        }
        case "tableCell": {
          textUnit(node as TableCell, "paragraph", "cell", component);
          break;
        }
        case "mdxJsxFlowElement": {
          const el = node as MdxJsxFlowElement;
          const name = el.name ?? "fragment";
          if (config.components.skip.includes(name)) {
            break;
          }
          attrUnits(el, name);
          const tag = config.components.unwrap.includes(name)
            ? component
            : name;
          walk(el.children as AnyNode[], role, tag);
          break;
        }
        case "code":
        case "html":
        case "yaml":
        case "toml":
        case "thematicBreak":
        case "mdxjsEsm":
        case "mdxFlowExpression":
        case "definition":
        case "footnoteDefinition": {
          break;
        }
        default: {
          if (node.children) {
            walk(node.children, role, component);
          }
        }
      }
    }
  };

  walk(tree.children as AnyNode[], "body");
  return units;
};

const fileUnit = (
  file: string,
  index: LineIndex,
  source: string,
  docType: DocType,
  parseError: string
): Unit =>
  makeUnit(file, index, {
    context: { docType, parseError, role: "unknown" },
    kind: "file",
    sourceEnd: source.length,
    sourceStart: 0,
    text: "",
  });
