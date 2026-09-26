// A profile is a scope: which files a run reads and which rule domains apply.
// It never changes a rule's status; active rules block and review-only rules
// report, whatever the profile.

import { InputError } from "../lib/errors.js";
import { matchesAny } from "../lib/glob.js";
import type { Rule } from "../types.js";

const artifacts = [
  "**/node_modules/**",
  "**/dist/**",
  "**/.next/**",
  "**/results/**",
  "**/docs/archive/**",
];
const internal = [
  "**/.claude/**",
  "**/.agents/**",
  "**/skills/**",
  "**/AGENTS.md",
  "**/CLAUDE.md",
  "**/SKILL.md",
];
export const PROFILE_NAMES = [
  "product",
  "writing",
  "instructions",
  "code",
  "all",
] as const;
export type ProfileName = (typeof PROFILE_NAMES)[number];
export interface Profile {
  name: ProfileName;
  objective: string;
  include: string[];
  exclude: string[];
}
export const profileFor = (name: string): Profile => {
  switch (name) {
    case "product": {
      return {
        exclude: [
          ...artifacts,
          ...internal,
          "**/*.{test,spec,stories}.{tsx,jsx}",
        ],
        include: ["**/*.{tsx,jsx,css,scss}"],
        name,
        objective:
          "Review application interface copy, typography, interaction and motion",
      };
    }
    case "writing": {
      return {
        exclude: [...artifacts, ...internal, "**/docs/plans/**"],
        include: ["**/*.{md,mdx}"],
        name,
        objective: "Review published prose and consumer documentation",
      };
    }
    case "instructions": {
      return {
        exclude: artifacts,
        include: [...internal, "**/docs/plans/**/*.md"],
        name,
        objective:
          "Review repository instructions, skill authoring and implementation plans",
      };
    }
    case "code": {
      return {
        // Config and env files carry committed secrets; lockfiles never do.
        exclude: [
          ...artifacts,
          ...internal,
          "**/package-lock.json",
          "**/pnpm-lock.yaml",
        ],
        include: [
          "**/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts}",
          "**/*.{json,yml,yaml,toml}",
          "**/.env",
          "**/.env.*",
        ],
        name,
        objective:
          "Review source, tests and CI for performance, data access, test value, dead code, telemetry and sensitive data",
      };
    }
    case "all": {
      return {
        exclude: artifacts,
        include: ["**/*"],
        name,
        objective: "Audit every supported input with the full rule catalog",
      };
    }
    default: {
      throw new InputError(
        "INVALID_PROFILE",
        `Choose a profile: ${PROFILE_NAMES.join(", ")}`
      );
    }
  }
};
export const profileRules = (profile: Profile, rules: Rule[]): Rule[] =>
  rules.filter((rule) => {
    const document =
      rule.domain === "authoring" ||
      rule.id.startsWith("copywriting-readme-") ||
      rule.id.startsWith("copywriting-document-");
    switch (profile.name) {
      case "all": {
        return true;
      }
      case "instructions": {
        return document;
      }
      case "writing": {
        return !document && ["copywriting", "typography"].includes(rule.domain);
      }
      case "code": {
        return rule.domain === "engineering";
      }
      default: {
        return !document && rule.domain !== "engineering";
      }
    }
  });
export const profileIncludes = (profile: Profile, file: string): boolean =>
  matchesAny(file, profile.include) && !matchesAny(file, profile.exclude);
