import type { Command } from "commander";

import { extractFile, SUPPORTED_GLOBS } from "../extract/index.js";
import { loadConfig } from "../lib/config.js";
import { collectFiles } from "../lib/glob.js";

export function registerExtractCommand(program: Command): void {
  program
    .command("extract")
    .description("Print the units taste-lint would lint, as JSONL")
    .argument("<paths...>", "Files or directories, relative to --root")
    .option("--root <path>", "Project root", process.cwd())
    .option("--kind <kinds>", "Comma-separated unit kinds to keep")
    .action((paths: string[], options: { root: string; kind?: string }) => {
      const config = loadConfig(options.root);
      const kinds = options.kind?.split(",").map((s) => s.trim());
      const files = collectFiles(
        config.root,
        paths,
        SUPPORTED_GLOBS,
        config.exclude
      );
      let count = 0;
      for (const file of files) {
        for (const unit of extractFile(config, file)) {
          if (kinds && !kinds.includes(unit.kind)) {
            continue;
          }
          count += 1;
          process.stdout.write(`${JSON.stringify(unit)}\n`);
        }
      }
      process.stderr.write(`${count} units from ${files.length} files\n`);
    });
}
