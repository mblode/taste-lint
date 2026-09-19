import { Command } from "commander";

import pkg from "../package.json" with { type: "json" };
import { registerEvalCommand } from "./commands/eval.js";
import { registerExtractCommand } from "./commands/extract.js";
import { registerLintCommand } from "./commands/lint.js";
import { registerRulesCommand } from "./commands/rules.js";
import { registerTuneCommand } from "./commands/tune.js";

const program = new Command();

program
  .name("slop-cop")
  .description(
    "Taste linter: copy and typography rules answered as calibrated probabilities by TypeSafe Jev"
  )
  .version(pkg.version);

registerLintCommand(program);
registerExtractCommand(program);
registerRulesCommand(program);
registerEvalCommand(program);
registerTuneCommand(program);

try {
  await program.parseAsync();
} catch (error) {
  process.stderr.write(`${(error as Error).message}\n`);
  process.exitCode = 1;
}
