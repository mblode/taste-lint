// `taste-lint-ignore: <rule-id>[, reason]` on the line above a unit, or anywhere
// on the unit's first line, suppresses that rule for the unit. Also honours
// agent-skills' `ui-audit-ignore:<rule-id>` for ported rule ids.

import type { Finding, Rule } from "../types.js";

const PATTERN = /(?:taste-lint-ignore|ui-audit-ignore)\s*:\s*([a-z0-9-]+)/giu;

export const suppressionsFor = (
  sourceLines: string[],
  line: number
): Set<string> => {
  const ids = new Set<string>();
  for (const n of [line - 2, line - 1]) {
    const text = sourceLines[n];
    if (!text) {
      continue;
    }
    for (const m of text.matchAll(PATTERN)) {
      ids.add(m[1].toLowerCase());
    }
  }
  return ids;
};

export const applySuppressions = (
  findings: Finding[],
  rules: Rule[],
  sources: Map<string, string[]>
): Finding[] => {
  const byId = new Map(rules.map((r) => [r.id, r]));
  return findings.map((f) => {
    const lines = sources.get(f.file);
    if (!lines) {
      return f;
    }
    const ids = suppressionsFor(lines, f.line);
    const rule = byId.get(f.ruleId);
    const portedId = rule?.source.ruleId?.toLowerCase();
    if (
      ids.has(f.ruleId) ||
      (portedId && ids.has(portedId)) ||
      ids.has("all")
    ) {
      return { ...f, suppressed: true };
    }
    return f;
  });
};
