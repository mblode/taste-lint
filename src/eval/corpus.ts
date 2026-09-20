// Fail-closed corpus loader. One JSON object per line under data/corpus.

import fs from "node:fs";
import path from "node:path";

import { makePRNG } from "../lib/stats.js";
import { CATEGORY_BY_ID } from "../rules/taxonomy.js";
import { DOC_TYPES, ROLES, UNIT_KINDS } from "../types.js";
import type { CorpusItem, Rule, Unit } from "../types.js";

const ID = /^[a-z0-9][a-z0-9-]*$/;

export const resolveCorpusDir = (explicit?: string): string => {
  if (explicit) {
    const abs = path.resolve(explicit);
    if (!fs.existsSync(abs)) {
      throw new Error(`Corpus directory not found: ${abs}`);
    }
    return abs;
  }
  let dir = import.meta.dirname;
  for (let i = 0; i < 5; i += 1) {
    const candidate = path.join(dir, "data", "corpus");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    dir = path.dirname(dir);
  }
  throw new Error(
    "Could not locate data/corpus. Reinstall taste-lint or pass --corpus."
  );
};

// Deterministic 80/20 split by id hash.
export const splitFor = (id: string): "dev" | "holdout" => {
  let h = 2_166_136_261;
  for (const ch of id) {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 16_777_619) >>> 0;
  }
  return makePRNG(h)() < 0.8 ? "dev" : "holdout";
};

