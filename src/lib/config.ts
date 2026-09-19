// Project configuration: slop-cop.config.json at the scan root plus
// auto-detection of facts that change how rules apply.

import fs from "node:fs";
import path from "node:path";

import type { Config, DocType } from "../types.js";
import { matchesAny, toPosix } from "./glob.js";

const DEFAULT_UNWRAP = [
  "Callout",
  "Depth",
  "Exercise",
  "ExerciseHint",
  "ExerciseSolution",
  "Slide",
  "Note",
  "Tip",
  "Warning",
  "Aside",
  "Kbd",
  "Term",
];
const DEFAULT_SKIP = [
  "CodeBlock",
  "CodeFigure",
  "ExerciseRun",
  "JudgementExercise",
  "LocateExercise",
  "RankExercise",
  "RepairExercise",
];

const DEFAULT_DOC_TYPES: { glob: string; type: DocType }[] = [
  { glob: "**/SKILL.md", type: "agent-instructions" },
  { glob: "**/AGENTS.md", type: "agent-instructions" },
  { glob: "**/CLAUDE.md", type: "agent-instructions" },
  { glob: "**/skills/**/*.md", type: "agent-instructions" },
  { glob: "**/.claude/**/*.md", type: "agent-instructions" },
  { glob: "**/content/**/*.mdx", type: "lesson" },
  { glob: "**/docs/**/*.md", type: "explanation" },
  // Marketing paths before the catch-all so app/(marketing)/page.tsx is not `ui`.
  { glob: "**/(marketing)/**", type: "marketing" },
  { glob: "**/landing/**", type: "marketing" },
  { glob: "**/*.{tsx,jsx}", type: "ui" },
];

const CONFIG_FILES = ["slop-cop.config.json"];
const SMARTYPANTS_FILES = [
  "next.config.ts",
  "next.config.mjs",
  "next.config.js",
  "apps/web/next.config.ts",
  "apps/web/next.config.mjs",
  "apps/web/next.config.js",
  "mdx.config.ts",
  "mdx.config.mjs",
  "contentlayer.config.ts",
  "astro.config.mjs",
  "astro.config.ts",
];

const detectSmartQuotesAtBuild = (root: string): boolean =>
  SMARTYPANTS_FILES.some((file) => {
    const abs = path.join(root, file);
    try {
      return fs.readFileSync(abs, "utf-8").includes("smartypants");
    } catch {
      return false;
    }
  });

export const loadConfig = (root: string): Config => {
  const absRoot = path.resolve(root);
  let user: Partial<Config> & { smartQuotesAtBuild?: boolean } = {};
  for (const name of CONFIG_FILES) {
    const file = path.join(absRoot, name);
    if (fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, "utf-8")) as unknown;
      if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
        throw new Error(`Invalid ${name}: must be an object`);
      }
      user = raw as Partial<Config>;
      break;
    }
  }
  return {
    components: {
      skip: [...DEFAULT_SKIP, ...(user.components?.skip ?? [])],
      unwrap: [...DEFAULT_UNWRAP, ...(user.components?.unwrap ?? [])],
    },
    docTypes: [...(user.docTypes ?? []), ...DEFAULT_DOC_TYPES],
    exclude: user.exclude ?? [],
    root: absRoot,
    smartQuotesAtBuild:
      typeof user.smartQuotesAtBuild === "boolean"
        ? user.smartQuotesAtBuild
        : detectSmartQuotesAtBuild(absRoot),
    tailwind: { theme: user.tailwind?.theme ?? {} },
  };
};

// Results, logs and the answer cache live under the current working directory.
export const defaultResultsDir = (): string =>
  path.join(process.cwd(), "results");

export const docTypeFor = (config: Config, relativeFile: string): DocType => {
  const rel = toPosix(relativeFile);
  for (const { glob, type } of config.docTypes) {
    if (matchesAny(rel, [glob])) {
      return type;
    }
  }
  return "unknown";
};
