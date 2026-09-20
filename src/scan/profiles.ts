import { InputError } from "../lib/errors.js";
import { matchesAny } from "../lib/glob.js";
import type { DocType, Rule } from "../types.js";

const artifacts = [
  "**/node_modules/**",
  "**/dist/**",
  "**/.next/**",
  "**/results/**",
  "**/docs/archive/**",
  "**/.captain/**",
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
  "architecture",
  "all",
] as const;
export type ProfileName = (typeof PROFILE_NAMES)[number];
export interface ScanProfile {
  name: ProfileName;
  objective: string;
  include: string[];
  exclude: string[];
  docTypes: { glob: string; type: DocType }[];
  advisory: string[];
}
export const profileFor = (name: string): ScanProfile => {
  if (!PROFILE_NAMES.includes(name as ProfileName)) {
    throw new InputError(
      "INVALID_PROFILE",
      `Choose a scan profile: ${PROFILE_NAMES.join(", ")}`
    );
  }
  const common = {
    advisory: [],
    docTypes: [],
    exclude: artifacts,
    name: name as ProfileName,
  };
  switch (name) {
    case "product": {
      return {
        ...common,
        exclude: [
          ...artifacts,
          ...internal,
          "**/*.{test,spec,stories}.{tsx,jsx}",
        ],
        include: ["**/*.{tsx,jsx,css,scss}"],
        objective:
          "Review application interface copy, typography, interaction and motion",
      };
    }
    case "writing": {
      return {
        ...common,
        advisory: ["copywriting-long-sentence", "typography-straight-quotes"],
        docTypes: [
          { glob: "**/content/writing/**/*.{md,mdx}", type: "personal" },
        ],
        exclude: [...artifacts, ...internal, "**/docs/plans/**"],
        include: [
          "**/content/**/*.{md,mdx}",
          "**/README.md",
          "**/public/**/*.md",
          "**/docs/**/*.{md,mdx}",
        ],
        objective: "Review published prose and consumer documentation",
      };
    }
    case "instructions": {
      return {
        ...common,
        advisory: ["copywriting-long-sentence", "typography-straight-quotes"],
        include: [...internal, "**/docs/plans/**/*.md"],
        objective:
          "Review repository instructions, skill authoring, and implementation plans",
      };
    }
    case "architecture": {
      return {
        ...common,
        exclude: [...artifacts, ...internal],
        include: ["**/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts,json}"],
        objective: "Check declared package and repository contracts",
      };
    }
    default: {
      return {
        ...common,
        exclude: [],
        include: ["**/*"],
        objective: "Audit all supported inputs with the full rule catalog",
      };
    }
  }
};
export const profileRules = (profile: ScanProfile, rules: Rule[]): Rule[] =>
  rules.filter((rule) => {
    if (profile.name === "all") {
      return true;
    }
    if (profile.name === "architecture") {
      return ["architecture", "dx"].includes(rule.domain);
    }
    if (profile.name === "instructions") {
      return (
        rule.domain === "authoring" ||
        rule.id.startsWith("copywriting-document-")
      );
    }
    if (profile.name === "writing") {
      return ["copywriting", "typography"].includes(rule.domain);
    }
    return (
      !["architecture", "dx", "authoring"].includes(rule.domain) &&
      !rule.id.startsWith("copywriting-readme-") &&
      !rule.id.startsWith("copywriting-document-")
    );
  });
export const profileIncludes = (profile: ScanProfile, file: string): boolean =>
  matchesAny(file, profile.include) && !matchesAny(file, profile.exclude);
