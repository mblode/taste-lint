import type { LintResult } from "../types.js";

export const renderJson = (
  result: LintResult,
  manifest: Record<string, unknown>
): string =>
  `${JSON.stringify(
    {
      coverage: result.coverage,
      estimated: result.estimated,
      exitCode: result.exitCode,
      findings: result.findings,
      manifest,
      reportPath: result.reportPath,
      rerun: result.rerun,
      ruleFindings: result.ruleFindings,
      ruleScorecard: result.ruleScorecard,
      rules: result.rules,
      scope: result.scope,
      scorecard: result.scorecard,
      status: result.status,
      summary: result.summary,
      units: result.units,
      unknowns: result.unknowns,
      usage: result.usage,
      version: 1,
    },
    null,
    2
  )}\n`;
