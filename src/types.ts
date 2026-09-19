// Shared type definitions. See docs/DESIGN.md for the contracts.

export const DOMAINS = [
  "typography",
  "craft",
  "copywriting",
  "interaction",
  "motion",
  "product",
] as const;
export type Domain = (typeof DOMAINS)[number];

export const UNIT_KINDS = [
  "paragraph",
  "heading",
  "jsx-text",
  "attr-string",
  "class-list",
  "element",
  "file",
] as const;
export type UnitKind = (typeof UNIT_KINDS)[number];

export const TIERS = ["mechanical", "jev", "both"] as const;
export type Tier = (typeof TIERS)[number];

export const SEVERITIES = ["critical", "major", "minor"] as const;
export type Severity = (typeof SEVERITIES)[number];
/** Lower is more severe; the single owner of severity ordering. */
export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  major: 1,
  minor: 2,
};

export const RULE_STATUSES = ["active", "draft", "review-only"] as const;
export type RuleStatus = (typeof RULE_STATUSES)[number];

export const DOC_TYPES = [
  "tutorial",
  "howto",
  "reference",
  "explanation",
  "agent-instructions",
  "lesson",
  "marketing",
  "ui",
  "unknown",
] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const ROLES = [
  "heading",
  "body",
  "list-item",
  "cell",
  "button",
  "link",
  "label",
  "placeholder",
  "aria",
  "literal-copy",
  "caption",
  "unknown",
] as const;
export type Role = (typeof ROLES)[number];

export const CONTEXT_KEYS = [
  "headingAbove",
  "docType",
  "element",
  "role",
  "neighbours",
] as const;
export type ContextKey = (typeof CONTEXT_KEYS)[number];

export type Band = "act" | "review" | "silent";

export interface RuleSource {
  repo: string;
  path: string;
  line: number;
  ruleId?: string;
  tier?: string;
}

export interface Mechanical {
  /** JavaScript regex source. Compiled with `flags` (default "gu"). */
  regex?: string;
  flags?: string;
  /** Case-insensitive whole-phrase list. Word-boundary checked. */
  phrases?: string[];
  /** Named function in src/reduce/mechanical.ts. */
  function?: string;
  /** Minimum matches before the rule fires (default 1). */
  minMatches?: number;
}

export interface CriterionSide {
  what: string;
  examples: string[];
}

export interface Question {
  type: "noul";
  instructions: string;
  criteria?: { true: CriterionSide; false: CriterionSide };
  /** Context keys to include in the state for this question. */
  context?: ContextKey[];
}

export interface Thresholds {
  review: number;
  act: number;
}

export interface Fix {
  mode: "deterministic" | "llm" | "none";
  hint: string;
  /** Named function in src/reduce/fixes.ts for deterministic fixes. */
  function?: string;
}

export interface Preconditions {
  notInCode?: boolean;
  docType?: DocType[];
  role?: Role[];
  element?: string[];
  /** Skip Markdown units when the project curls quotes at build time. */
  smartQuotesAtBuild?: false;
}

export interface Rule {
  id: string;
  title: string;
  categoryId: string;
  domain: Domain;
  source: RuleSource;
  related?: string[];
  scope: { include: string[]; exclude?: string[] };
  unit: UnitKind[];
  tier: Tier;
  mechanical?: Mechanical;
  question?: Question;
  thresholds: Thresholds;
  severity: Severity;
  severityOverrides?: { scope: string; severity: Severity }[];
  fix: Fix;
  preconditions?: Preconditions;
  status: RuleStatus;
  handWritten: string[];
  /** Absolute path of the YAML file the rule was loaded from. */
  file: string;
}

export interface TuningEntry {
  act?: number;
  status?: RuleStatus;
  precisionLower?: number;
  n?: number;
  ts?: string;
}
export type Tuning = Record<string, TuningEntry>;

export interface ResolvedTypography {
  fontSizePx?: number;
  lineHeight?: number;
  lineHeightPx?: number;
  letterSpacingEm?: number;
  fontWeight?: number;
  uppercase?: boolean;
  italic?: boolean;
  family?: "mono" | "sans" | "serif";
  colourClasses: string[];
  unresolved: string[];
}

export interface NeighbourSummary {
  text: string;
  element?: string;
  typography?: ResolvedTypography;
}

