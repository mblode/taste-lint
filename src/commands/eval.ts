import { Option } from "commander";
import type { Command } from "commander";

import { loadCorpus, resolveCorpusDir } from "../eval/corpus.js";
import { corpusCoverage, renderCoverage } from "../eval/coverage.js";
import { runEval } from "../eval/metrics.js";
import { DEFAULT_MODEL } from "../map/jev.js";
import { loadRules, resolveRulesDir } from "../rules/load.js";
import { labelsToCorpus } from "../scan/samples.js";

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
      "--check",
      "Fail on reference disagreement; incomplete evaluation exits 2"
    )
    .option("--dry-run", "Plan without calling Jev")
    .option("--no-cache", "Ignore cached answers")
    .option("--results-dir <path>", "Where logs and cache live")
    .option("--model <id>", "Jev model id", DEFAULT_MODEL)
    .action(async (options) => {
      const result = await runEval({
        check: options.check,
        corpusDir: options.corpus,
        dryRun: options.dryRun,
        includeWeak: options.includeWeak,
        model: options.model,
        noCache: !options.cache,
        only: options.only
          ?.split(",")
          .map((s: string) => s.trim())
          .filter(Boolean),
        resultsDir: options.resultsDir,
        rulesDir: options.rules,
        split: options.split,
      });
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
}
