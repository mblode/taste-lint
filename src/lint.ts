// The lint pipeline: extract units, plan, run mechanical checks, batch Jev
// requests, reduce to findings, score. Model calls happen only through
// `ctx.evaluate`, so tests and dry runs never touch the network.

import fs from "node:fs";
import path from "node:path";

import { Repository } from "./analysis/repository.js";
import { extractSource, SUPPORTED_GLOBS } from "./extract/index.js";
import { defaultResultsDir, loadConfig } from "./lib/config.js";
import { InputError } from "./lib/errors.js";
import { collectFiles } from "./lib/glob.js";
import { makeRecorder } from "./lib/record.js";
import { costUsd } from "./lib/tokens.js";
import { chunkQuestions } from "./map/batch.js";
import { AnswerCache } from "./map/cache.js";
import { DEFAULT_MODEL, evaluateFromEnv, KEY_HINT } from "./map/jev.js";
import { prepareJudgement, executeJudgement } from "./map/judge.js";
import { jevFindings } from "./reduce/bands.js";
import { dedupe, dedupeExact } from "./reduce/dedupe.js";
import { FIXES } from "./reduce/fixes.js";
import type { FixFunction } from "./reduce/fixes.js";
import { buildScorecard } from "./reduce/scorecard.js";
import { applySuppressions } from "./reduce/suppress.js";
import { loadRules, resolveRulesDir } from "./rules/load.js";
import { changedLines, touchesChange } from "./scan/git.js";
import { profileFor, profileIncludes, profileRules } from "./scan/profiles.js";
import type { ProfileName } from "./scan/profiles.js";
import type {
  Evaluate,
  Progress,
  ScanScope,
  Finding,
  LintResult,
  RecorderHandle,
  Rule,
  Severity,
  Unit,
} from "./types.js";
import { SEVERITY_RANK, STRUCTURAL_KINDS } from "./types.js";

/**
 * Options for one lint run. Every field is optional: `runLint()` lints the
 * current directory with every rule, no Jev calls until a key is present.
 */
export interface LintOptions {
  /** Project root that globs, `taste-lint.config.json` and reports resolve against. Default `process.cwd()`. */
  root?: string;
  /** Files or directories relative to `root`. Default `["."]`. */
  targets?: string[];
  /** Scope files and rule domains (`product`, `writing`, `instructions`, `code`, `all`); rules keep their own status. */
  profile?: ProfileName;
  /** Report only findings on lines changed since this Git revision. */
  since?: string;
  /** File stating what the product is and does; rules that compare copy against it read it. */
  brief?: string;
  /** Rules directory. Default: the packaged `data/rules`. */
  rulesDir?: string;
  /** Rule ids to run; wins over `profile`. */
  only?: string[];
  /** Globs to skip, added to the config file's `exclude`. */
  exclude?: string[];
  /** Plan and estimate cost without calling Jev. */
  dryRun?: boolean;
  /** With `dryRun`, write each planned Jev request as JSONL through `ctx.stdout`. */
  printRequests?: boolean;
  /** Ignore cached answers; new answers are still recorded. */
  noCache?: boolean;
  /** Lowest severity that fails the run. Default `minor`. */
  failOn?: Severity;
  /** Apply the deterministic fixes to act-band findings in place. */
  fix?: boolean;
  /** Where the answer cache and run logs live. Default `<cwd>/results`. */
  resultsDir?: string;
  /** Jev model id. Default `jev-latest`. */
  model?: string;
  /** Vercel AI Gateway key. Default: `AI_GATEWAY_API_KEY` from the environment. */
  apiKey?: string;
  /** Extra units supplied by the caller, such as a rendered page capture. */
  extraUnits?: Unit[];
}

/** Hooks for embedding: inject an evaluator, redirect output, observe progress. */
export interface LintContext {
  /** Answers Jev questions. Tests inject a fake; the default reads the key from `options.apiKey` or the environment. */
  evaluate?: Evaluate;
  /** Receives request JSONL from `printRequests`. Default `process.stdout`. */
  stdout?: (text: string) => void;
  /** Receives fix notices. Default `process.stderr`. */
  stderr?: (text: string) => void;
  /** Called at most every request with counts and elapsed time. */
  onProgress?: (progress: Progress) => void;
  /** Called once with every unit, the Jev answers and the mechanical negatives, before findings are banded. */
  onEvidence?: (
    units: Unit[],
    answers: Map<string, Record<string, number>>,
    negatives: Map<string, Set<string>>,
    rules: Rule[],
    sources: Map<string, string[]>
  ) => void;
}

export { defaultResultsDir } from "./lib/config.js";

/** What `runLint` resolves with: a report where the fields renderers treat as optional are always present. */
export type LintRun = LintResult &
  Required<
    Pick<LintResult, "summary" | "ruleFindings" | "ruleScorecard" | "scope">
  > & {
    rulesLoaded: Rule[];
    units: number;
    manifest: Record<string, unknown>;
  };

