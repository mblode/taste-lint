import fs from "node:fs";
import path from "node:path";

import { docTypeFor } from "../lib/config.js";
import type { Config, Unit } from "../types.js";
import { extractMarkdown } from "./markdown.js";
import { extractTsx } from "./tsx.js";
import { LineIndex, makeUnit } from "./units.js";

export const extractFile = (config: Config, relativeFile: string): Unit[] => {
  const abs = path.join(config.root, relativeFile);
  const source = fs.readFileSync(abs, "utf-8");
  const docType = docTypeFor(config, relativeFile);
  if (/\.(md|mdx)$/.test(relativeFile)) {
    return extractMarkdown(relativeFile, source, { config, docType });
  }
  if (/\.(tsx|jsx)$/.test(relativeFile)) {
    return [
      ...extractTsx(relativeFile, source, { config, docType }),
      // One source unit per file for rules that pattern-match raw markup.
      makeUnit(relativeFile, new LineIndex(source), {
        context: { docType, role: "unknown" },
        kind: "source",
        sourceEnd: source.length,
        sourceStart: 0,
        text: source,
      }),
    ];
  }
  if (/\.(css|scss)$/.test(relativeFile)) {
    return [
      makeUnit(relativeFile, new LineIndex(source), {
        context: { docType, role: "unknown" },
        kind: "source",
        sourceEnd: source.length,
        sourceStart: 0,
        text: source,
      }),
    ];
  }
  return [];
};

export const SUPPORTED_GLOBS = [
  "**/*.md",
  "**/*.mdx",
  "**/*.tsx",
  "**/*.jsx",
  "**/*.css",
  "**/*.scss",
];
