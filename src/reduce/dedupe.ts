// Collapse duplicate findings and merge same-category findings on one unit.

import type { Finding } from "../types.js";
import { SEVERITY_RANK } from "../types.js";

const BAND_RANK: Record<Finding["band"], number> = {
  act: 0,
  review: 1,
  silent: 2,
};

export const sortFindings = (findings: Finding[]): Finding[] =>
  findings.toSorted((a, b) => {
    if (a.file !== b.file) {
      return a.file < b.file ? -1 : 1;
    }
    if (a.line !== b.line) {
      return a.line - b.line;
    }
    if (BAND_RANK[a.band] !== BAND_RANK[b.band]) {
      return BAND_RANK[a.band] - BAND_RANK[b.band];
    }
    if (SEVERITY_RANK[a.severity] !== SEVERITY_RANK[b.severity]) {
      return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    }
    return b.probability - a.probability;
  });

export const dedupe = (findings: Finding[]): Finding[] => {
  const exact = new Map<string, Finding>();
  for (const f of findings) {
    const key = `${f.unitId}\u0000${f.ruleId}`;
    const existing = exact.get(key);
    if (!existing || f.probability > existing.probability) {
      exact.set(key, f);
    }
  }
  // Merge findings that share unit and category: keep the strongest, list
  // the others under `also`. Suppressed findings pass through on their own so
  // a suppression on one rule never hides a live finding from another.
  const byUnitCategory = new Map<string, Finding[]>();
  const out: Finding[] = [];
  for (const f of exact.values()) {
    if (f.suppressed) {
      out.push(f);
      continue;
    }
    const key = `${f.unitId}\u0000${f.categoryId}`;
    const list = byUnitCategory.get(key) ?? [];
    list.push(f);
    byUnitCategory.set(key, list);
  }
  for (const list of byUnitCategory.values()) {
    const sorted = list.toSorted((a, b) => {
      if (BAND_RANK[a.band] !== BAND_RANK[b.band]) {
        return BAND_RANK[a.band] - BAND_RANK[b.band];
      }
      return b.probability - a.probability;
    });
    const [head, ...rest] = sorted;
    out.push(
      rest.length > 0 ? { ...head, also: rest.map((r) => r.ruleId) } : head
    );
  }
  return sortFindings(out);
};
