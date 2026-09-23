// Hand labelling: you make the calls, then the judge is tuned to agree with
// you. A vibed judge settles hard cases with the model's biases instead.

import path from "node:path";
import readline from "node:readline";
import type { Readable, Writable } from "node:stream";

import { InputError } from "../lib/errors.js";
import { wilson } from "../lib/stats.js";
import type { LabelSample } from "../scan/samples.js";
import { object, readJson, writeJson } from "../scan/storage.js";
import type { CorpusItem, Rule } from "../types.js";
import type { RuleEval } from "./metrics.js";

interface SampleFile {
  version: 1 | 2;
  annotation?: unknown;
  samples: LabelSample[];
  [key: string]: unknown;
}

const readSamples = (file: string): SampleFile => {
  const raw = readJson(file);
  if (
    !object(raw) ||
    (raw.version !== 1 && raw.version !== 2) ||
    !Array.isArray(raw.samples)
  ) {
    throw new InputError(
      "INVALID_LABELS",
      `Expected a version 1 or 2 sample file from lint --samples: ${file}`
    );
  }
  return raw as SampleFile;
};

export interface LabelSessionOptions {
  input: Readable;
  output: Writable;
  minutes?: number;
  now?: () => number;
}

export interface LabelSessionResult {
  labelled: number;
  unsure: number;
  remaining: number;
  stopped: "done" | "quit" | "timebox";
}

const show = (
  sample: LabelSample,
  index: number,
  total: number,
  first: boolean
) => {
  const { context, neighbours, text } = sample.item;
  const lines = [
    "",
    `[${index}/${total}] ${sample.ruleId}${context?.docType ? ` · ${context.docType}` : ""}${context?.role ? ` · ${context.role}` : ""}`,
    `Q: ${sample.criterion}`,
  ];
  const criteria = sample.rubric?.criteria as
    | Record<
        "true" | "false",
        { what?: string; examples?: string[] } | undefined
      >
    | undefined;
  if (first && criteria) {
    for (const [key, side] of [
      ["yes", criteria.true],
      ["no", criteria.false],
    ] as const) {
      if (!side) {
        continue;
      }
      lines.push(`  ${key}: ${side.what ?? ""}`);
      for (const example of side.examples ?? []) {
        lines.push(`    e.g. ${example}`);
      }
    }
  }
  if (context?.headingAbove) {
    lines.push(`Under heading: ${context.headingAbove}`);
  }
  if (neighbours?.prev) {
    lines.push(`Before: ${neighbours.prev.text}`);
  }
  lines.push("Text:", `  ${text.split("\n").join("\n  ")}`);
  if (neighbours?.next) {
    lines.push(`After: ${neighbours.next.text}`);
  }
  return `${lines.join("\n")}\n`;
};

/** Walk unlabelled samples, saving after every answer so quitting loses nothing. */
export const labelSession = async (
  file: string,
  options: LabelSessionOptions
): Promise<LabelSessionResult> => {
  const data = readSamples(file);
  if (data.annotation !== undefined) {
    throw new InputError(
      "INVALID_LABELS",
      "This file carries AI annotation. Hand-label a fresh lint --samples file."
    );
  }
  const now = options.now ?? Date.now;
  const deadline =
    options.minutes === undefined ? Infinity : now() + options.minutes * 60_000;
  const pending = data.samples.filter((s) => s.label === null && !s.unsure);
  const rl = readline.createInterface({
    input: options.input,
    terminal: false,
  });
  const lines = rl[Symbol.asyncIterator]();
  const ask = async (prompt: string): Promise<string | undefined> => {
    options.output.write(prompt);
    const next = await lines.next();
    return next.done ? undefined : String(next.value).trim();
  };
  const seenRules = new Set<string>();
  let labelled = 0;
  let unsure = 0;
  let stopped: LabelSessionResult["stopped"] = "done";
  try {
    for (const [index, sample] of pending.entries()) {
      if (now() >= deadline) {
        stopped = "timebox";
        break;
      }
      options.output.write(
        show(sample, index + 1, pending.length, !seenRules.has(sample.ruleId))
      );
      seenRules.add(sample.ruleId);
      let answer: string | undefined;
      do {
        const reply = await ask(
          "[y] violation  [n] fine  [u] unsure  [s] skip  [q] quit > "
        );
        answer = reply?.toLowerCase();
      } while (
        answer !== undefined &&
        !["y", "n", "u", "s", "q"].includes(answer)
      );
      if (answer === undefined || answer === "q") {
        stopped = "quit";
        break;
      }
      if (answer === "s") {
        continue;
      }
      const note = await ask(
        answer === "u"
          ? "What would you need to decide? > "
          : "Note (enter to skip) > "
      );
      if (answer === "u") {
        sample.unsure = true;
        unsure += 1;
      } else {
        sample.label = answer === "y";
        labelled += 1;
      }
      if (note) {
        sample.note = note;
      }
      writeJson(file, data);
      if (note === undefined) {
        stopped = "quit";
        break;
      }
    }
  } finally {
    rl.close();
  }
  return {
    labelled,
    remaining: data.samples.filter((s) => s.label === null && !s.unsure).length,
    stopped,
    unsure,
  };
};

export interface RuleGaps {
  ruleId: string;
  violations: number;
  fine: number;
  unsure: number;
  notes: { label: boolean | "unsure"; note: string; text: string }[];
}

