import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadCorpus, splitFor } from "../eval/corpus.js";
import { InputError } from "../lib/errors.js";
import { suppressionsFor } from "../reduce/suppress.js";
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
  /** Hand labelling: the labeller could not decide, a rubric gap. */
  unsure?: boolean;
  note?: string;
  item: Omit<CorpusItem, "labels" | "labelSource">;
}
// Likely failures first, so a timeboxed labelling session spends its time on
// them: the author's own ignore comment, the mechanical check firing where
// Jev said no, then Jev's review band. Order hints the stratum, never the score.
const STRATA = ["ignored", "disagree", "review", "high", "negative"] as const;
export const makeSamples = (
  units: Unit[],
  rules: Rule[],
  answers: Map<string, Record<string, number>>,
  negatives: Map<string, Set<string>>,
  perStratum = 3,
  sourceRepo = "scan",
  sources = new Map<string, string[]>()
): LabelSample[] => {
  const buckets = new Map<string, LabelSample[]>();
  const seen = new Set<string>();
  const semanticRules = rules.filter((rule) => rule.question);
  for (const unit of units) {
    for (const rule of semanticRules) {
      const answered = answers.get(unit.id)?.[rule.id];
      const probability =
        answered ?? (negatives.get(unit.id)?.has(rule.id) ? 0 : undefined);
      if (probability === undefined) {
        continue;
      }
      const ignores = suppressionsFor(sources.get(unit.file) ?? [], unit.line);
      const stratum: (typeof STRATA)[number] =
        ignores.has(rule.id) ||
        ignores.has("all") ||
        ignores.has(rule.source.ruleId?.toLowerCase() ?? rule.id)
          ? "ignored"
          : answered !== undefined &&
              rule.mechanical &&
              answered < rule.thresholds.review
            ? "disagree"
            : probability < rule.thresholds.review
              ? "negative"
              : probability < rule.thresholds.act
                ? "review"
                : "high";
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
      const bucket = `${STRATA.indexOf(stratum)}:${rule.id}:${docType}`;
      const list = buckets.get(bucket) ?? [];
      list.push(sample);
      buckets.set(bucket, list);
    }
  }
  return [...buckets.entries()]
    .toSorted(([a], [b]) => a.localeCompare(b))
    .flatMap(([, list]) =>
      list.toSorted((a, b) => a.id.localeCompare(b.id)).slice(0, perStratum)
    );
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
      ...(typeof row.note === "string" && row.note.trim()
        ? { note: row.note.trim() }
        : {}),
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
