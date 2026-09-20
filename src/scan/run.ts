import fs from "node:fs";

import pkg from "../../package.json" with { type: "json" };
import { SUPPORTED_GLOBS } from "../extract/index.js";
import { loadConfig } from "../lib/config.js";
import { InputError } from "../lib/errors.js";
import { collectFiles } from "../lib/glob.js";
import { runLint } from "../lint.js";
import type { LintContext } from "../lint.js";
import { loadRules, resolveRulesDir } from "../rules/load.js";
import { SEVERITY_RANK } from "../types.js";
import type { Rule, Unit } from "../types.js";
import { importArchitecture } from "./architecture.js";
import { changedLines, touchesChange } from "./git.js";
import { profileFor, profileIncludes, profileRules } from "./profiles.js";
import { identify, readReport, readDecisions, reconcile } from "./report.js";
import type { ScanReport } from "./report.js";
import { makeSamples } from "./samples.js";
import type { LabelSample } from "./samples.js";
import { hash } from "./storage.js";

export interface ScanOptions {
  root: string;
  targets: string[];
  profile?: string;
  rulesDir?: string;
  only?: string[];
  exclude?: string[];
  dryRun?: boolean;
  resultsDir?: string;
  model?: string;
  baseline?: string;
  decisions?: string;
  since?: string;
  newOnly?: boolean;
  dependencyCruiser?: string;
  samples?: boolean;
}
export const runScan = async (
  options: ScanOptions,
  ctx: LintContext = {}
): Promise<{ report: ScanReport; rules: Rule[]; samples: LabelSample[] }> => {
  if (options.newOnly && !options.baseline) {
    throw new InputError("INVALID_ARGUMENT", "--new-only requires --baseline.");
  }
  const root = fs.realpathSync(loadConfig(options.root).root);
  const profile = profileFor(options.profile ?? "product");
  const config = loadConfig(root, profile.docTypes);
  const exclude = [
    ...config.exclude,
    ...(options.exclude ?? []),
    ...profile.exclude,
  ];
  const files = collectFiles(
    root,
    options.targets,
    SUPPORTED_GLOBS,
    exclude
  ).filter((file) => profileIncludes(profile, file));
  const rules = profileRules(
    profile,
    loadRules(resolveRulesDir(options.rulesDir), { only: options.only }),
    Boolean(options.only?.length || options.rulesDir)
  );
  for (const rule of rules) {
    if (profile.advisory.includes(rule.id)) {
      rule.status = "review-only";
    }
  }
  if (!rules.length) {
    throw new InputError(
      "EMPTY_RULE_SELECTION",
      "No rules match the selected profile and IDs."
    );
  }
  const graph = options.dependencyCruiser
    ? importArchitecture(options.dependencyCruiser)
    : undefined;
  const signature = hash({
    config: { ...config, root: undefined },
    engineVersion: pkg.version,
    exclude,
    graph: graph?.digest,
    model: options.model ?? "jev-latest",
    profile,
    root,
    rules: rules.map(({ file: _file, check, ...rule }) => ({
      ...rule,
      check: check?.toString(),
    })),
    targets: options.targets.toSorted(),
  });
  const baseline = options.baseline ? readReport(options.baseline) : undefined;
  if (
    baseline &&
    (baseline.signature !== signature ||
      baseline.root !== root ||
      baseline.status !== "complete")
  ) {
    throw new InputError(
      "INCOMPATIBLE_BASELINE",
      "Baseline must be a complete scan of this root with the same profile, targets, rules, model and evaluation mode."
    );
  }
  const decisions = readDecisions(options.decisions, signature);
  const diff = options.since ? changedLines(root, options.since) : undefined;
  let units: Unit[] = [];
  let samples: LabelSample[] = [];
  const result = await runLint(
    {
      advisoryRules: profile.advisory,
      docTypes: profile.docTypes,
      dryRun: options.dryRun,
      exclude,
      model: options.model,
      only: rules.map((r) => r.id),
      resultsDir: options.resultsDir,
      root,
      rulesDir: options.rulesDir,
      targets: files,
    },
    {
      ...ctx,
      onEvidence: (u, answers, negatives) => {
        units = u;
        if (options.samples) {
          samples = makeSamples(u, rules, answers, negatives, 3, root);
        }
        ctx.onEvidence?.(u, answers, negatives);
      },
    }
  );
  const findings = identify(
    (result.ruleFindings ?? []).filter((f) => !f.suppressed),
    units
  );
  for (const finding of graph?.findings ?? []) {
    if (files.includes(finding.file)) {
      findings.push(finding);
    }
  }
  const unresolvedFiles = new Set(
    units
      .filter((u) => u.context.parseError || u.facts?.parseError)
      .map((u) => u.file)
  );
  const complete =
    result.status === "complete" && files.length > 0 && !graph?.incomplete;
  const resolved = reconcile(
    findings,
    baseline,
    complete,
    result.unknowns,
    decisions
  );
  for (const finding of resolved) {
    if (
      unresolvedFiles.has(finding.file) ||
      (finding.origin === "dependency-cruiser" &&
        !graph?.modules.includes(finding.file))
    ) {
      finding.lifecycle = "unverified";
    }
  }
  const visible = findings.filter(
    (f) =>
      f.decision?.status !== "dismissed" &&
      (!options.newOnly || f.lifecycle === "new") &&
      (!diff ||
        (f.origin === "dependency-cruiser"
          ? diff.untracked.has(f.file) ||
            (diff.ranges.get(f.file)?.length ?? 0) > 0
          : touchesChange(diff, f.file, f.line, f.endLine)))
  );
  const failing = visible.filter(
    (f) => f.band === "act" && SEVERITY_RANK[f.severity] <= SEVERITY_RANK.minor
  ).length;
  const report: ScanReport = {
    architecture: graph
      ? {
          contentHash: graph.contentHash,
          incomplete: graph.incomplete,
          modules: graph.modules.length,
        }
      : undefined,
    coverage: result.coverage,
    diagnostics: [
      ...(profile.name === "product" &&
      !options.only?.length &&
      !options.rulesDir
        ? [
            "Focused product checks; appearance preferences and experimental ports require --only or --profile all. This is not a complete UI audit.",
          ]
        : []),
      ...(result.scope?.diagnostics ?? []),
      ...(graph?.incomplete
        ? [
            "Imported dependency graph contains unresolved edges or environment issues.",
          ]
        : []),
    ],
    estimated: result.estimated,
    exitCode:
      result.status === "incomplete" || files.length === 0 || graph?.incomplete
        ? 2
        : failing > 0
          ? 1
          : 0,
    files,
    findings,
    kind: "taste-lint-scan",
    profile,
    reporting: {
      since: diff?.base,
      visible: visible.map((f) => f.fingerprint),
    },
    resolved,
    root,
    signature,
    status: !files.length || graph?.incomplete ? "incomplete" : result.status,
    summary: {
      dismissed: findings.filter((f) => f.decision?.status === "dismissed")
        .length,
      existing: findings.filter((f) => f.lifecycle === "existing").length,
      failing,
      new: findings.filter((f) => f.lifecycle === "new").length,
      resolved: resolved.filter((f) => f.lifecycle === "resolved").length,
      review: visible.filter((f) => f.band === "review").length,
      total: findings.length,
      unknown: result.unknowns.length,
      unverified: resolved.filter((f) => f.lifecycle === "unverified").length,
      visible: visible.length,
    },
    unknowns: result.unknowns,
    usage: result.usage,
    version: 1,
  };
  return { report, rules, samples };
};
