import { CATEGORIES } from "../rules/taxonomy.js";
import type { Finding, Rule, Scorecard, Unit, Unknown } from "../types.js";

export const buildScorecard = (
  units: Unit[],
  rules: Rule[],
  findings: Finding[],
  unknowns: Unknown[],
  silent: { ruleId: string }[]
): Scorecard => {
  const byCategory: Scorecard["byCategory"] = {};
  const byDomain: Scorecard["byDomain"] = {};
  const byRule: Scorecard["byRule"] = {};
  for (const c of CATEGORIES) {
    if (!rules.some((r) => r.categoryId === c.id)) {
      continue;
    }
    byCategory[c.id] = {
      act: 0,
      domain: c.domain,
      review: 0,
      suppressed: 0,
      units: 0,
      unknown: 0,
    };
    byDomain[c.domain] ??= {
      act: 0,
      review: 0,
      suppressed: 0,
      units: 0,
      unknown: 0,
    };
  }
  for (const r of rules) {
    byRule[r.id] = { act: 0, review: 0, silent: 0, unknown: 0 };
  }
  const unitCount = units.filter((u) => u.kind !== "file").length;
  for (const c of Object.values(byCategory)) {
    c.units = unitCount;
  }
  for (const d of Object.values(byDomain)) {
    d.units = unitCount;
  }
  for (const f of findings) {
    const cat = byCategory[f.categoryId];
    const dom = byDomain[f.domain];
    const rule = byRule[f.ruleId];
    if (f.suppressed) {
      if (cat) {
        cat.suppressed += 1;
      }
      if (dom) {
        dom.suppressed += 1;
      }
      continue;
    }
    if (cat) {
      cat[f.band === "act" ? "act" : "review"] += 1;
    }
    if (dom) {
      dom[f.band === "act" ? "act" : "review"] += 1;
    }
    if (rule) {
      rule[f.band === "act" ? "act" : "review"] += 1;
    }
  }
  const ruleById = new Map(rules.map((r) => [r.id, r]));
  for (const u of unknowns) {
    const rule = ruleById.get(u.ruleId);
    if (!rule) {
      continue;
    }
    byRule[u.ruleId].unknown += 1;
    const cat = byCategory[rule.categoryId];
    if (cat) {
      cat.unknown += 1;
    }
    const dom = byDomain[rule.domain];
    if (dom) {
      dom.unknown += 1;
    }
  }
  for (const s of silent) {
    if (byRule[s.ruleId]) {
      byRule[s.ruleId].silent += 1;
    }
  }
  return { byCategory, byDomain, byRule };
};
