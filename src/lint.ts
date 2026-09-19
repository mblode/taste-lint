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
import { chunkQuestions, prepareRequests, runRequests } from "./map/batch.js";
import { AnswerCache } from "./map/cache.js";
import { DEFAULT_MODEL, makeFetchEvaluate, ProviderError } from "./map/jev.js";
import { planRequests } from "./map/plan.js";
import { jevFindings } from "./reduce/bands.js";
import { dedupe } from "./reduce/dedupe.js";
import { FIXES } from "./reduce/fixes.js";
import { buildScorecard } from "./reduce/scorecard.js";
import { applySuppressions } from "./reduce/suppress.js";
import { loadRules, resolveRulesDir } from "./rules/load.js";
import type {
  Evaluate,
  Finding,
  LintResult,
  Rule,
  Severity,
  Unit,
} from "./types.js";

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

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  major: 1,
  minor: 2,
};

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
  const resultsDir = options.resultsDir ?? path.join(process.cwd(), "results");

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

  const plan = planRequests(units, rules, config);
  const jobs = options.mechanicalOnly ? [] : plan.jobs;
  const cache = new AnswerCache(
    path.join(resultsDir, "cache"),
    !options.noCache
  );
  const prepared = prepareRequests(jobs, cache, model);
  const pending = prepared.filter((p) => Object.keys(p.questions).length > 0);
  const estimatedRequests = pending.reduce(
    (s, p) => s + chunkQuestions(p).length,
    0
  );
  const estimatedTokens = pending.reduce((s, p) => s + p.estimatedTokens, 0);

  const manifest: Record<string, unknown> = {
    config_root: config.root,
    model,
    rules: rules.map((r) => r.id),
    smart_quotes_at_build: config.smartQuotesAtBuild,
    targets: options.targets,
  };

  let findings: Finding[] = [...plan.mechanical];
  let status: LintResult["status"] = "complete";
  const usage = {
    cached: 0,
    costUsd: 0,
    errors: 0,
    inputTokens: 0,
    requests: 0,
  };
  let silent: { ruleId: string }[] = [];

  if (options.printRequests) {
    for (const p of pending) {
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

  if (options.dryRun) {
    status = "dry-run";
    // Cached answers still contribute findings in a dry run.
    const answers = new Map(prepared.map((p) => [p.job.unit.id, p.cached]));
    const jf = jevFindings(jobs, answers);
    findings.push(...jf.findings);
    silent = jf.silent;
    usage.cached = prepared.reduce(
      (s, p) => s + Object.keys(p.cached).length,
      0
    );
  } else if (jobs.length > 0 && pending.length > 0) {
    let evaluate = ctx.evaluate;
    if (!evaluate) {
      const apiKey = options.apiKey ?? process.env.TYPESAFE_API_KEY;
      if (!apiKey) {
        throw new Error(
          "Set TYPESAFE_API_KEY for Jev-backed rules, or run with --dry-run or --mechanical-only."
        );
      }
      evaluate = makeFetchEvaluate({ apiKey });
    }
    const recorder = makeRecorder("lint", {
      resultsDir,
      skillsDir: config.root,
    });
    recorder.append({ kind: "manifest", ...manifest });
    let outcome;
    try {
      outcome = await runRequests(prepared, {
        cache,
        evaluate,
        model,
        onProgress: (mark) => stderr(mark),
        recorder,
      });
    } catch (error) {
      if (error instanceof ProviderError && error.category === "auth") {
        throw error;
      }
      throw error;
    }
    stderr("\n");
    usage.requests = outcome.requests;
    usage.cached = outcome.cached;
    usage.inputTokens = outcome.inputTokens;
    usage.costUsd = costUsd(outcome.inputTokens);
    usage.errors = outcome.errors;
    if (outcome.errors > 0) {
      status = "incomplete";
    }
    const jf = jevFindings(jobs, outcome.answers);
    findings.push(...jf.findings);
    silent = jf.silent;
    recorder.summary({ findings: findings.length, status, usage });
  } else if (jobs.length > 0) {
    // Everything came from cache.
    const answers = new Map(prepared.map((p) => [p.job.unit.id, p.cached]));
    const jf = jevFindings(jobs, answers);
    findings.push(...jf.findings);
    silent = jf.silent;
    usage.cached = prepared.reduce(
      (s, p) => s + Object.keys(p.cached).length,
      0
    );
  }

  findings = dedupe(applySuppressions(findings, rules, sources));

  if (options.fix && !options.dryRun) {
    applyFixes(config.root, findings, rules, units, stderr);
  }

  const scorecard = buildScorecard(
    units,
    rules,
    findings,
    plan.unknowns,
    silent
  );
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
          costUsd: costUsd(estimatedTokens),
          inputTokens: estimatedTokens,
          requests: estimatedRequests,
        }
      : undefined,
    exitCode,
    findings,
    manifest,
    rules: rules.map((r) => r.id),
    rulesLoaded: rules,
    scorecard,
    status,
    units: units.filter((u) => u.kind !== "file").length,
    unknowns: plan.unknowns,
    usage,
  };
};

// Apply deterministic fixes to the source slice of each act-band finding.
const applyFixes = (
  root: string,
  findings: Finding[],
  rules: Rule[],
  units: Unit[],
  stderr: (t: string) => void
): void => {
  const ruleById = new Map(rules.map((r) => [r.id, r]));
  const unitById = new Map(units.map((u) => [u.id, u]));
  const byFile = new Map<
    string,
    { start: number; end: number; fn: (s: string) => string }[]
  >();
  for (const f of findings) {
    const rule = ruleById.get(f.ruleId);
    const unit = unitById.get(f.unitId);
    if (
      !rule ||
      !unit ||
      f.suppressed ||
      f.band !== "act" ||
      rule.fix.mode !== "deterministic" ||
      !rule.fix.function
    ) {
      continue;
    }
    const fn = FIXES[rule.fix.function];
    if (!fn) {
      continue;
    }
    const list = byFile.get(f.file) ?? [];
    list.push({ end: unit.sourceEnd, fn, start: unit.sourceStart });
    byFile.set(f.file, list);
  }
  for (const [file, edits] of byFile) {
    const abs = path.join(root, file);
    let source = fs.readFileSync(abs, "utf-8");
    for (const edit of edits.toSorted((a, b) => b.start - a.start)) {
      const slice = source.slice(edit.start, edit.end);
      source =
        source.slice(0, edit.start) + edit.fn(slice) + source.slice(edit.end);
    }
    fs.writeFileSync(abs, source);
    stderr(
      `fixed ${edits.length} range${edits.length === 1 ? "" : "s"} in ${file}\n`
    );
  }
};
