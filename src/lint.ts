// The lint pipeline: extract units, plan, run mechanical checks, batch Jev
// requests, reduce to findings, score. Model calls happen only through
// `ctx.evaluate`, so tests and dry runs never touch the network.

import fs from "node:fs";
import path from "node:path";

import { extractFile, SUPPORTED_GLOBS } from "./extract/index.js";
import { loadConfig } from "./lib/config.js";
import { collectFiles } from "./lib/glob.js";
import { makeRecorder } from "./lib/record.js";
import { costUsd } from "./lib/tokens.js";
import { chunkQuestions } from "./map/batch.js";
import { AnswerCache } from "./map/cache.js";
import { DEFAULT_MODEL, makeFetchEvaluate } from "./map/jev.js";
import { judge } from "./map/judge.js";
import { jevFindings } from "./reduce/bands.js";
import { dedupe } from "./reduce/dedupe.js";
import { FIXES } from "./reduce/fixes.js";
import type { FixFunction } from "./reduce/fixes.js";
import { buildScorecard } from "./reduce/scorecard.js";
import { applySuppressions } from "./reduce/suppress.js";
import { loadRules, resolveRulesDir } from "./rules/load.js";
import type {
  Evaluate,
  Finding,
  LintResult,
  RecorderHandle,
  Rule,
  Severity,
  Unit,
} from "./types.js";
import { SEVERITY_RANK, STRUCTURAL_KINDS } from "./types.js";

export interface LintOptions {
  root: string;
  targets: string[];
  rulesDir?: string;
  only?: string[];
  exclude?: string[];
  dryRun?: boolean;
  printRequests?: boolean;
  mechanicalOnly?: boolean;
  noCache?: boolean;
  limitUnits?: number;
  failOn?: Severity;
  fix?: boolean;
  resultsDir?: string;
  model?: string;
  apiKey?: string;
  /** Extra units supplied by the caller (rendered mode). */
  extraUnits?: Unit[];
}

export interface LintContext {
  evaluate?: Evaluate;
  stdout?: (text: string) => void;
  stderr?: (text: string) => void;
}

export const defaultResultsDir = (): string =>
  path.join(process.cwd(), "results");

export const runLint = async (
  options: LintOptions,
  ctx: LintContext = {}
): Promise<
  LintResult & {
    rulesLoaded: Rule[];
    units: number;
    manifest: Record<string, unknown>;
  }
> => {
  const stderr = ctx.stderr ?? ((t: string) => process.stderr.write(t));
  const stdout = ctx.stdout ?? ((t: string) => process.stdout.write(t));
  const config = loadConfig(options.root);
  const rulesDir = resolveRulesDir(options.rulesDir);
  const rules = loadRules(rulesDir, { only: options.only });
  const model = options.model ?? DEFAULT_MODEL;
  const resultsDir = options.resultsDir ?? defaultResultsDir();

  const files =
    options.targets.length > 0
      ? collectFiles(config.root, options.targets, SUPPORTED_GLOBS, [
          ...config.exclude,
          ...(options.exclude ?? []),
        ])
      : [];
  let units: Unit[] = [];
  const sources = new Map<string, string[]>();
  for (const file of files) {
    units.push(...extractFile(config, file));
    sources.set(
      file,
      fs.readFileSync(path.join(config.root, file), "utf-8").split("\n")
    );
  }
  if (options.extraUnits) {
    units.push(...options.extraUnits);
  }
  if (options.limitUnits !== undefined) {
    units = units.slice(0, options.limitUnits);
  }

  const cache = new AnswerCache(
    path.join(resultsDir, "cache"),
    !options.noCache
  );
  const manifest: Record<string, unknown> = {
    config_root: config.root,
    model,
    rules: rules.map((r) => r.id),
    smart_quotes_at_build: config.smartQuotesAtBuild,
    targets: options.targets,
  };

  // A live run needs an evaluate; a dry run reads the cache only. Deciding
  // that here keeps the key check next to the flag that waives it.
  let evaluate = ctx.evaluate;
  let recorder: RecorderHandle | undefined;
  if (!options.dryRun && !options.mechanicalOnly) {
    if (!evaluate) {
      const apiKey = options.apiKey ?? process.env.TYPESAFE_API_KEY;
      if (!apiKey) {
        throw new Error(
          "Set TYPESAFE_API_KEY for Jev-backed rules, or run with --dry-run or --mechanical-only."
        );
      }
      evaluate = makeFetchEvaluate({ apiKey });
    }
  } else {
    evaluate = undefined;
  }
  const preview = await judge(units, rules, {
    cache,
    config,
    mechanicalOnly: options.mechanicalOnly,
    model,
  });
  if (options.printRequests) {
    for (const p of preview.pending) {
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
  let judgement = preview;
  if (evaluate && preview.pending.length > 0) {
    recorder = makeRecorder("lint", { resultsDir, skillsDir: config.root });
    recorder.append({ kind: "manifest", ...manifest });
    judgement = await judge(units, rules, {
      cache,
      config,
      evaluate,
      mechanicalOnly: options.mechanicalOnly,
      model,
      onProgress: (mark) => stderr(mark),
      recorder,
    });
    stderr("\n");
  }
  const status: LintResult["status"] = options.dryRun
    ? "dry-run"
    : judgement.usage.errors > 0
      ? "incomplete"
      : "complete";
  const jf = jevFindings(judgement.jobs, judgement.answers);
  let findings: Finding[] = [...judgement.mechanical, ...jf.findings];
  const { unknowns, usage } = judgement;
  recorder?.summary({ findings: findings.length, status, usage });

  findings = dedupe(applySuppressions(findings, rules, sources));

  if (options.fix && !options.dryRun) {
    applyFixes(config.root, findings, rules, units, stderr);
  }

  const scorecard = buildScorecard(units, rules, findings, unknowns, jf.silent);
  const failOn = options.failOn ?? "minor";
  const failing = findings.filter(
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
  return {
    estimated: options.dryRun
      ? {
          costUsd: costUsd(preview.estimatedTokens),
          inputTokens: preview.estimatedTokens,
          requests: preview.estimatedRequests,
        }
      : undefined,
    exitCode,
    findings,
    manifest,
    rules: rules.map((r) => r.id),
    rulesLoaded: rules,
    scorecard,
    status,
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
    if (
      !rule ||
      !unit ||
      !fn ||
      f.suppressed ||
      f.band !== "act" ||
      rule.fix.mode !== "deterministic"
    ) {
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
      `${skipped} finding${skipped === 1 ? "" : "s"} left for a hand fix: the unit has no prose range slop-cop can rewrite safely\n`
    );
  }
};
