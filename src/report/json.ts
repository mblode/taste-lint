import type { LintResult } from "../types.js";

export const renderJson = (
  result: LintResult,
  manifest: Record<string, unknown>
): string =>
  `${JSON.stringify(
    {
      estimated: result.estimated,
      findings: result.findings,
      manifest,
      rules: result.rules,
      scorecard: result.scorecard,
      status: result.status,
      units: result.units,
      unknowns: result.unknowns,
      usage: result.usage,
      version: 1,
    },
    null,
    2
  )}\n`;
