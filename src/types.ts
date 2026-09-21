// Shared type definitions. See docs/DESIGN.md for the contracts.

import type { SourceFacts } from "./analysis/repository.js";

export const DOMAINS = [
  "typography",
  "craft",
  "copywriting",
  "interaction",
  "motion",
  "product",
  "authoring",
] as const;
export type Domain = (typeof DOMAINS)[number];

export const UNIT_KINDS = [
  "paragraph",
  "heading",
  "jsx-text",
  "attr-string",
  "class-list",
  "element",
  /** The whole file, for mechanical-only regex rules over raw source. */
  "source",
  /** A file that did not parse; carries the error and nothing else. */
  "file",
] as const;
/** Kinds that are not a piece of copy and never count as units in a report. */
export const STRUCTURAL_KINDS: readonly UnitKind[] = ["source", "file"];
export type UnitKind = (typeof UNIT_KINDS)[number];

export const TIERS = ["mechanical", "jev", "both"] as const;
export type Tier = (typeof TIERS)[number];

export const SEVERITIES = ["major", "minor"] as const;
export type Severity = (typeof SEVERITIES)[number];
/** Lower is more severe; the single owner of severity ordering. */
export const SEVERITY_RANK: Record<Severity, number> = { major: 0, minor: 1 };

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
  "readme",
  "skill",
  "plan",
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
  "section",
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
}

export interface Mechanical {
  /** JavaScript regex source. Compiled with `flags` (default "gu"). */
  regex?: string;
  flags?: string;
  /** Case-insensitive whole-phrase list. Word-boundary checked. */
  phrases?: string[];
  /** Minimum matches before the rule fires (default 1). */
  minMatches?: number;
  /** The rule fires only when this regex matches nowhere in the unit. */
  absent?: string;
}

export interface CriterionSide {
  what: string;
  examples: string[];
}

export interface Question {
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
  hint: string;
  /** Named function in src/reduce/fixes.ts; present means `--fix` can apply it. */
  function?: string;
}

export interface Preconditions {
  notInCode?: boolean;
  docType?: DocType[];
  role?: Role[];
  /** Skip Markdown units when the project curls quotes at build time. */
  smartQuotesAtBuild?: false;
}

export interface ReviewProcedure {
  applicability: string;
  exceptions: string;
  evidence: string;
  verification: string;
  /** Digest of the source document when the procedure was reviewed. */
  sourceHash?: string;
}

export interface Rule {
  review?: ReviewProcedure;
  id: string;
  title: string;
  categoryId: string;
  domain: Domain;
  source: RuleSource;
  /** Resolved: include derived from `unit` unless the rule names it. */
  scope: { include: string[]; exclude: string[] };
  unit: UnitKind[];
  /** Derived: mechanical only, question only, or both. */
  tier: Tier;
  mechanical?: Mechanical;
  question?: Question;
  thresholds: Thresholds;
  severity: Severity;
  fix: Fix;
  preconditions?: Preconditions;
  status: RuleStatus;
  handWritten: string[];
  /** Absolute path of the YAML file the rule was loaded from, or `code:<module>`. */
  file: string;
  /**
   * A code rule's check, in place of `mechanical`. Counts, compares and
   * measures; throws UnresolvedError to abstain. Data rules never set it.
   */
  check?: (unit: Unit) => MechanicalHit;
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
  /** Explicit font-size tokens from taste-lint.config.json, never inferred defaults. */
  fontScale?: Record<string, string>;
  section?: string;
  headingAbove?: string;
  docType: DocType;
  element?: string;
  attr?: string;
  component?: string;
  role: Role;
  /** The className has parts this extractor could not read statically. */
  dynamic?: boolean;
  /** The className is a template literal with `${...}` inside a class. */
  interpolated?: boolean;
  parseError?: string;
  mdxFallback?: boolean;
}

export interface Unit {
  facts?: SourceFacts;
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
  /** Offset into `unit.text` of the first match; a source unit's finding line. */
  offset?: number;
}

export interface Finding {
  /** Candidate probability describes the pattern match, not a proven defect. */
  assessment?: "candidate";
  review?: ReviewProcedure;
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

export interface Progress {
  phase: "evaluating" | "complete";
  completed: number;
  planned: number;
  cachedAnswers: number;
  failed: number;
  attempts: number;
  elapsedMs: number;
}

export interface Usage {
  /** HTTP attempts when reported by the evaluator; absent for legacy evaluators. */
  attempts?: number;
  sharedAnswers?: number;
  requests: number;
  cached: number;
  inputTokens: number;
  costUsd: number;
  errors: number;
}

export type RunStatus = "complete" | "incomplete" | "dry-run";

export interface RunSummary {
  act: number;
  review: number;
  unknown: number;
  failing: number;
  failOn: Severity;
  ruleFindings: number;
}

export interface Coverage {
  byRule: Record<
    string,
    {
      eligible: number;
      skipped: number;
      negative: number;
      pending: number;
      unknown: number;
      answered: number;
    }
  >;
  byCategory: Record<string, { eligibleUnits: number; eligiblePairs: number }>;
}

export interface ScanScope {
  files: number;
  units: number;
  byDocType: Record<string, number>;
  excluded: number;
  diagnostics: string[];
}

export interface LintResult {
  summary?: RunSummary;
  ruleFindings?: Finding[];
  ruleScorecard?: Scorecard;
  coverage?: Coverage;
  scope?: ScanScope;
  reportPath?: string;
  rerun?: string;
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
  attempts?: number;
  model: string;
  answers: Record<string, { type?: string; noul?: number }>;
  usage: { input_tokens: number; output_tokens: number };
}

export type Evaluate = (
  request: SystemOneRequest,
  onAttempt?: () => void
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
  labelSource: "manifest" | "manifest-weak" | "hand" | "sweep" | "ai";
  labelModel?: string;
  labelPromptHash?: string;
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