export const runLint = async (
  options: LintOptions = {},
  ctx: LintContext = {}
): Promise<LintRun> => {
  const stderr = ctx.stderr ?? ((t: string) => process.stderr.write(t));
  const stdout = ctx.stdout ?? ((t: string) => process.stdout.write(t));
  const targets = options.targets ?? ["."];
  const config = loadConfig(options.root ?? process.cwd());
  const rulesDir = resolveRulesDir(options.rulesDir);
  const profile = options.profile ? profileFor(options.profile) : undefined;
  const loaded = loadRules(rulesDir, {
    extraDirs: config.rules,
    only: options.only,
  });
  const rules =
    profile && !options.only?.length ? profileRules(profile, loaded) : loaded;
  if (rules.length === 0) {
    throw new InputError(
      "EMPTY_RULE_SELECTION",
      "No rules match the selected profile and ids."
    );
  }
  const model = options.model ?? DEFAULT_MODEL;
  const resultsDir = options.resultsDir ?? defaultResultsDir();

  const scan = { excluded: 0, messages: [] as string[] };
  const files =
    targets.length > 0
      ? collectFiles(
          config.root,
          targets,
          SUPPORTED_GLOBS,
          [
            ...config.exclude,
            ...(options.exclude ?? []),
            ...(profile?.exclude ?? []),
          ],
          scan
        ).filter((file) => !profile || profileIncludes(profile, file))
      : [];
  const units: Unit[] = [];
  const sources = new Map<string, string[]>();
  const repository = new Repository(config.root);
  for (const file of files) {
    const source = fs.readFileSync(path.join(config.root, file), "utf-8");
    units.push(...extractSource(config, file, source, repository));
    sources.set(file, source.split("\n"));
  }
  if (options.extraUnits) {
    units.push(...options.extraUnits);
  }
  if (options.brief) {
    const brief = fs.readFileSync(path.resolve(options.brief), "utf-8").trim();
    for (const unit of units) {
      unit.context.brief = brief;
    }
  }

  const scope: ScanScope = {
    byDocType: {},
    diagnostics: scan.messages,
    excluded: scan.excluded,
    files: files.length,
    units: units.filter((u) => !STRUCTURAL_KINDS.includes(u.kind)).length,
  };
  for (const u of units) {
    if (!STRUCTURAL_KINDS.includes(u.kind)) {
      scope.byDocType[u.context.docType] =
        (scope.byDocType[u.context.docType] ?? 0) + 1;
    }
  }
  const parseFailures = new Set(
    units
      .filter(
        (unit) =>
          unit.context.parseError ||
          unit.context.mdxFallback ||
          unit.facts?.parseError
      )
      .map((unit) => unit.file)
  );
  for (const file of parseFailures) {
    scope.diagnostics.push(
      `Could not fully parse ${file}; analysis is incomplete.`
    );
  }
  if (profile) {
    scope.diagnostics.push(`Profile ${profile.name}: ${profile.objective}.`);
  }
  if (units.length === 0) {
    scope.diagnostics.push(
      "No supported units were selected. Check targets and exclusions; no clean-scan verdict is available."
    );
  }

  const cache = new AnswerCache(
    path.join(resultsDir, "cache"),
    !options.noCache
  );
  const manifest: Record<string, unknown> = {
    config_root: config.root,
    model,
    provider_policy: { retries: 3, timeoutMs: 10_000 },
    rules: rules.map((r) => r.id),
    scope,
    smart_quotes_at_build: config.smartQuotesAtBuild,
    targets,
  };

  const judgeOptions = {
    cache,
    config,
    model,
  };
  const prepared = prepareJudgement(units, rules, judgeOptions);
  let evaluate = ctx.evaluate;
  let recorder: RecorderHandle | undefined;
  if (!options.dryRun && prepared.pending.length > 0) {
    evaluate ??= evaluateFromEnv(options.apiKey);
    if (!evaluate) {
      throw new InputError(
        "MISSING_CREDENTIALS",
        `${KEY_HINT} Use --dry-run to preview without calling Jev.`
      );
    }
  } else {
    evaluate = undefined;
  }
  if (options.printRequests) {
    for (const p of prepared.pending) {
      for (const questions of chunkQuestions(p)) {
        const ordered = Object.fromEntries(
          Object.keys(questions)
            .toSorted()
            .map((k) => [k, questions[k]])
        );
        stdout(
          `${JSON.stringify({ model, questions: ordered, state: p.state, unit: `${p.job.unit.file}:${p.job.unit.line}` })}\n`
        );
      }
    }
  }
  if (evaluate && prepared.pending.length > 0) {
    recorder = makeRecorder("lint", { resultsDir, skillsDir: config.root });
    recorder.append({ kind: "manifest", ...manifest });
  }
  const judgement = await executeJudgement(prepared, {
    ...judgeOptions,
    evaluate,
    onProgress: ctx.onProgress,
    recorder,
  });
  ctx.onEvidence?.(
    units,
    judgement.answers,
    judgement.negatives,
    rules,
    sources
  );
  const status: LintResult["status"] = options.dryRun
    ? "dry-run"
    : judgement.usage.errors > 0 || parseFailures.size > 0 || units.length === 0
      ? "incomplete"
      : "complete";
  const jf = jevFindings(judgement.jobs, judgement.answers);
  let findings: Finding[] = [...judgement.mechanical, ...jf.findings];
  const { unknowns, usage } = judgement;
  recorder?.summary({ findings: findings.length, status, usage });

  let ruleFindings = dedupeExact(applySuppressions(findings, rules, sources));
  if (options.since) {
    // Analysis keeps whole files for context; only changed lines are reported.
    const diff = changedLines(config.root, options.since);
    ruleFindings = ruleFindings.filter((f) =>
      touchesChange(diff, f.file, f.line, f.endLine ?? f.line)
    );
    scope.diagnostics.push(`Reporting lines changed since ${diff.base}.`);
  }
  findings = dedupe(ruleFindings);

  if (options.fix && !options.dryRun) {
    applyFixes(config.root, ruleFindings, rules, units, stderr);
  }

  const scorecard = buildScorecard(units, rules, findings, unknowns, jf.silent);
  const failOn = options.failOn ?? "minor";
  const failing = ruleFindings.filter(
    (f) =>
      f.band === "act" &&
      !f.suppressed &&
      SEVERITY_RANK[f.severity] <= SEVERITY_RANK[failOn]
  );
  let exitCode = 0;
  if (status === "incomplete") {
    exitCode = 2;
  } else if (failing.length > 0) {
    exitCode = 1;
  }
  const summary = {
    act: findings.filter((f) => f.band === "act" && !f.suppressed).length,
    failOn,
    failing: failing.length,
    review: findings.filter((f) => f.band === "review" && !f.suppressed).length,
    ruleFindings: ruleFindings.filter((f) => !f.suppressed).length,
    unknown: unknowns.length,
  };
  return {
    coverage: judgement.coverage,
    estimated: options.dryRun
      ? {
          costUsd: costUsd(judgement.estimatedTokens),
          inputTokens: judgement.estimatedTokens,
          requests: judgement.estimatedRequests,
        }
      : undefined,
    exitCode,
    findings,
    manifest,
    ruleFindings,
    ruleScorecard: buildScorecard(
      units,
      rules,
      ruleFindings,
      unknowns,
      jf.silent
    ),
    rules: rules.map((r) => r.id),
    rulesLoaded: rules,
    scope,
    scorecard,
    status,
    summary,
    units: units.filter((u) => !STRUCTURAL_KINDS.includes(u.kind)).length,
    unknowns,
    usage,
  };
};