/** Group hand labels by rule: unsure answers and notes are rubric gaps. */
export const labelGaps = (files: string[]): RuleGaps[] => {
  const byRule = new Map<string, RuleGaps>();
  for (const file of files) {
    for (const sample of readSamples(file).samples) {
      if (sample.label === null && !sample.unsure) {
        continue;
      }
      const gaps = byRule.get(sample.ruleId) ?? {
        fine: 0,
        notes: [],
        ruleId: sample.ruleId,
        unsure: 0,
        violations: 0,
      };
      if (sample.unsure) {
        gaps.unsure += 1;
      } else if (sample.label) {
        gaps.violations += 1;
      } else {
        gaps.fine += 1;
      }
      if (sample.note) {
        gaps.notes.push({
          label: sample.unsure ? "unsure" : Boolean(sample.label),
          note: sample.note,
          text: sample.item.text,
        });
      }
      byRule.set(sample.ruleId, gaps);
    }
  }
  return [...byRule.values()].toSorted(
    (a, b) =>
      b.unsure - a.unsure ||
      b.notes.length - a.notes.length ||
      a.ruleId.localeCompare(b.ruleId)
  );
};

export const renderGaps = (gaps: RuleGaps[]): string => {
  if (!gaps.length) {
    return "No hand labels yet. Run taste-lint eval label <samples.json>.\n";
  }
  const out: string[] = [];
  for (const g of gaps) {
    out.push(
      `${g.ruleId}: ${g.violations} violation, ${g.fine} fine, ${g.unsure} unsure`
    );
    if (g.unsure) {
      out.push(
        "  Unsure answers mean the rubric cannot settle these; sharpen question.criteria before tuning."
      );
    }
    for (const n of g.notes) {
      const label = n.label === "unsure" ? "unsure" : n.label ? "yes" : "no";
      out.push(
        `  [${label}] ${n.note}`,
        `        ${n.text.replaceAll("\n", " ").slice(0, 100)}`
      );
    }
  }
  return `${out.join("\n")}\n`;
};

export interface RuleAgreement {
  ruleId: string;
  n: number;
  agree: number;
  ci: [number, number];
  trusted: boolean;
}

/** How often a second labeller (usually an AI) matches your hand labels, per rule. */
export const labelAgreement = (
  handFile: string,
  otherFile: string,
  floor = 0.8
): RuleAgreement[] => {
  const hand = new Map(
    readSamples(handFile)
      .samples.filter((s) => s.label !== null)
      .map((s) => [s.id, s])
  );
  const byRule = new Map<string, { n: number; agree: number }>();
  for (const other of readSamples(otherFile).samples) {
    const mine = hand.get(other.id);
    if (!mine || other.label === null || mine.ruleId !== other.ruleId) {
      continue;
    }
    const tally = byRule.get(other.ruleId) ?? { agree: 0, n: 0 };
    tally.n += 1;
    tally.agree += mine.label === other.label ? 1 : 0;
    byRule.set(other.ruleId, tally);
  }
  return [...byRule.entries()]
    .map(([ruleId, { n, agree }]) => {
      const ci = wilson(agree, n);
      return { agree, ci, n, ruleId, trusted: ci[0] >= floor };
    })
    .toSorted((a, b) => a.ruleId.localeCompare(b.ruleId));
};

const pct = (x: number) => `${Math.round(x * 100)}%`;

export const renderAgreement = (
  rows: RuleAgreement[],
  floor: number
): string => {
  if (!rows.length) {
    return "No samples are labelled in both files.\n";
  }
  return `${rows
    .map(
      (r) =>
        `${r.ruleId}: ${r.agree}/${r.n} agree (${pct(r.agree / r.n)}, 95% CI ${pct(r.ci[0])}-${pct(r.ci[1])}) ${r.trusted ? "trusted" : `below ${pct(floor)}: label this rule by hand`}`
    )
    .join("\n")}\n`;
};

// The optimiser's input: a coding agent reads these on the dev split and edits
// the rule's question; you read them to fix wrong labels. Holdout stays unseen
// so an edit must be general policy, not a patch for one row.
export const renderDisagreements = (
  evals: RuleEval[],
  items: CorpusItem[],
  rules: Rule[]
): string => {
  const byId = new Map(items.map((item) => [item.id, item]));
  const out: string[] = [];
  for (const e of evals) {
    const rule = rules.find((r) => r.id === e.ruleId);
    if (!rule) {
      continue;
    }
    const wrong = e.pairs.filter(
      (p) => p.probability >= rule.thresholds.review !== p.label
    );
    if (!wrong.length) {
      continue;
    }
    out.push(
      `${e.ruleId}: ${wrong.length} of ${e.pairs.length} disagree (${path.relative(process.cwd(), rule.file)})`
    );
    for (const p of wrong) {
      const item = byId.get(p.id);
      out.push(
        `  ${p.label ? "labelled violation, judge missed" : "labelled fine, judge flagged"} p=${p.probability.toFixed(2)} [${item?.labelSource ?? "?"}/${item?.split ?? "?"}] ${p.id}`,
        `    ${(item?.text ?? "").replaceAll("\n", " ").slice(0, 160)}`,
        ...(item?.note ? [`    note: ${item.note}`] : [])
      );
    }
  }
  return out.length
    ? `\nDisagreements (review threshold):\n${out.join("\n")}\n`
    : "\nNo disagreements at the review threshold.\n";
};
