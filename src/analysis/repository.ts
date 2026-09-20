import fs from "node:fs";
import path from "node:path";

import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";
import { parseSync } from "oxc-parser";

import type { ArchitecturePolicy } from "../types.js";
import { htmlElements } from "./html.js";
import type { HtmlElement } from "./html.js";

export interface DocumentNode {
  type: string;
  value?: string;
  url?: string;
  identifier?: string;
  depth?: number;
  lang?: string | null;
  children?: DocumentNode[];
  position?: { start: { offset?: number }; end: { offset?: number } };
}

export interface ImportFact {
  name: string;
  offset: number;
  typeOnly: boolean;
}

export interface SourceFacts {
  html?: HtmlElement[];
  document?: DocumentNode;
  imports?: ImportFact[];
  parseError?: string;
  repository: Pick<
    Repository,
    "root" | "read" | "resolve" | "exists" | "manifest" | "policy"
  >;
}

export const descendants = (node: DocumentNode): DocumentNode[] => [
  node,
  ...(node.children ?? []).flatMap(descendants),
];
export const nodeText = (node: DocumentNode): string =>
  node.value ?? (node.children ?? []).map(nodeText).join("");

export class Repository {
  readonly root: string;
  private readonly contents = new Map<string, string | undefined>();

  readonly policy?: ArchitecturePolicy;

  constructor(root: string, policy?: ArchitecturePolicy) {
    this.policy = policy;
    this.root = fs.realpathSync(root);
  }

  resolve(file: string, target: string): string | undefined {
    const abs = path.resolve(this.root, path.dirname(file), target);
    const relative = path.relative(this.root, abs);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      return undefined;
    }
    return relative.split(path.sep).join("/");
  }

  read(file: string): string | undefined {
    if (this.contents.has(file)) {
      return this.contents.get(file);
    }
    let text: string | undefined;
    try {
      const abs = fs.realpathSync(path.resolve(this.root, file));
      const relative = path.relative(this.root, abs);
      if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
        text = fs.readFileSync(abs, "utf-8");
      }
    } catch {
      text = undefined;
    }
    this.contents.set(file, text);
    return text;
  }

  exists(file: string): boolean {
    try {
      const real = fs.realpathSync(path.resolve(this.root, file));
      const relative = path.relative(this.root, real);
      return !relative.startsWith("..") && !path.isAbsolute(relative);
    } catch {
      return false;
    }
  }

  manifest(
    file: string
  ): { file: string; value: Record<string, unknown> } | undefined {
    let dir = path.dirname(file);
    while (true) {
      const name = path.posix.join(dir, "package.json");
      const source = this.read(name);
      if (source !== undefined) {
        try {
          const value: unknown = JSON.parse(source);
          if (value && typeof value === "object" && !Array.isArray(value)) {
            return { file: name, value: value as Record<string, unknown> };
          }
        } catch {
          return undefined;
        }
      }
      if (dir === ".") {
        return undefined;
      }
      dir = path.dirname(dir);
    }
  }
}

type Ast = Record<string, unknown>;
const importsFrom = (value: unknown, output: ImportFact[]): void => {
  if (!value || typeof value !== "object") {
    return;
  }
  if (Array.isArray(value)) {
    for (const child of value) {
      importsFrom(child, output);
    }
    return;
  }
  const node = value as Ast;
  const source = node.source as Ast | undefined;
  if (
    [
      "ImportDeclaration",
      "ExportNamedDeclaration",
      "ExportAllDeclaration",
      "ImportExpression",
    ].includes(String(node.type)) &&
    typeof source?.value === "string"
  ) {
    const specifiers = node.specifiers as Ast[] | undefined;
    output.push({
      name: source.value,
      offset: Number(node.start ?? 0),
      typeOnly:
        node.importKind === "type" ||
        node.exportKind === "type" ||
        Boolean(
          specifiers?.length && specifiers.every((s) => s.importKind === "type")
        ),
    });
  }
  for (const [key, child] of Object.entries(node)) {
    if (key !== "comments") {
      importsFrom(child, output);
    }
  }
};

export const sourceFacts = (
  file: string,
  text: string,
  repository: Repository
): SourceFacts => {
  const facts: SourceFacts = { repository };
  if (/\.html?$/.test(file)) {
    facts.html = htmlElements(text);
  }
  if (/\.mdx?$/.test(file) || /(?:^|\/)llms(?:-full)?\.txt$/.test(file)) {
    facts.document = fromMarkdown(
      text.replace(/^---\r?\n[\s\S]*?\r?\n---(?=\r?\n|$)/, (m) =>
        m.replaceAll(/[^\r\n]/g, " ")
      ),
      { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] }
    ) as DocumentNode;
  }
  if (/\.[cm]?[jt]sx?$/.test(file)) {
    try {
      const parsed = parseSync(file, text);
      if (parsed.errors.length) {
        facts.parseError = "Source could not be parsed";
      } else {
        facts.imports = [];
        importsFrom(parsed.program, facts.imports);
      }
    } catch {
      facts.parseError = "Source could not be parsed";
    }
  }
  return facts;
};
