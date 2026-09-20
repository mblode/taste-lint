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
import { literalArbitraryValues } from "./arbitrary.js";
import { resolveTypography, splitClasses } from "./tailwind.js";
import {
  decodeEntities,
  LineIndex,
  makeUnit,
  normaliseText,
  ROLE_BY_TAG,
} from "./units.js";
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
interface ClassInfo {
  classes: string[];
  dynamic: boolean;
  /** A template literal interpolates into a class (`bg-${color}`). */
  interpolated: boolean;
}

const staticClasses = (node: Node | null | undefined): ClassInfo => {
  if (!node) {
    return { classes: [], dynamic: false, interpolated: false };
  }
  if (node.type === "Literal" && typeof node.value === "string") {
    return {
      classes: splitClasses(node.value),
      dynamic: false,
      interpolated: false,
    };
  }
  if (node.type === "JSXExpressionContainer") {
    return staticClasses(node.expression as Node);
  }
  if (node.type === "TemplateLiteral") {
    const quasis = (node.quasis as Node[]).map(
      (q) => (q.value as { cooked?: string }).cooked ?? ""
    );
    const interpolated = (node.expressions as Node[]).length > 0;
    // A token touching `${...}` is a fragment (`bg-` of `bg-${c}-500`), not a class.
    const classes = quasis.flatMap((q, i) => {
      const tokens = splitClasses(q);
      if (i < quasis.length - 1 && !/\s$/u.test(q)) {
        tokens.pop();
      }
      if (i > 0 && !/^\s/u.test(q)) {
        tokens.shift();
      }
      return tokens;
    });
    return { classes, dynamic: interpolated, interpolated };
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
      return { classes: [], dynamic: true, interpolated: false };
    }
    let dynamic = false;
    let interpolated = false;
    const classes: string[] = [];
    for (const arg of node.arguments as Node[]) {
      const inner = staticClasses(arg);
      classes.push(...inner.classes);
      dynamic ||= inner.dynamic;
      interpolated ||= inner.interpolated;
      if (
        arg.type !== "Literal" &&
        arg.type !== "TemplateLiteral" &&
        arg.type !== "CallExpression"
      ) {
        dynamic = true;
      }
    }
    return { classes, dynamic, interpolated };
  }
  return { classes: [], dynamic: true, interpolated: false };
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

// The inside of a string literal (no quotes), unwrapping expression
// containers and casts. Template literals and anything computed give null.
const literalInner = (
  node: Node | null | undefined
): [number, number] | null => {
  if (!node) {
    return null;
  }
  if (
    node.type === "JSXExpressionContainer" ||
    node.type === "TSAsExpression" ||
    node.type === "TSSatisfiesExpression" ||
    node.type === "ParenthesizedExpression"
  ) {
    return literalInner(node.expression as Node);
  }
  if (
    node.type === "Literal" &&
    typeof node.value === "string" &&
    node.end - node.start >= 2
  ) {
    return [node.start + 1, node.end - 1];
  }
  return null;
};

interface DirectText {
  text: string;
  start: number;
  end: number;
  /** Source ranges of the prose pieces only: text nodes and literal insides. */
  fixRanges: [number, number][];
}

