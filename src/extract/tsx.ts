// TSX and JSX extractor built on oxc-parser. Produces jsx-text, attr-string
// and class-list units. Only static text and static class strings are
// extracted; anything computed is flagged dynamic and skipped.

import { parseSync } from "oxc-parser";

import type {
  Config,
  DocType,
  NeighbourSummary,
  Role,
  Unit,
} from "../types.js";
import { resolveTypography, splitClasses } from "./tailwind.js";
import { LineIndex, makeUnit, normaliseText } from "./units.js";
import type { UnitDraft } from "./units.js";

type Node = Record<string, unknown> & {
  type: string;
  start: number;
  end: number;
};

const ATTR_STRING_NAMES = new Set([
  "aria-label",
  "aria-description",
  "placeholder",
  "title",
  "alt",
  "label",
  "description",
  "helperText",
  "errorMessage",
]);

const COPY_KEYS = new Set([
  "message",
  "title",
  "description",
  "label",
  "placeholder",
  "error",
  "hint",
  "cta",
  "what",
  "fix",
  "summary",
]);

const CLASS_FUNCTIONS = new Set([
  "cn",
  "clsx",
  "cva",
  "twMerge",
  "classNames",
  "tw",
]);
const SKIP_CALLEES = new Set([
  "console",
  "Sentry",
  "logger",
  "log",
  "t",
  "i18n",
  "invariant",
  "assert",
]);

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
  legend: "label",
  li: "list-item",
  option: "label",
  p: "body",
  span: "body",
  summary: "heading",
  td: "cell",
  th: "heading",
};

const ROLE_BY_COMPONENT: Record<string, Role> = {
  Button: "button",
  CardDescription: "body",
  CardTitle: "heading",
  DialogDescription: "body",
  DialogTitle: "heading",
  Label: "label",
  Link: "link",
};

const isNode = (v: unknown): v is Node =>
  typeof v === "object" && v !== null && typeof (v as Node).type === "string";

const elementName = (opening: Node): string => {
  const name = opening.name as Node;
  if (name.type === "JSXIdentifier") {
    return name.name as string;
  }
  if (name.type === "JSXMemberExpression") {
    const object = name.object as Node;
    const property = name.property as Node;
    return `${(object.name as string) ?? "?"}.${(property.name as string) ?? "?"}`;
  }
  if (name.type === "JSXNamespacedName") {
    return `${((name.namespace as Node).name as string) ?? ""}:${((name.name as Node).name as string) ?? ""}`;
  }
  return "unknown";
};

const roleFor = (name: string): Role => {
  if (ROLE_BY_TAG[name]) {
    return ROLE_BY_TAG[name];
  }
  if (ROLE_BY_COMPONENT[name]) {
    return ROLE_BY_COMPONENT[name];
  }
  if (/^[a-z]/.test(name)) {
    return "body";
  }
  return "unknown";
};

// Static string value of an attribute or expression, or null when dynamic.
const staticString = (node: Node | null | undefined): string | null => {
  if (!node) {
    return null;
  }
  if (node.type === "Literal" && typeof node.value === "string") {
    return node.value;
  }
  if (node.type === "JSXExpressionContainer") {
    return staticString(node.expression as Node);
  }
  if (node.type === "TemplateLiteral") {
    const expressions = node.expressions as Node[];
    if (expressions.length > 0) {
      return null;
    }
    return (node.quasis as Node[])
      .map((q) => (q.value as { cooked?: string }).cooked ?? "")
      .join("");
  }
  if (
    node.type === "TSAsExpression" ||
    node.type === "TSSatisfiesExpression" ||
    node.type === "ParenthesizedExpression"
  ) {
    return staticString(node.expression as Node);
  }
  return null;
};

// Classes from a className value: literal, template statics, cn()-style calls.
const staticClasses = (
  node: Node | null | undefined
): { classes: string[]; dynamic: boolean } => {
  if (!node) {
    return { classes: [], dynamic: false };
  }
  if (node.type === "Literal" && typeof node.value === "string") {
    return { classes: splitClasses(node.value), dynamic: false };
  }
  if (node.type === "JSXExpressionContainer") {
    return staticClasses(node.expression as Node);
  }
  if (node.type === "TemplateLiteral") {
    const quasis = (node.quasis as Node[]).map(
      (q) => (q.value as { cooked?: string }).cooked ?? ""
    );
    return {
      classes: quasis.flatMap((q) => splitClasses(q)),
      dynamic: (node.expressions as Node[]).length > 0,
    };
  }
  if (node.type === "CallExpression") {
    const callee = node.callee as Node;
    const calleeName =
      callee.type === "Identifier"
        ? (callee.name as string)
        : callee.type === "MemberExpression"
          ? ((callee.property as Node).name as string)
          : "";
    if (!CLASS_FUNCTIONS.has(calleeName)) {
      return { classes: [], dynamic: true };
    }
    let dynamic = false;
    const classes: string[] = [];
    for (const arg of node.arguments as Node[]) {
      const inner = staticClasses(arg);
      classes.push(...inner.classes);
      dynamic ||= inner.dynamic;
      if (
        arg.type !== "Literal" &&
        arg.type !== "TemplateLiteral" &&
        arg.type !== "CallExpression"
      ) {
        dynamic = true;
      }
    }
    return { classes, dynamic };
  }
  if (
    node.type === "ConditionalExpression" ||
    node.type === "LogicalExpression"
  ) {
    return { classes: [], dynamic: true };
  }
  return { classes: [], dynamic: true };
};

