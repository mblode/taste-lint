import fs from "node:fs";

import { Option } from "commander";
import type { Command } from "commander";

import { renderConsistency, runConsistency } from "../eval/consistency.js";
import { loadCorpus, resolveCorpusDir } from "../eval/corpus.js";
import { corpusCoverage, renderCoverage } from "../eval/coverage.js";
import {
  labelAgreement,
  labelGaps,
  labelSession,
  renderAgreement,
  renderGaps,
} from "../eval/label.js";
import { runEval } from "../eval/metrics.js";
import { defaultResultsDir } from "../lib/config.js";
import { DEFAULT_MODEL, evaluateFromEnv, KEY_HINT } from "../map/jev.js";
import { loadRules, resolveRulesDir } from "../rules/load.js";
import { labelsToCorpus } from "../scan/samples.js";
import type { CorpusItem } from "../types.js";

export const LABEL_SOURCES = [
  "hand",
  "ai",
  "manifest",
  "manifest-weak",
  "sweep",
] as const;
export const parseSources = (
  value?: string
): CorpusItem["labelSource"][] | undefined =>
  value
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      if (!(LABEL_SOURCES as readonly string[]).includes(s)) {
        throw new Error(
          `--source must be one or more of ${LABEL_SOURCES.join(", ")}`
        );
      }
      return s as CorpusItem["labelSource"];
    });

