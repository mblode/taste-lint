import fs from "node:fs";
import path from "node:path";

import { Repository, sourceFacts } from "../analysis/repository.js";
import { docTypeFor } from "../lib/config.js";
import type { Config, Unit } from "../types.js";
import { attachEarlier } from "./earlier.js";
import { extractMarkdown } from "./markdown.js";
import { extractTsx } from "./tsx.js";
import { LineIndex, makeUnit } from "./units.js";

export const extractFile = (config: Config, relativeFile: string): Unit[] => {
  const repository = new Repository(config.root);
  const source = fs.readFileSync(path.join(config.root, relativeFile), "utf-8");
  return extractSource(config, relativeFile, source, repository);
};

// A minified bundle has lines no person writes; a generated file says so in
// its first lines.
const GENERATED_HEADER =
  /@generated\b|\bDO NOT EDIT\b|\bauto-?generated\b|\bThis file (?:was|is) (?:automatically )?generated\b/iu;
export const isGenerated = (source: string): boolean =>
  GENERATED_HEADER.test(source.slice(0, 600)) ||
  source.split("\n", 200).some((line) => line.length > 1000);

export const extractSource = (
  config: Config,
  file: string,
  source: string,
  repository: Repository
): Unit[] => {
  const docType = docTypeFor(config, file);
  const units = /\.(md|mdx)$/.test(file)
    ? extractMarkdown(file, source, { config, docType })
    : /\.(tsx|jsx)$/.test(file)
      ? extractTsx(file, source, { config, docType })
      : [];
  attachEarlier(units);
  const whole = makeUnit(file, new LineIndex(source), {
    context: {
      docType,
      role: "unknown",
      ...(isGenerated(source) ? { generated: true } : {}),
    },
    kind: "source",
    sourceEnd: source.length,
    sourceStart: 0,
    text: source,
  });
  Object.defineProperty(whole, "facts", {
    enumerable: false,
    value: sourceFacts(file, source, repository),
  });
  return [...units, whole];
};

export const SUPPORTED_GLOBS = [
  "**/*.md",
  "**/*.mdx",
  "**/*.tsx",
  "**/*.jsx",
  "**/*.css",
  "**/*.scss",
  "**/*.ts",
  "**/*.js",
  "**/*.mjs",
  "**/*.cjs",
  "**/*.mts",
  "**/*.cts",
  "**/*.json",
  "**/*.yaml",
  "**/*.yml",
  // Read as whole-file source for committed secrets.
  "**/*.toml",
  "**/.env",
  "**/.env.*",
];