const attributeByName = (opening: Node, name: string): Node | undefined => {
  for (const attr of opening.attributes as Node[]) {
    if (attr.type !== "JSXAttribute") {
      continue;
    }
    const attrName = attr.name as Node;
    const n =
      attrName.type === "JSXNamespacedName"
        ? `${(attrName.namespace as Node).name as string}:${(attrName.name as Node).name as string}`
        : (attrName.name as string);
    if (n === name) {
      return attr;
    }
  }
  return undefined;
};

const decodeEntities = (text: string): string =>
  text
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&mdash;", String.fromCodePoint(0x20_14))
    .replaceAll("&ndash;", String.fromCodePoint(0x20_13))
    .replaceAll("&hellip;", "…")
    .replaceAll("&ldquo;", "“")
    .replaceAll("&rdquo;", "”")
    .replaceAll("&lsquo;", "‘")
    .replaceAll("&rsquo;", "’")
    .replaceAll("&times;", "×")
    .replaceAll("&middot;", "·");

// Direct text of an element: JSXText plus static string expressions, in order.
const directText = (
  element: Node
): { text: string; start: number; end: number } | null => {
  let text = "";
  let start = -1;
  let end = -1;
  for (const child of element.children as Node[]) {
    let piece: string | null = null;
    if (child.type === "JSXText") {
      piece = decodeEntities(child.value as string);
    } else if (child.type === "JSXExpressionContainer") {
      piece = staticString(child.expression as Node);
    }
    if (piece !== null && piece.trim() !== "") {
      if (start === -1) {
        start = child.start;
      }
      end = child.end;
    }
    if (piece !== null) {
      text += piece;
    } else if (child.type === "JSXElement" || child.type === "JSXFragment") {
      // Inline child elements (a <b> inside a <p>) contribute their text so the
      // sentence stays whole; they are also extracted as their own units.
      const inner = directText(child);
      if (inner) {
        text += inner.text;
      }
    } else {
      text += " ";
    }
  }
  const normalised = normaliseText(text);
  if (normalised === "" || start === -1) {
    return null;
  }
  return { end, start, text: normalised };
};

export interface TsxExtractOptions {
  config: Config;
  docType: DocType;
}

