// SARIF 2.1.0 for GitHub code scanning and editors.

import type { Finding, LintResult, Rule } from "../types.js";

const level = (f: Finding): "error" | "warning" | "note" => {
  if (f.band === "review") {
    return "note";
  }
  return f.severity === "minor" ? "warning" : "error";
};

export const renderSarif = (
  result: LintResult,
  rules: Rule[],
  version: string
): string => {
  const used = new Set(result.findings.map((f) => f.ruleId));
  const ruleList = rules.filter((r) => used.has(r.id));
  const index = new Map(ruleList.map((r, i) => [r.id, i]));
  const sarif = {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    runs: [
      {
        results: result.findings
          .filter((f) => !f.suppressed)
          .map((f) => ({
            level: level(f),
            locations: [
              {
                physicalLocation: {
                  artifactLocation: { uri: f.file },
                  region: {
                    endColumn: f.endColumn,
                    endLine: f.endLine,
                    startColumn: f.column,
                    startLine: f.line,
                  },
                },
              },
            ],
            message: {
              text: `${f.message}. ${f.evidence} Fix: ${f.fixHint}`,
            },
            partialFingerprints: { unitId: f.unitId },
            properties: {
              band: f.band,
              probability: f.probability,
              severity: f.severity,
            },
            ruleId: f.ruleId,
            ruleIndex: index.get(f.ruleId),
          })),
        tool: {
          driver: {
            informationUri: "https://github.com/mblode/taste-lint",
            name: "taste-lint",
            rules: ruleList.map((r) => ({
              fullDescription: { text: r.question?.instructions ?? r.fix.hint },
              helpUri: `https://github.com/${r.source.repo}/blob/main/${r.source.path}#L${r.source.line}`,
              id: r.id,
              properties: {
                categoryId: r.categoryId,
                domain: r.domain,
                severity: r.severity,
                tier: r.tier,
              },
              shortDescription: { text: r.title },
            })),
            version,
          },
        },
      },
    ],
    version: "2.1.0",
  };
  return `${JSON.stringify(sarif, null, 2)}\n`;
};
