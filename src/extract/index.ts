import fs from "node:fs";
import path from "node:path";

import { docTypeFor } from "../lib/config.js";
import type { Config, Unit } from "../types.js";
import { extractMarkdown } from "./markdown.js";
import { extractTsx } from "./tsx.js";

export const extractFile = (config: Config, relativeFile: string): Unit[] => {
  const abs = path.join(config.root, relativeFile);
  const source = fs.readFileSync(abs, "utf-8");
  const docType = docTypeFor(config, relativeFile);
  if (/\.(md|mdx)$/.test(relativeFile)) {
    return extractMarkdown(relativeFile, source, { config, docType });
  }
  if (/\.(tsx|jsx|ts|js)$/.test(relativeFile)) {
    return extractTsx(relativeFile, source, { config, docType });
  }
  return [];
};

export const SUPPORTED_GLOBS = ["**/*.md", "**/*.mdx", "**/*.tsx", "**/*.jsx"];