export interface UnitContext {
  headingAbove?: string;
  docType: DocType;
  element?: string;
  attr?: string;
  component?: string;
  role: Role;
  dynamic?: boolean;
  parseError?: string;
  mdxFallback?: boolean;
}

export interface Unit {
  /** Stable hash of file, kind and source offset. */
  id: string;
  kind: UnitKind;
  /** Normalised rendered text, whitespace collapsed. */
  text: string;
  /** Relative to the scanned root, forward slashes. */
  file: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  sourceStart: number;
  sourceEnd: number;
  inCode: boolean;
  /** Ranges inside `text` that are code and must be skipped by regexes. */
  codeSpans: [number, number][];
  /**
   * Source ranges (UTF-16 offsets into the file) holding prose a
   * deterministic fix may rewrite: JSX text pieces, the inside of string
   * literals, Markdown text nodes. Never quotes, braces, inline code or
   * expressions. Absent means the unit cannot be fixed in place.
   */
  fixRanges?: [number, number][];
  context: UnitContext;
  typography?: ResolvedTypography;
  neighbours?: { prev?: NeighbourSummary; next?: NeighbourSummary };
  /** Class list for class-list and element units. */
  classes?: string[];
}

export interface MechanicalHit {
  fired: boolean;
  evidence: string;
}

export interface Finding {
  ruleId: string;
  categoryId: string;
  domain: Domain;
  severity: Severity;
  band: Band;
  probability: number;
  tier: Tier;
  unitId: string;
  file: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  message: string;
  evidence: string;
  fixHint: string;
  fixMode: Fix["mode"];
  suppressed: boolean;
  also?: string[];
}

export interface Unknown {
  ruleId: string;
  unitId: string;
  file: string;
  line: number;
  reason: string;
}

export interface Scorecard {
  byCategory: Record<
    string,
    {
      domain: Domain;
      units: number;
      act: number;
      review: number;
      suppressed: number;
      unknown: number;
    }
  >;
  byDomain: Record<
    string,
    {
      units: number;
      act: number;
      review: number;
      suppressed: number;
      unknown: number;
    }
  >;
  byRule: Record<
    string,
    { act: number; review: number; silent: number; unknown: number }
  >;
}

export interface Usage {
  requests: number;
  cached: number;
  inputTokens: number;
  costUsd: number;
  errors: number;
}

export type RunStatus = "complete" | "incomplete" | "dry-run";

export interface LintResult {
  status: RunStatus;
  findings: Finding[];
  unknowns: Unknown[];
  scorecard: Scorecard;
  usage: Usage;
  units: number;
  rules: string[];
  estimated?: { requests: number; inputTokens: number; costUsd: number };
  exitCode: number;
}

// Jev wire format (POST /v1/systemone).

export type EntryValue =
  | string
  | number
  | boolean
  | null
  | EntryValue[]
  | { [key: string]: EntryValue };

export interface SystemOneNoul {
  type: "noul";
  instructions: EntryValue;
  criteria?: { true?: EntryValue; false?: EntryValue } | null;
}

export interface SystemOneRequest {
  model: string;
  state: EntryValue;
  questions: Record<string, SystemOneNoul>;
}

export interface SystemOneResponse {
  model: string;
  answers: Record<string, { type?: string; noul?: number }>;
  usage: { input_tokens: number; output_tokens: number };
}

export type Evaluate = (
  request: SystemOneRequest
) => Promise<SystemOneResponse>;

export interface RecorderHandle {
  append: (record: Record<string, unknown>) => Record<string, unknown>;
  summary: (obj: Record<string, unknown>) => Record<string, unknown>;
  file: string;
}

export interface CorpusItem {
  id: string;
  kind: UnitKind;
  text: string;
  context?: Partial<UnitContext>;
  neighbours?: Unit["neighbours"];
  classes?: string[];
  categoryId: string;
  labels: Record<string, boolean>;
  labelSource: "manifest" | "manifest-weak" | "hand" | "sweep";
  source: { repo: string; path: string; id?: string; option?: string };
  split: "dev" | "holdout";
}

export interface Config {
  root: string;
  docTypes: { glob: string; type: DocType }[];
  components: { unwrap: string[]; skip: string[] };
  tailwind: { theme: Record<string, string> };
  smartQuotesAtBuild: boolean;
  exclude: string[];
}