export interface LoadCorpusOptions {
  includeWeak?: boolean;
  /**
   * Every rule id the catalogue knows, drafts included. Labels are validated
   * against this set; `rules` says which of them are under evaluation, and
   * labels for the others are dropped rather than rejected, so `--only` and
   * `tune` can run over a corpus labelled for the whole catalogue.
   */
  knownRuleIds?: Set<string>;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export const loadCorpus = (
  corpusDir: string,
  rules: Rule[],
  options: LoadCorpusOptions = {}
): CorpusItem[] => {
  const ruleIds = new Set(rules.map((r) => r.id));
  const known = options.knownRuleIds ?? ruleIds;
  const items: CorpusItem[] = [];
  const seen = new Set<string>();
  const files = fs
    .readdirSync(corpusDir)
    .filter((f) => f.endsWith(".jsonl"))
    .toSorted();
  for (const name of files) {
    const file = path.join(corpusDir, name);
    const lines = fs.readFileSync(file, "utf-8").split("\n");
    for (const [i, line] of lines.entries()) {
      if (line.trim() === "") {
        continue;
      }
      const where = `${file}:${i + 1}`;
      let raw: unknown;
      try {
        raw = JSON.parse(line);
      } catch {
        throw new Error(`Invalid corpus line ${where}: not JSON`);
      }
      if (typeof raw !== "object" || raw === null) {
        throw new Error(`Invalid corpus line ${where}: not an object`);
      }
      const r = raw as Record<string, unknown>;
      if (typeof r.id !== "string" || !ID.test(r.id)) {
        throw new Error(`Invalid corpus line ${where}: id must be kebab-case`);
      }
      if (seen.has(r.id)) {
        throw new Error(`Duplicate corpus id ${r.id} at ${where}`);
      }
      seen.add(r.id);
      if (
        typeof r.kind !== "string" ||
        !UNIT_KINDS.includes(r.kind as (typeof UNIT_KINDS)[number])
      ) {
        throw new Error(`Invalid corpus line ${where}: unknown kind`);
      }
      if (typeof r.text !== "string") {
        throw new TypeError(
          `Invalid corpus line ${where}: text must be a string`
        );
      }
      if (
        typeof r.categoryId !== "string" ||
        !CATEGORY_BY_ID.has(r.categoryId)
      ) {
        throw new Error(`Invalid corpus line ${where}: unknown categoryId`);
      }
      if (!isRecord(r.labels) || Object.keys(r.labels).length === 0) {
        throw new Error(
          `Invalid corpus line ${where}: labels must map rule ids to booleans`
        );
      }
      const labels: Record<string, boolean> = {};
      for (const [ruleId, label] of Object.entries(r.labels)) {
        if (typeof label !== "boolean") {
          throw new TypeError(
            `Invalid corpus line ${where}: label for ${ruleId} must be boolean`
          );
        }
        if (!known.has(ruleId)) {
          throw new Error(
            `Invalid corpus line ${where}: unknown rule ${ruleId}`
          );
        }
        if (ruleIds.has(ruleId)) {
          labels[ruleId] = label;
        }
      }
      const labelSource = r.labelSource;
      if (
        !["manifest", "manifest-weak", "hand", "sweep", "ai"].includes(
          labelSource as string
        )
      ) {
        throw new Error(`Invalid corpus line ${where}: labelSource`);
      }
      if (
        labelSource === "ai" &&
        (typeof r.labelModel !== "string" ||
          !r.labelModel.trim() ||
          typeof r.labelPromptHash !== "string" ||
          !/^[a-f0-9]{64}$/.test(r.labelPromptHash))
      ) {
        throw new Error(
          `Invalid corpus line ${where}: AI labels require model and prompt hash`
        );
      }
      if (
        !isRecord(r.source) ||
        typeof r.source.repo !== "string" ||
        typeof r.source.path !== "string" ||
        (r.source.id !== undefined &&
          (typeof r.source.id !== "string" || !r.source.id.trim()))
      ) {
        throw new Error(
          `Invalid corpus line ${where}: source needs repo and path`
        );
      }
      if (r.split !== undefined && r.split !== "dev" && r.split !== "holdout") {
        throw new Error(
          `Invalid corpus line ${where}: split must be dev or holdout`
        );
      }
      if (
        r.classes !== undefined &&
        (!Array.isArray(r.classes) ||
          r.classes.some((c) => typeof c !== "string"))
      ) {
        throw new Error(
          `Invalid corpus line ${where}: classes must be strings`
        );
      }
      if (r.context !== undefined) {
        if (!isRecord(r.context)) {
          throw new Error(
            `Invalid corpus line ${where}: context must be an object`
          );
        }
        const { docType, role } = r.context;
        if (
          r.context.section !== undefined &&
          typeof r.context.section !== "string"
        ) {
          throw new Error(
            `Invalid corpus line ${where}: section must be a string`
          );
        }
        if (
          r.context.fontScale !== undefined &&
          (!isRecord(r.context.fontScale) ||
            Object.values(r.context.fontScale).some(
              (value) => typeof value !== "string"
            ))
        ) {
          throw new Error(
            `Invalid corpus line ${where}: fontScale must map tokens to strings`
          );
        }
        if (
          (docType !== undefined &&
            !DOC_TYPES.includes(docType as (typeof DOC_TYPES)[number])) ||
          (role !== undefined &&
            !ROLES.includes(role as (typeof ROLES)[number]))
        ) {
          throw new Error(
            `Invalid corpus line ${where}: unknown context docType or role`
          );
        }
      }
      if (r.neighbours !== undefined) {
        const n = r.neighbours;
        const ok =
          isRecord(n) &&
          (["prev", "next"] as const).every(
            (k) =>
              n[k] === undefined ||
              (isRecord(n[k]) &&
                typeof (n[k] as Record<string, unknown>).text === "string")
          );
        if (!ok) {
          throw new Error(
            `Invalid corpus line ${where}: neighbours must carry text`
          );
        }
      }
      // Rows outside the evaluation are dropped only after they validated.
      if (labelSource === "manifest-weak" && !options.includeWeak) {
        continue;
      }
      if (Object.keys(labels).length === 0) {
        continue;
      }
      items.push({
        categoryId: r.categoryId,
        classes: r.classes as string[] | undefined,
        context: (r.context as CorpusItem["context"]) ?? {},
        id: r.id,
        kind: r.kind as CorpusItem["kind"],
        labelModel: r.labelModel as string | undefined,
        labelPromptHash: r.labelPromptHash as string | undefined,
        labelSource: labelSource as CorpusItem["labelSource"],
        labels,
        neighbours: r.neighbours as CorpusItem["neighbours"],
        source: r.source as CorpusItem["source"],
        split:
          (r.split as CorpusItem["split"] | undefined) ??
          splitFor(JSON.stringify([r.source.repo, r.source.path])),
        text: r.text,
      });
    }
  }
  if (items.length === 0) {
    throw new Error(
      `Corpus under ${corpusDir} has no items labelled for the rules under evaluation`
    );
  }
  return items;
};

// Turn a corpus item into a Unit so the same plan and batch code runs.
export const unitFromItem = (item: CorpusItem): Unit => {
  const classes = item.classes;
  return {
    classes,
    codeSpans: [],
    column: 1,
    context: {
      docType: item.context?.docType ?? "unknown",
      role: item.context?.role ?? "body",
      ...item.context,
    },
    endColumn: 1,
    endLine: 1,
    file: `corpus/${item.id}${item.kind === "class-list" || item.kind === "element" ? ".tsx" : item.kind === "paragraph" || item.kind === "heading" ? ".md" : ".tsx"}`,
    id: item.id,
    inCode: false,
    kind: item.kind,
    line: 1,
    neighbours: item.neighbours,
    sourceEnd: item.text.length,
    sourceStart: 0,
    text: item.text,
    typography: undefined,
  };
};
