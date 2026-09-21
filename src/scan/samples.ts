import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadCorpus, splitFor } from "../eval/corpus.js";
import { InputError } from "../lib/errors.js";
import { loadRules, resolveRulesDir } from "../rules/load.js";
import { buildQuestion } from "../rules/question.js";
import type { CorpusItem, Rule, SystemOneNoul, Unit } from "../types.js";
import { hash, object, readJson } from "./storage.js";

export interface LabelSample {
  id: string;
  ruleId: string;
  criterion: string;
  rubric?: SystemOneNoul;
  label: boolean | null;
  item: Omit<CorpusItem, "labels" | "labelSource">;
}
export const makeSamples = (
  units: Unit[],
  rules: Rule[],
  answers: Map<string, Record<string, number>>,
  negatives: Map<string, Set<string>>,
  perStratum = 3,
  sourceRepo = "scan"
): LabelSample[] => {
  const buckets = new Map<string, LabelSample[]>();
  const seen = new Set<string>();
  const semanticRules = rules.filter((rule) => rule.question);
  for (const unit of units) {
    for (const rule of semanticRules) {
      const probability =
        answers.get(unit.id)?.[rule.id] ??
        (negatives.get(unit.id)?.has(rule.id) ? 0 : undefined);
      if (probability === undefined) {
        continue;
      }
      const { docType, role, headingAbove } = unit.context;
      const context = {
        docType,
        headingAbove,
        role,
        ...Object.fromEntries(
          (rule.question!.context ?? [])
            .filter((key) => key !== "neighbours")
            .map((key) => [key, unit.context[key as keyof typeof unit.context]])
        ),
      };
      const rubric = buildQuestion(rule);
      const neighbours = rule.question!.context?.includes("neighbours")
        ? unit.neighbours
        : undefined;
      const evidence = [
        rule.id,
        unit.text,
        context,
        neighbours,
        unit.classes,
        rubric,
      ];
      const unique = hash(evidence);
      if (seen.has(unique)) {
        continue;
      }
      seen.add(unique);
      const id = `scan-${hash([sourceRepo, unit.file, ...evidence]).slice(0, 24)}`;
      const sample: LabelSample = {
        criterion: rule.question!.instructions,
        id,
        item: {
          categoryId: rule.categoryId,
          classes: unit.classes,
          context,
          id,
          kind: unit.kind,
          neighbours,
          source: { path: unit.file, repo: sourceRepo },
          split: splitFor(`${sourceRepo}/${unit.file}`),
          text: unit.text,
        },
        label: null,
        rubric,
        ruleId: rule.id,
      };
      const bucket = `${rule.id}:${docType}:${probability < rule.thresholds.review ? "negative" : probability < rule.thresholds.act ? "review" : "high"}`;
      const list = buckets.get(bucket) ?? [];
      list.push(sample);
      buckets.set(bucket, list);
    }
  }
  return [...buckets.values()]
    .flatMap((list) =>
      list.toSorted((a, b) => a.id.localeCompare(b.id)).slice(0, perStratum)
    )
    .toSorted((a, b) => a.id.localeCompare(b.id));
};
export const labelsToCorpus = (
  file: string,
  destination: string,
  rulesDir?: string
): number => {
  const raw = readJson(file);
  if (
    !object(raw) ||
    (raw.version !== 1 && raw.version !== 2) ||
    !Array.isArray(raw.samples)
  ) {
    throw new InputError(
      "INVALID_LABELS",
      "Expected a version 1 or 2 blind sample file."
    );
  }
  if (raw.completed !== undefined && raw.completed !== raw.samples.length) {
    throw new InputError(
      "INVALID_LABELS",
      "Labeling is incomplete. Review every sample before importing."
    );
  }
  const annotation = raw.annotation;
  const ai = object(annotation) && annotation.source === "ai";
  if (
    annotation !== undefined &&
    (!ai ||
      typeof annotation.model !== "string" ||
      !annotation.model.trim() ||
      typeof annotation.promptHash !== "string" ||
      !/^[a-f0-9]{64}$/.test(annotation.promptHash))
  ) {
    throw new InputError(
      "INVALID_LABELS",
      "AI annotation requires a model and prompt hash."
    );
  }
  const ids = new Set<string>();
  const items: CorpusItem[] = [];
  for (const row of raw.samples) {
    if (
      !object(row) ||
      typeof row.id !== "string" ||
      ids.has(row.id) ||
      typeof row.ruleId !== "string" ||
      (raw.version === 2 &&
        (!object(row.rubric) ||
          row.rubric.type !== "noul" ||
          typeof row.criterion !== "string" ||
          row.rubric.instructions !== row.criterion)) ||
      !object(row.item) ||
      row.item.id !== row.id ||
      (row.label !== null && typeof row.label !== "boolean")
    ) {
      throw new InputError(
        "INVALID_LABELS",
        "Samples require unique IDs and boolean or null labels."
      );
    }
    ids.add(row.id);
    if (row.label === null) {
      continue;
    }
    items.push({
      ...row.item,
      labelSource: ai ? "ai" : "hand",
      ...(ai
        ? {
            labelModel: annotation.model,
            labelPromptHash: annotation.promptHash,
          }
        : {}),
      labels: { [row.ruleId]: row.label },
    } as CorpusItem);
  }
  if (!items.length) {
    throw new InputError(
      "INVALID_LABELS",
      "No labels supplied. Set label to true or false after review."
    );
  }
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "taste-labels-"));
  try {
    fs.writeFileSync(
      path.join(temporary, "labels.jsonl"),
      items.map((item) => JSON.stringify(item)).join("\n")
    );
    loadCorpus(
      temporary,
      loadRules(resolveRulesDir(rulesDir), { allowDraft: true })
    );
  } finally {
    fs.rmSync(temporary, { force: true, recursive: true });
  }
  // Destination is an explicit export, never the packaged corpus implicitly.
  fs.writeFileSync(
    destination,
    `${items.map((item) => JSON.stringify(item)).join("\n")}\n`,
    { flag: "wx" }
  );
  return items.length;
};
