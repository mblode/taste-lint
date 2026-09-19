import type { Command } from "commander";

import { runEval } from "../eval/metrics.js";
import { DEFAULT_MODEL } from "../map/jev.js";

export function registerEvalCommand(program: Command): void {
  program
    .command("eval")
    .description(
      "Run every rule over its labelled corpus and report precision, recall and calibration"
    )
    .option(
      "--corpus <path>",
      "Corpus directory (default: packaged data/corpus)"
    )
    .option("--rules <path>", "Rules directory")
    .option("--only <ids>", "Comma-separated rule ids")
    .option("--split <name>", "dev, holdout or all", "all")
    .option("--include-weak", "Include manifest-weak labels")
    .option("--dry-run", "Plan without calling Jev")
    .option("--no-cache", "Ignore cached answers")
    .option("--results-dir <path>", "Where logs and cache live")
    .option("--model <id>", "Jev model id", DEFAULT_MODEL)
    .action(async (options) => {
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
      process.stdout.write(result.report);
      process.exitCode = result.exitCode;
    });
}
