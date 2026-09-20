import type { Command } from "commander";

import { loadCorpus, resolveCorpusDir } from "../eval/corpus.js";
import { corpusCoverage, renderCoverage } from "../eval/coverage.js";
import { runEval } from "../eval/metrics.js";
import { DEFAULT_MODEL } from "../map/jev.js";
import { loadRules, resolveRulesDir } from "../rules/load.js";

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
    .option("--output <format>", "text or json", "text")
    .option("--only <ids>", "Comma-separated rule ids")
    .option("--split <name>", "dev, holdout or all", "all")
    .option("--include-weak", "Include manifest-weak labels")
    .option("--dry-run", "Plan without calling Jev")
    .option("--no-cache", "Ignore cached answers")
    .option("--results-dir <path>", "Where logs and cache live")
    .option("--model <id>", "Jev model id", DEFAULT_MODEL)
    .action(async (options) => {
      if (!["text", "json"].includes(options.output)) {
        throw new Error("--output must be text or json");
      }
      if (!["dev", "holdout", "all"].includes(options.split)) {
        throw new Error("--split must be dev, holdout or all");
      }
      const result = await runEval({
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
    .option("--output <format>", "text or json", "text")
    .action((options) => {
      if (!["text", "json"].includes(options.output)) {
        throw new Error("--output must be text or json");
      }
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
}