// Direct text of an element: JSXText plus static string expressions, in order.
// The range starts at the first non-blank character so findings point at the
// word, not the newline before it.
const directText = (element: Node): DirectText | null => {
  let text = "";
  let start = -1;
  let end = -1;
  // Inline children that contributed text; they widen the range only when the
  // element has direct text of its own, so a container of block children
  // never becomes a unit of all its descendants' prose.
  let childStart = -1;
  let childEnd = -1;
  const fixRanges: [number, number][] = [];
  for (const child of element.children as Node[]) {
    let piece: string | null = null;
    let range: [number, number] | null = null;
    if (child.type === "JSXText") {
      const raw = child.value as string;
      piece = decodeEntities(raw);
      if (raw.trim() !== "") {
        const lead = raw.length - raw.trimStart().length;
        const trail = raw.length - raw.trimEnd().length;
        range = [child.start + lead, child.end - trail];
      }
    } else if (child.type === "JSXExpressionContainer") {
      piece = staticString(child.expression as Node);
      range = literalInner(child);
    }
    if (piece !== null && piece.trim() !== "") {
      const [s, e] = range ?? [child.start, child.end];
      if (start === -1) {
        start = s;
      }
      end = e;
      if (range) {
        fixRanges.push(range);
      }
    }
    if (piece !== null) {
      text += piece;
    } else if (child.type === "JSXElement" || child.type === "JSXFragment") {
      // Inline child elements (a <b> inside a <p>) contribute their text so the
      // sentence stays whole; they are also extracted as their own units, so
      // their prose is not a fix range here.
      const inner = directText(child);
      if (inner) {
        text += inner.text;
        if (childStart === -1) {
          childStart = child.start;
        }
        childEnd = child.end;
      }
    } else {
      text += " ";
    }
  }
  const normalised = normaliseText(text);
  if (normalised === "" || start === -1) {
    return null;
  }
  if (childStart !== -1) {
    start = Math.min(start, childStart);
    end = Math.max(end, childEnd);
  }
  return { end, fixRanges, start, text: normalised };
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
  const lang = file.endsWith(".jsx") ? "jsx" : "tsx";
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
      : { classes: [], dynamic: false, interpolated: false };
    return {
      element: elementName(opening),
      text: text.text,
      typography:
        classes.classes.length > 0
          ? resolveTypography(classes.classes, config)
          : undefined,
    };
  };

  const visitElement = (
    element: Node,
    skipContext: boolean,
    parent?: Node
  ): void => {
    const opening = element.openingElement as Node;
    const name = elementName(opening);
    const role = roleFor(name);
    const text = directText(element);
    const classAttr = attributeByName(opening, "className");
    const classInfo = classAttr ? staticClasses(classAttr.value as Node) : null;

    if (text && !skipContext) {
      push({
        context: { docType, element: name, role },
        fixRanges: text.fixRanges,
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
      const inner = literalInner(attr.value as Node);
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
        fixRanges: inner ? [inner] : undefined,
        kind: "attr-string",
        sourceEnd: attr.end,
        sourceStart: attr.start,
        text: normaliseText(value),
      });
    }
    const candidates = literalArbitraryValues(classInfo?.classes ?? []);
    const describeElement = (node: Node) => {
      const tag = node.openingElement as Node;
      return {
        opening: source.slice(tag.start, tag.end),
        text: directText(node)?.text ?? "",
      };
    };
    const siblings = parent
      ? (parent.children as Node[]).filter(
          (child) => child.type === "JSXElement"
        )
      : [];
    const siblingIndex = siblings.indexOf(element);
    const section = candidates.length
      ? JSON.stringify({
          nearby:
            siblingIndex === -1
              ? []
              : siblings
                  .slice(Math.max(0, siblingIndex - 2), siblingIndex + 3)
                  .filter((sibling) => sibling !== element)
                  .map(describeElement),
          parent: parent
            ? {
                opening: source.slice(
                  (parent.openingElement as Node).start,
                  (parent.openingElement as Node).end
                ),
              }
            : undefined,
          target: { ...describeElement(element), candidates },
        })
      : undefined;
    // Every element with classes gets a class-list unit; motion and
    // design-system checks apply to icon wrappers and containers too, while
    // the typography functions decline units with no text of their own.
    if (classInfo && (classInfo.classes.length > 0 || classInfo.interpolated)) {
      push({
        classes: classInfo.classes,
        context: {
          docType,
          dynamic: classInfo.dynamic || undefined,
          element: name,
          fontScale: config?.tailwind.theme,
          interpolated: classInfo.interpolated || undefined,
          role,
          section,
        },
        kind: "class-list",
        sourceEnd: classAttr?.end ?? element.end,
        sourceStart: classAttr?.start ?? element.start,
        text: text?.text ?? "",
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
          summaries.slice(0, i).findLast((s) => s !== null) ?? undefined;
        const next =
          summaries.slice(i + 1).find((s) => s !== null) ?? undefined;
        neighbourMap.set(child, {
          next: next ?? undefined,
          prev: prev ?? undefined,
        });
      }
    }
    for (const child of element.children as Node[]) {
      walk(child, skipContext, element);
    }
    // JSX passed through props (render props, slots) carries copy too.
    walk(opening.attributes, skipContext, element);
  };

  const neighbourMap = new WeakMap<
    Node,
    { prev?: NeighbourSummary; next?: NeighbourSummary }
  >();

  const attachNeighbours = (): void => {
    // Second pass: class-list units get neighbours from the map keyed by element.
    const byStart = new Map(
      units
        .filter((unit) => unit.kind === "class-list")
        .map((unit) => [unit.sourceStart, unit])
    );
    for (const entry of elementNeighbours) {
      const unit = byStart.get(entry.classStart);
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

  const walk = (node: unknown, skipContext: boolean, parent?: Node): void => {
    if (Array.isArray(node)) {
      for (const item of node) {
        walk(item, skipContext, parent);
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
        visitElement(node, skipContext, parent);
        return;
      }
      case "JSXFragment": {
        for (const child of node.children as Node[]) {
          walk(child, skipContext, parent);
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
        walk(node.callee, skip, parent);
        walk(node.arguments, skip, parent);
        return;
      }
      case "ThrowStatement": {
        walk(node.argument, true, parent);
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
              fixRanges: [[value.start + 1, value.end - 1]],
              kind: "jsx-text",
              sourceEnd: value.end,
              sourceStart: value.start,
              text,
            });
          }
          return;
        }
        walk(value, skipContext, parent);
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
            walk(value, skipContext, parent);
          }
        }
      }
    }
  };

  walk(parsed.program, false);
  attachNeighbours();
  return units;
};
