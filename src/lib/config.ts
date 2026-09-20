// Project configuration: taste-lint.config.json at the scan root plus
// auto-detection of facts that change how rules apply.

import fs from "node:fs";
import path from "node:path";

import { DOC_TYPES } from "../types.js";
import type { ArchitecturePolicy, Config, DocType } from "../types.js";
import { InputError } from "./errors.js";
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
  { glob: "**/README.md", type: "readme" },
  { glob: "**/SKILL.md", type: "skill" },
  { glob: "**/docs/plans/**/*.md", type: "plan" },
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

const CONFIG_FILES = ["taste-lint.config.json"];
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

export interface UserConfig {
  architecture?: ArchitecturePolicy;
  $schema?: string;
  exclude?: string[];
  smartQuotesAtBuild?: boolean;
  docTypes?: { glob: string; type: DocType }[];
  components?: { skip?: string[]; unwrap?: string[] };
  tailwind?: { theme?: Record<string, string> };
}

const invalid = (key: string, expected: string): never => {
  throw new InputError(
    "INVALID_CONFIG",
    `taste-lint.config.json: ${key} must be ${expected}.`,
    { expected, field: key }
  );
};

export function validateConfig(raw: unknown): asserts raw is UserConfig {
  const object = (value: unknown, key: string): Record<string, unknown> => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return invalid(key, "an object");
    }
    return value as Record<string, unknown>;
  };
  const keys = (
    value: Record<string, unknown>,
    allowed: string[],
    prefix: string
  ) => {
    for (const key of Object.keys(value)) {
      if (!allowed.includes(key)) {
        invalid(`${prefix}${key}`, `one of ${allowed.join(", ")}`);
      }
    }
  };
  const strings = (value: unknown, key: string) => {
    if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
      invalid(key, "an array of strings");
    }
  };
  const value = object(raw, "config");
  keys(
    value,
    [
      "$schema",
      "exclude",
      "smartQuotesAtBuild",
      "docTypes",
      "components",
      "tailwind",
      "architecture",
    ],
    ""
  );
  if (value.architecture !== undefined) {
    const policy = object(value.architecture, "architecture");
    keys(
      policy,
      ["boundaries", "deprecatedImports", "generated"],
      "architecture."
    );
    if (policy.generated !== undefined) {
      strings(policy.generated, "architecture.generated");
    }
    if (policy.deprecatedImports !== undefined) {
      const deprecated = object(
        policy.deprecatedImports,
        "architecture.deprecatedImports"
      );
      for (const [key, replacement] of Object.entries(deprecated)) {
        if (typeof replacement !== "string" || !replacement.trim()) {
          invalid(
            `architecture.deprecatedImports.${key}`,
            "a nonempty replacement"
          );
        }
      }
    }
    if (policy.boundaries !== undefined) {
      if (!Array.isArray(policy.boundaries)) {
        invalid("architecture.boundaries", "an array");
      }
      for (const [i, rawBoundary] of (
        policy.boundaries as unknown[]
      ).entries()) {
        const boundary = object(rawBoundary, `architecture.boundaries[${i}]`);
        keys(
          boundary,
          ["from", "disallow", "reason"],
          `architecture.boundaries[${i}].`
        );
        for (const key of ["from", "disallow", "reason"]) {
          if (
            typeof boundary[key] !== "string" ||
            !(boundary[key] as string).trim()
          ) {
            invalid(
              `architecture.boundaries[${i}].${key}`,
              "a nonempty string"
            );
          }
        }
      }
    }
  }
  if (value.$schema !== undefined && typeof value.$schema !== "string") {
    invalid("$schema", "a string");
  }
  if (value.exclude !== undefined) {
    strings(value.exclude, "exclude");
  }
  if (
    value.smartQuotesAtBuild !== undefined &&
    typeof value.smartQuotesAtBuild !== "boolean"
  ) {
    invalid("smartQuotesAtBuild", "a boolean");
  }
  if (value.docTypes !== undefined) {
    if (!Array.isArray(value.docTypes)) {
      invalid("docTypes", "an array");
    }
    for (const [i, entry] of (value.docTypes as unknown[]).entries()) {
      const row = object(entry, `docTypes[${i}]`);
      keys(row, ["glob", "type"], `docTypes[${i}].`);
      if (typeof row.glob !== "string") {
        invalid(`docTypes[${i}].glob`, "a string");
      }
      if (!DOC_TYPES.includes(row.type as DocType)) {
        invalid(`docTypes[${i}].type`, DOC_TYPES.join(", "));
      }
    }
  }
  if (value.components !== undefined) {
    const c = object(value.components, "components");
    keys(c, ["skip", "unwrap"], "components.");
    for (const key of ["skip", "unwrap"]) {
      if (c[key] !== undefined) {
        strings(c[key], `components.${key}`);
      }
    }
  }
  if (value.tailwind !== undefined) {
    const t = object(value.tailwind, "tailwind");
    keys(t, ["theme"], "tailwind.");
    if (t.theme !== undefined) {
      const theme = object(t.theme, "tailwind.theme");
      for (const [key, val] of Object.entries(theme)) {
        if (typeof val !== "string") {
          invalid(`tailwind.theme.${key}`, "a string");
        }
      }
    }
  }
}

export const loadConfig = (
  root: string,
  defaults: Config["docTypes"] = []
): Config => {
  const absRoot = path.resolve(root);
  try {
    if (!fs.statSync(absRoot).isDirectory()) {
      throw new Error("not a directory");
    }
  } catch {
    throw new InputError(
      "INVALID_ROOT",
      `Scan root ${absRoot} must be an existing readable directory.`,
      { path: absRoot }
    );
  }
  let user: UserConfig = {};
  for (const name of CONFIG_FILES) {
    const file = path.join(absRoot, name);
    if (fs.existsSync(file)) {
      let raw: unknown;
      try {
        raw = JSON.parse(fs.readFileSync(file, "utf-8"));
      } catch {
        throw new InputError(
          "INVALID_CONFIG",
          `Cannot parse ${file}: expected JSON.`,
          { path: file }
        );
      }
      validateConfig(raw);
      user = raw;
      break;
    }
  }
  return {
    architecture: user.architecture,
    components: {
      skip: [...DEFAULT_SKIP, ...(user.components?.skip ?? [])],
      unwrap: [...DEFAULT_UNWRAP, ...(user.components?.unwrap ?? [])],
    },
    docTypes: [...(user.docTypes ?? []), ...defaults, ...DEFAULT_DOC_TYPES],
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