export function registerEvalCommand(program: Command): void {
  const command = program
    .command("eval")
    .enablePositionalOptions()
    .description(
      "Run every rule over its labelled corpus and report precision, recall and calibration"
    )
    .option(
      "--corpus <path>",
      "Corpus directory (default: packaged data/corpus)"
    )
    .option("--rules <path>", "Rules directory")
    .addOption(
      new Option("--output <format>", "Output format")
        .choices(["text", "json"])
        .default("text")
    )
    .option("--only <ids>", "Comma-separated rule ids")
    .addOption(
      new Option("--split <name>", "Evaluation split")
        .choices(["dev", "holdout", "all"])
        .default("all")
    )
    .option("--include-weak", "Include manifest-weak labels")
    .option(
      "--source <sources>",
      "Only these label sources, e.g. hand to measure agreement with you"
    )
    .option(
      "--disagreements",
      "List items where the judge and the label disagree, with text and notes"
    )
    .option(
      "--check",
      "Fail on reference disagreement; incomplete evaluation exits 2"
    )
    .option("--dry-run", "Plan without calling Jev")
    .option("--no-cache", "Ignore cached answers")
    .option("--results-dir <path>", "Where logs and cache live")
    .option("--model <id>", "Jev model id", DEFAULT_MODEL)
    .option(
      "--html <file>",
      "Write a static offline HTML report linking every case"
    )
    .action(async (options) => {
      const result = await runEval({
        check: options.check,
        corpusDir: options.corpus,
        disagreements: options.disagreements,
        dryRun: options.dryRun,
        html: Boolean(options.html),
        includeWeak: options.includeWeak,
        model: options.model,
        noCache: !options.cache,
        only: options.only
          ?.split(",")
          .map((s: string) => s.trim())
          .filter(Boolean),
        resultsDir: options.resultsDir,
        rulesDir: options.rules,
        sources: parseSources(options.source),
        split: options.split,
      });
      if (options.html && result.html) {
        fs.writeFileSync(options.html, result.html);
        process.stdout.write(`Wrote ${options.html}\n`);
      }
      process.stdout.write(
        options.output === "json"
          ? `${JSON.stringify(result, null, 2)}\n`
          : result.report
      );
      process.exitCode = result.exitCode;
    });
  command
    .command("coverage")
    .description(
      "Inspect label balance, document coverage and split overlap without API calls"
    )
    .option("--corpus <path>", "Corpus directory")
    .option("--rules <path>", "Rules directory")
    .option("--include-weak", "Include weak labels")
    .addOption(
      new Option("--output <format>", "Output format")
        .choices(["text", "json"])
        .default("text")
    )
    .action((options) => {
      const rulesDir = resolveRulesDir(options.rules);
      const rules = loadRules(rulesDir);
      const items = loadCorpus(resolveCorpusDir(options.corpus), rules, {
        includeWeak: options.includeWeak,
        knownRuleIds: new Set(
          loadRules(rulesDir, { allowDraft: true }).map((rule) => rule.id)
        ),
      });
      const coverage = corpusCoverage(items, rules);
      process.stdout.write(
        options.output === "json"
          ? `${JSON.stringify(coverage, null, 2)}\n`
          : renderCoverage(coverage)
      );
    });
  command
    .command("labels <samples>")
    .description(
      "Convert a labelled sample file from lint --samples into a corpus JSONL"
    )
    .requiredOption("--out <file>", "New corpus JSONL file")
    .option("--rules <path>", "Rules directory used to validate labels")
    .action((file: string, options: { out: string; rules?: string }) => {
      process.stdout.write(
        `Exported ${labelsToCorpus(file, options.out, options.rules)} labels.\n`
      );
    });
  command
    .command("label <samples>")
    .description(
      "Label a lint --samples file yourself, one sample at a time; saves after every answer"
    )
    .option("--minutes <n>", "Stop after this many minutes", "120")
    .action(async (file: string, options: { minutes: string }) => {
      const minutes = Number(options.minutes);
      if (!(Number.isFinite(minutes) && minutes > 0)) {
        throw new Error("--minutes must be a positive number");
      }
      const result = await labelSession(file, {
        input: process.stdin,
        minutes,
        output: process.stdout,
      });
      process.stdout.write(
        `\n${result.labelled} labelled, ${result.unsure} unsure, ${result.remaining} left${result.stopped === "timebox" ? " (timebox reached)" : ""}.\nNext: taste-lint eval gaps ${file}, then taste-lint eval labels ${file} --out data/corpus/<name>.jsonl\n`
      );
    });
  command
    .command("gaps <samples...>")
    .description(
      "Group hand labels by rule: unsure answers and notes show where the rubric needs sharpening"
    )
    .action((files: string[]) => {
      process.stdout.write(renderGaps(labelGaps(files)));
    });
  command
    .command("agreement <hand> <other>")
    .description(
      "Compare another labeller's sample file (usually AI) with your hand labels, per rule"
    )
    .option(
      "--floor <p>",
      "Agreement lower bound needed to trust the other labeller",
      "0.8"
    )
    .action((hand: string, other: string, options: { floor: string }) => {
      const floor = Number(options.floor);
      if (!(Number.isFinite(floor) && floor > 0 && floor < 1)) {
        throw new Error("--floor must be a number between 0 and 1 (exclusive)");
      }
      const rows = labelAgreement(hand, other, floor);
      process.stdout.write(renderAgreement(rows, floor));
      process.exitCode = rows.every((r) => r.trusted) ? 0 : 1;
    });
  command
    .command("consistency")
    .description(
      "Ask the judge the same question twice, cache bypassed, and report the flip rate; run with every baseline"
    )
    .option("--corpus <path>", "Corpus directory")
    .option("--rules <path>", "Rules directory")
    .option("--only <ids>", "Comma-separated rule ids")
    .addOption(
      new Option("--split <name>", "Evaluation split")
        .choices(["dev", "holdout", "all"])
        .default("all")
    )
    .option("--sample <n>", "Items to double-judge", "30")
    .option("--results-dir <path>", "Where logs and cache live")
    .option("--model <id>", "Jev model id", DEFAULT_MODEL)
    .action(async (options) => {
      const rulesDir = resolveRulesDir(options.rules);
      const rules = loadRules(rulesDir, {
        allowDraft: false,
        only: options.only
          ?.split(",")
          .map((s: string) => s.trim())
          .filter(Boolean),
      }).filter((r) => r.tier !== "mechanical");
      const knownRuleIds = new Set(
        loadRules(rulesDir, { allowDraft: true }).map((r) => r.id)
      );
      let items = loadCorpus(resolveCorpusDir(options.corpus), rules, {
        knownRuleIds,
      });
      if (options.split && options.split !== "all") {
        items = items.filter((i) => i.split === options.split);
      }
      const evaluate = evaluateFromEnv();
      if (!evaluate) {
        throw new Error(`${KEY_HINT} Consistency needs live answers.`);
      }
      const sampleSize = Number(options.sample);
      if (!(Number.isInteger(sampleSize) && sampleSize > 0)) {
        throw new Error("--sample must be a positive integer");
      }
      const result = await runConsistency(items, rules, evaluate, {
        model: options.model,
        resultsDir: options.resultsDir ?? defaultResultsDir(),
        sampleSize,
      });
      process.stdout.write(renderConsistency(result));
      process.exitCode = result.errors > 0 ? 2 : 0;
    });
}
