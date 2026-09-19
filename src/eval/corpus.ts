// Fail-closed corpus loader. One JSON object per line under data/corpus.

import fs from "node:fs";
import path from "node:path";

import { makePRNG } from "../lib/stats.js";
import { CATEGORY_BY_ID } from "../rules/taxonomy.js";
import { UNIT_KINDS } from "../types.js";
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
    "Could not locate data/corpus. Reinstall slop-cop or pass --corpus."
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

export const loadCorpus = (
  corpusDir: string,
  rules: Rule[],
  options: { includeWeak?: boolean } = {}
): CorpusItem[] => {
  const ruleIds = new Set(rules.map((r) => r.id));
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
      if (
        typeof r.labels !== "object" ||
        r.labels === null ||
        Object.keys(r.labels as object).length === 0
      ) {
        throw new Error(
          `Invalid corpus line ${where}: labels must map rule ids to booleans`
        );
      }
      for (const [ruleId, label] of Object.entries(
        r.labels as Record<string, unknown>
      )) {
        if (typeof label !== "boolean") {
          throw new TypeError(
            `Invalid corpus line ${where}: label for ${ruleId} must be boolean`
          );
        }
        if (!ruleIds.has(ruleId)) {
          throw new Error(
            `Invalid corpus line ${where}: unknown rule ${ruleId}`
          );
        }
      }
      const labelSource = r.labelSource;
      if (
        !["manifest", "manifest-weak", "hand", "sweep"].includes(
          labelSource as string
        )
      ) {
        throw new Error(`Invalid corpus line ${where}: labelSource`);
      }
      if (labelSource === "manifest-weak" && !options.includeWeak) {
        continue;
      }
      if (typeof r.source !== "object" || r.source === null) {
        throw new Error(`Invalid corpus line ${where}: source required`);
      }
      const split =
        r.split === "dev" || r.split === "holdout" ? r.split : splitFor(r.id);
      items.push({
        categoryId: r.categoryId,
        classes: Array.isArray(r.classes) ? (r.classes as string[]) : undefined,
        context: (r.context as CorpusItem["context"]) ?? {},
        id: r.id,
        kind: r.kind as CorpusItem["kind"],
        labelSource: labelSource as CorpusItem["labelSource"],
        labels: r.labels as Record<string, boolean>,
        neighbours: r.neighbours as CorpusItem["neighbours"],
        source: r.source as CorpusItem["source"],
        split,
        text: r.text,
      });
    }
  }
  if (items.length === 0) {
    throw new Error(`Corpus is empty under ${corpusDir}`);
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