export const extractTsx = (
  file: string,
  source: string,
  options: TsxExtractOptions
): Unit[] => {
  const { config, docType } = options;
  const index = new LineIndex(source);
  const lang = file.endsWith(".tsx")
    ? "tsx"
    : file.endsWith(".jsx")
      ? "jsx"
      : file.endsWith(".ts")
        ? "ts"
        : "js";
  const parsed = parseSync(file, source, { lang, sourceType: "module" });
  if (parsed.errors.length > 0) {
    const first = parsed.errors[0];
    return [
      makeUnit(file, index, {
        context: { docType, parseError: first.message, role: "unknown" },
        kind: "file",
        sourceEnd: source.length,
        sourceStart: 0,
        text: "",
      }),
    ];
  }
  const units: Unit[] = [];
  const push = (draft: UnitDraft): void => {
    if (draft.kind !== "class-list" && draft.text.length === 0) {
      return;
    }
    units.push(makeUnit(file, index, draft));
  };

  const elementSummary = (element: Node): NeighbourSummary | null => {
    if (element.type !== "JSXElement") {
      return null;
    }
    const text = directText(element);
    if (!text) {
      return null;
    }
    const opening = element.openingElement as Node;
    const classAttr = attributeByName(opening, "className");
    const classes = classAttr
      ? staticClasses(classAttr.value as Node)
      : { classes: [], dynamic: false };
    return {
      element: elementName(opening),
      text: text.text,
      typography:
        classes.classes.length > 0
          ? resolveTypography(classes.classes, config)
          : undefined,
    };
  };

  const visitElement = (element: Node, skipContext: boolean): void => {
    const opening = element.openingElement as Node;
    const name = elementName(opening);
    const role = roleFor(name);
    const text = directText(element);
    const classAttr = attributeByName(opening, "className");
    const classInfo = classAttr ? staticClasses(classAttr.value as Node) : null;

    if (text && !skipContext) {
      push({
        context: { docType, element: name, role },
        kind: "jsx-text",
        sourceEnd: text.end,
        sourceStart: text.start,
        text: text.text,
      });
    }
    for (const attr of opening.attributes as Node[]) {
      if (attr.type !== "JSXAttribute") {
        continue;
      }
      const attrName = (attr.name as Node).name as string | undefined;
      if (!attrName || !ATTR_STRING_NAMES.has(attrName)) {
        continue;
      }
      const value = staticString(attr.value as Node);
      if (value === null || value.trim() === "") {
        continue;
      }
      push({
        context: {
          attr: attrName,
          docType,
          element: name,
          role:
            attrName === "placeholder"
              ? "placeholder"
              : attrName.startsWith("aria-")
                ? "aria"
                : "label",
        },
        kind: "attr-string",
        sourceEnd: attr.end,
        sourceStart: attr.start,
        text: normaliseText(value),
      });
    }
    if (classInfo && classInfo.classes.length > 0 && text) {
      push({
        classes: classInfo.classes,
        context: {
          docType,
          dynamic: classInfo.dynamic || undefined,
          element: name,
          role,
        },
        kind: "class-list",
        sourceEnd: classAttr?.end ?? element.end,
        sourceStart: classAttr?.start ?? element.start,
        text: text.text,
        typography: resolveTypography(classInfo.classes, config),
      });
    }
    // Neighbours: text-bearing element children in order.
    const children = (element.children as Node[]).filter(
      (c) => c.type === "JSXElement"
    );
    const summaries = children.map((c) => elementSummary(c));
    for (let i = 0; i < children.length; i += 1) {
      const child = children[i];
      const summary = summaries[i];
      if (summary) {
        const prev =
          summaries
            .slice(0, i)
            .toReversed()
            .find((s) => s !== null) ?? undefined;
        const next =
          summaries.slice(i + 1).find((s) => s !== null) ?? undefined;
        neighbourMap.set(child, {
          next: next ?? undefined,
          prev: prev ?? undefined,
        });
      }
    }
    for (const child of element.children as Node[]) {
      walk(child, skipContext);
    }
  };

  const neighbourMap = new WeakMap<
    Node,
    { prev?: NeighbourSummary; next?: NeighbourSummary }
  >();

  const attachNeighbours = (): void => {
    // Second pass: class-list units get neighbours from the map keyed by element.
    for (const entry of elementNeighbours) {
      const unit = units.find(
        (u) => u.kind === "class-list" && u.sourceStart === entry.classStart
      );
      if (unit) {
        unit.neighbours = { next: entry.next, prev: entry.prev };
      }
    }
  };
  const elementNeighbours: {
    classStart: number;
    prev?: NeighbourSummary;
    next?: NeighbourSummary;
  }[] = [];

  const walk = (node: unknown, skipContext: boolean): void => {
    if (Array.isArray(node)) {
      for (const item of node) {
        walk(item, skipContext);
      }
      return;
    }
    if (!isNode(node)) {
      return;
    }
    switch (node.type) {
      case "JSXElement": {
        const neighbours = neighbourMap.get(node);
        if (neighbours) {
          const classAttr = attributeByName(
            node.openingElement as Node,
            "className"
          );
          if (classAttr) {
            elementNeighbours.push({
              classStart: classAttr.start,
              ...neighbours,
            });
          }
        }
        visitElement(node, skipContext);
        return;
      }
      case "JSXFragment": {
        for (const child of node.children as Node[]) {
          walk(child, skipContext);
        }
        return;
      }
      case "CallExpression": {
        const callee = node.callee as Node;
        const root =
          callee.type === "Identifier"
            ? (callee.name as string)
            : callee.type === "MemberExpression"
              ? (((callee.object as Node).name as string) ?? "")
              : "";
        const skip = skipContext || SKIP_CALLEES.has(root);
        walk(node.callee, skip);
        walk(node.arguments, skip);
        return;
      }
      case "ThrowStatement": {
        walk(node.argument, true);
        return;
      }
      case "Property": {
        const key = node.key as Node;
        const keyName =
          key.type === "Identifier"
            ? (key.name as string)
            : key.type === "Literal"
              ? String(key.value)
              : "";
        const value = node.value as Node;
        if (
          !skipContext &&
          COPY_KEYS.has(keyName) &&
          value.type === "Literal" &&
          typeof value.value === "string"
        ) {
          const text = normaliseText(value.value);
          if (text.length > 0) {
            push({
              context: { attr: keyName, docType, role: "literal-copy" },
              kind: "jsx-text",
              sourceEnd: value.end,
              sourceStart: value.start,
              text,
            });
          }
          return;
        }
        walk(value, skipContext);
        break;
      }
      case "ImportDeclaration":
      case "TSTypeAnnotation":
      case "TSTypeAliasDeclaration":
      case "TSInterfaceDeclaration": {
        return;
      }
      default: {
        for (const [key, value] of Object.entries(node)) {
          if (
            key === "type" ||
            key === "start" ||
            key === "end" ||
            key === "range" ||
            key === "loc"
          ) {
            continue;
          }
          if (Array.isArray(value) || isNode(value)) {
            walk(value, skipContext);
          }
        }
      }
    }
  };

  walk(parsed.program, false);
  attachNeighbours();
  return units;
};
