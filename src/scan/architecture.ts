import path from "node:path";

import { InputError } from "../lib/errors.js";
import type { ScanFinding } from "./report.js";
import { hash, object, readJson } from "./storage.js";

const invalid = (): never => {
  throw new InputError(
    "INVALID_GRAPH_REPORT",
    "Expected dependency-cruiser JSON with modules and summary.violations, using repository-relative paths."
  );
};
const local = (value: unknown): value is string =>
  typeof value === "string" &&
  !!value &&
  !path.isAbsolute(value) &&
  !value.includes("\\") &&
  !value.split("/").includes("..") &&
  !value.includes("\0");

// Consume dependency-cruiser's documented ICruiseResult/IViolation boundary.
// Graph construction and repository configuration execution stay in that tool.
export const importArchitecture = (
  file: string
): {
  findings: ScanFinding[];
  digest: string;
  modules: string[];
  incomplete: boolean;
  contentHash: string;
} => {
  const raw = readJson(file);
  if (
    !object(raw) ||
    !Array.isArray(raw.modules) ||
    !object(raw.summary) ||
    !Array.isArray(raw.summary.violations)
  ) {
    return invalid();
  }
  const modules: string[] = [];
  let incomplete = false;
  for (const mod of raw.modules) {
    if (!object(mod) || !local(mod.source)) {
      return invalid();
    }
    modules.push(mod.source);
    if (
      mod.couldNotResolve === true ||
      (Array.isArray(mod.dependencies) &&
        mod.dependencies.some((d) => object(d) && d.couldNotResolve === true))
    ) {
      incomplete = true;
    }
  }
  if (
    object(raw.summary.environment) &&
    Array.isArray(raw.summary.environment.issues) &&
    raw.summary.environment.issues.length
  ) {
    incomplete = true;
  }
  incomplete ||= modules.length === 0;
  const findings: ScanFinding[] = [];
  for (const v of raw.summary.violations) {
    if (
      !object(v) ||
      !object(v.rule) ||
      typeof v.rule.name !== "string" ||
      !local(v.from) ||
      typeof v.to !== "string" ||
      !["error", "warn", "info", "ignore"].includes(String(v.rule.severity))
    ) {
      return invalid();
    }
    if (v.rule.severity === "ignore") {
      continue;
    }
    const ruleId = `dependency-cruiser/${v.rule.name}`;
    const excerpt = `${v.from} -> ${v.to}`;
    findings.push({
      band: v.rule.severity === "error" ? "act" : "review",
      categoryId: "repository-contracts",
      column: 1,
      domain: "architecture",
      endColumn: 1,
      endLine: 1,
      evidence: excerpt,
      excerpt,
      file: v.from,
      fingerprint: hash([ruleId, v.from, v.to, v.cycle, v.via]),
      fixHint:
        typeof v.rule.comment === "string"
          ? v.rule.comment
          : "Follow the declared dependency policy; rerun dependency-cruiser with the same configuration.",
      lifecycle: "new",
      line: 1,
      message: v.rule.name,
      origin: "dependency-cruiser",
      probability: 1,
      ruleId,
      severity: v.rule.severity === "error" ? "major" : "minor",
      suppressed: false,
      tier: "mechanical",
      unitId: hash([v.from, v.to]),
    });
  }
  return {
    contentHash: hash(raw),
    digest: hash([
      raw.summary.optionsUsed ?? {},
      raw.summary.ruleSetUsed ?? {},
      raw.summary.environment && object(raw.summary.environment)
        ? raw.summary.environment.version
        : undefined,
    ]),
    findings,
    incomplete,
    modules,
  };
};
