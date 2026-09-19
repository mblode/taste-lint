import type { Command } from "commander";

import { runTune, runTuneAb } from "../eval/tune.js";

export function registerTuneCommand(program: Command): void {
  const tune = program
    .command("tune")
    .description(
      "Pick act thresholds per rule from the dev split; --write updates data/rules/tuning.json"
    )
    .option("--corpus <path>", "Corpus directory")
    .option("--rules <path>", "Rules directory")
    .option("--only <ids>", "Comma-separated rule ids")
    .option("--floor <p>", "Required lower bound on act-band precision", "0.8")
    .option("--write", "Write tuning.json")
    .option("--results-dir <path>", "Where logs and cache live")
    .option("--model <id>", "Jev model id", "jev-latest")
    .action(async (options) => {
      const result = await runTune({
        corpusDir: options.corpus,
        floor: Number(options.floor),
        model: options.model,
        only: options.only
          ?.split(",")
          .map((s: string) => s.trim())
          .filter(Boolean),
        resultsDir: options.resultsDir,
        rulesDir: options.rules,
        write: options.write,
      });
      process.stdout.write(result.report);
      process.exitCode = result.exitCode;
    });
  tune
    .command("ab")
    .description(
      "Compare two question wordings for one rule over the dev split (McNemar)"
    )
    .requiredOption("--rule <id>", "Rule id")
    .requiredOption("--variant <file>", "YAML file with a replacement question")
    .option("--corpus <path>", "Corpus directory")
    .option("--rules <path>", "Rules directory")
    .option("--results-dir <path>", "Where logs and cache live")
    .option("--model <id>", "Jev model id", "jev-latest")
    .action(async (options) => {
      const result = await runTuneAb({
        corpusDir: options.corpus,
        model: options.model,
        resultsDir: options.resultsDir,
        ruleId: options.rule,
        rulesDir: options.rules,
        variantFile: options.variant,
      });
      process.stdout.write(result.report);
      process.exitCode = result.exitCode;
    });
}