interface Edit {
  start: number;
  end: number;
  fns: FixFunction[];
}

// Apply deterministic fixes to the prose ranges of each act-band finding.
// Only `unit.fixRanges` is ever rewritten, so quotes, braces, expressions and
// inline code around the prose are untouched. Fixes landing on the same range
// compose; ranges are otherwise disjoint by construction.
export const applyFixes = (
  root: string,
  findings: Finding[],
  rules: Rule[],
  units: Unit[],
  stderr: (t: string) => void
): void => {
  const ruleById = new Map(rules.map((r) => [r.id, r]));
  const unitById = new Map(units.map((u) => [u.id, u]));
  const byFile = new Map<string, Map<string, Edit>>();
  let skipped = 0;
  for (const f of findings) {
    const rule = ruleById.get(f.ruleId);
    const unit = unitById.get(f.unitId);
    const fn = rule?.fix.function ? FIXES[rule.fix.function] : undefined;
    if (!(rule && unit && fn) || f.suppressed || f.band !== "act") {
      continue;
    }
    if (!unit.fixRanges || unit.fixRanges.length === 0) {
      skipped += 1;
      continue;
    }
    const edits = byFile.get(f.file) ?? new Map<string, Edit>();
    for (const [start, end] of unit.fixRanges) {
      const key = `${start}:${end}`;
      const edit = edits.get(key) ?? { end, fns: [], start };
      if (!edit.fns.includes(fn)) {
        edit.fns.push(fn);
      }
      edits.set(key, edit);
    }
    byFile.set(f.file, edits);
  }
  for (const [file, edits] of byFile) {
    const abs = path.join(root, file);
    let source = fs.readFileSync(abs, "utf-8");
    const ordered = [...edits.values()].toSorted((a, b) => b.start - a.start);
    for (const edit of ordered) {
      let after = source.slice(edit.start, edit.end);
      for (const fn of edit.fns) {
        after = fn(after);
      }
      source = source.slice(0, edit.start) + after + source.slice(edit.end);
    }
    fs.writeFileSync(abs, source);
    stderr(
      `fixed ${ordered.length} range${ordered.length === 1 ? "" : "s"} in ${file}\n`
    );
  }
  if (skipped > 0) {
    stderr(
      `${skipped} finding${skipped === 1 ? "" : "s"} left for a hand fix: the unit has no prose range taste-lint can rewrite safely\n`
    );
  }
};
