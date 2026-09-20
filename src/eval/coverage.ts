import type { CorpusItem, Rule } from "../types.js";

const counts = (items: CorpusItem[], ruleId: string) => ({
  negative: items.filter((item) => item.labels[ruleId] === false).length,
  positive: items.filter((item) => item.labels[ruleId] === true).length,
});

// Describe reference evidence before scoring. Counts do not establish accuracy.
export const corpusCoverage = (items: CorpusItem[], rules: Rule[]) => {
  const sources = new Map<string, Set<string>>();
  const families = new Map<string, Set<string>>();
  const texts = new Map<string, Set<string>>();
  for (const item of items) {
    if (item.source.id) {
      const family = JSON.stringify([item.source.repo, item.source.id]);
      const splits = families.get(family) ?? new Set<string>();
      splits.add(item.split);
      families.set(family, splits);
    }
    const key = JSON.stringify([item.source.repo, item.source.path]);
    const splits = sources.get(key) ?? new Set<string>();
    splits.add(item.split);
    sources.set(key, splits);
    for (const ruleId of Object.keys(item.labels)) {
      const identity = JSON.stringify([
        ruleId,
        item.text.trim().replaceAll(/\s+/gu, " "),
      ]);
      const seen = texts.get(identity) ?? new Set<string>();
      seen.add(item.split);
      texts.set(identity, seen);
    }
  }
  return {
    items: items.length,
    labelSources: Object.fromEntries(
      [...new Set(items.map((item) => item.labelSource))].map((source) => [
        source,
        items.filter((item) => item.labelSource === source).length,
      ])
    ),
    overlappingFamilies: [...families.values()].filter(
      (splits) => splits.size > 1
    ).length,
    overlappingSources: [...sources]
      .filter(([, splits]) => splits.size > 1)
      .map(([source]) => JSON.parse(source) as [string, string]),
    overlappingTexts: [...texts.values()].filter((splits) => splits.size > 1)
      .length,
    rules: rules.map((rule) => {
      const labeled = items.filter((item) => rule.id in item.labels);
      return {
        ...counts(labeled, rule.id),
        dev: counts(
          labeled.filter((item) => item.split === "dev"),
          rule.id
        ),
        documentTypes: [
          ...new Set(labeled.map((item) => item.context?.docType ?? "unknown")),
        ].toSorted(),
        holdout: counts(
          labeled.filter((item) => item.split === "holdout"),
          rule.id
        ),
        repositories: [
          ...new Set(labeled.map((item) => item.source.repo)),
        ].toSorted(),
        ruleId: rule.id,
      };
    }),
  };
};

export const renderCoverage = (
  coverage: ReturnType<typeof corpusCoverage>
): string =>
  [
    `Reference coverage: ${coverage.items} items; ${coverage.rules.filter((rule) => rule.positive > 0 && rule.negative > 0).length}/${coverage.rules.length} rules have both positive and negative labels.`,
    `Split overlap: ${coverage.overlappingFamilies} example families; ${coverage.overlappingSources.length} source files; ${coverage.overlappingTexts} rule/text pairs. Overlap weakens held-out evidence.`,
    ...coverage.rules
      .filter((rule) => rule.positive + rule.negative > 0)
      .map(
        (rule) =>
          `${rule.ruleId}: ${rule.positive} positive, ${rule.negative} negative; holdout ${rule.holdout.positive} positive, ${rule.holdout.negative} negative; ${rule.documentTypes.length} document types; ${rule.repositories.length} repositories`
      ),
    "Coverage counts are diagnostic, not a promotion verdict.",
    "",
  ].join("\n");

// Pair coverage is complete only when every variant is judged.
export const pairedOutcomes = (
  items: CorpusItem[],
  rule: Rule,
  probabilities: Map<string, Record<string, number>>
) => {
  const families = new Map<string, CorpusItem[]>();
  for (const item of items) {
    if (!item.source.id || !(rule.id in item.labels)) {
      continue;
    }
    const key = JSON.stringify([item.source.repo, item.source.id]);
    families.set(key, [...(families.get(key) ?? []), item]);
  }
  const contrast = { failed: 0, families: 0, passed: 0, unresolved: 0 };
  for (const family of families.values()) {
    if (
      !family.some((i) => i.labels[rule.id]) ||
      !family.some((i) => !i.labels[rule.id])
    ) {
      continue;
    }
    contrast.families += 1;
    if (family.some((i) => probabilities.get(i.id)?.[rule.id] === undefined)) {
      contrast.unresolved += 1;
    } else if (
      family.every(
        (i) =>
          probabilities.get(i.id)![rule.id] >= rule.thresholds.review ===
          i.labels[rule.id]
      )
    ) {
      contrast.passed += 1;
    } else {
      contrast.failed += 1;
    }
  }
  return contrast;
};
