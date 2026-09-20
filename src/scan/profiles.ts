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
// These checks describe house style, not a supported product defect. Keep the
// findings visible, while strict lint and the all profile retain rule policy.
const stylePreferences = [
  "copywriting-long-sentence",
  "typography-straight-quotes",
  "typography-ellipsis",
  "typography-dashes",
  "typography-midpoint-separators",
  "typography-line-height-out-of-band",
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
  "discovery",
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
    case "discovery": {
      return {
        ...common,
        exclude: [
          ...artifacts,
          "**/supabase/templates/**",
          "**/emails/**",
          "**/email/**",
        ],
        include: [
          "**/*.html",
          "**/*.htm",
          "**/robots.txt",
          "**/llms.txt",
          "**/llms-full.txt",
        ],
        objective: "Validate static search and agent discovery artifacts",
      };
    }
    case "product": {
      return {
        ...common,
        advisory: stylePreferences,
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
        advisory: stylePreferences,
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
        advisory: stylePreferences,
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
    if (profile.name === "discovery") {
      return rule.domain === "seo" || rule.id.startsWith("authoring-llms-");
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
