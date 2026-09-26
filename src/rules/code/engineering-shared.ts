// Shared by the engineering and seo code rules: which files are source,
// which are tests, which are generated, and a comment-blind view of source.

import { parseSync } from "oxc-parser";

import { UnresolvedError } from "../../reduce/mechanical.js";
import type { Unit } from "../../types.js";

export const TEST_FILES = [
  "**/*.{test,spec}.{ts,tsx,js,jsx,mts,mjs,cts,cjs}",
  "**/__tests__/**/*.{ts,tsx,js,jsx,mts,mjs}",
];
export const SOURCE_FILES = ["**/*.{ts,tsx,js,jsx,mts,mjs,cts,cjs}"];
// Generated output, declarations and vendored bundles are nobody's code to tidy.
export const GENERATED = [
  "**/*.d.ts",
  "**/*.min.js",
  "**/*.gen.*",
  "**/*.generated.*",
  "**/generated/**",
  "**/__generated__/**",
  "**/vendor/**",
  "**/fixtures/**",
  "**/__fixtures__/**",
  "**/migrations/**",
];

export type Node = Record<string, unknown> & { type?: string; start?: number };

export const walk = (value: unknown, visit: (node: Node) => void): void => {
  if (Array.isArray(value)) {
    for (const child of value) {
      walk(child, visit);
    }
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  const node = value as Node;
  if (typeof node.type === "string") {
    visit(node);
  }
  for (const [key, child] of Object.entries(node)) {
    if (key !== "comments" && key !== "parent") {
      walk(child, visit);
    }
  }
};

// Blank comments and keep offsets, so a pattern in prose never fires.
export const stripComments = (text: string): string =>
  text.replaceAll(/\/\*[\s\S]*?\*\/|(?<![:"'`\w\\])\/\/[^\n]*/gu, (m) =>
    m.replaceAll(/[^\n]/gu, " ")
  );

export const parse = (unit: Unit): Node => {
  const parsed = parseSync(unit.file, unit.text);
  if (parsed.errors.length) {
    throw new UnresolvedError("Source could not be parsed");
  }
  return parsed.program as unknown as Node;
};

export const skillSource = (skillPath: string, line: number) => ({
  line,
  path: skillPath,
  repo: "mblode/agent-skills",
});
