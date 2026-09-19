import { Command } from "commander";

import pkg from "../package.json" with { type: "json" };
import { registerEvalCommand } from "./commands/eval.js";
import { registerExtractCommand } from "./commands/extract.js";
import { registerLintCommand } from "./commands/lint.js";
import { registerRulesCommand } from "./commands/rules.js";
import { registerTuneCommand } from "./commands/tune.js";
import { ProviderError } from "./map/jev.js";

const program = new Command();

program
  .name("taste-lint")
  .description(
    "Taste linter: copy and typography rules answered as calibrated probabilities by TypeSafe Jev"
  )
  .version(pkg.version);

registerLintCommand(program);
registerExtractCommand(program);
registerRulesCommand(program);
registerEvalCommand(program);
registerTuneCommand(program);

// The command surface as JSON, so an agent discovers flags, defaults and
// subcommands without scraping --help.
const describe = (cmd: Command): Record<string, unknown> => ({
  command: cmd.name(),
  description: cmd.description(),
  options: cmd.options.map((opt) => ({
    default: opt.defaultValue,
    description: opt.description,
    flag: opt.long,
  })),
  ...(cmd.commands.length > 0 ? { commands: cmd.commands.map(describe) } : {}),
});
program
  .command("schema")
  .description("Print the command surface as JSON")
  .action(() => {
    process.stdout.write(`${JSON.stringify(program.commands.map(describe))}\n`);
  });

// Data goes to stdout, so with --output json an error is a JSON envelope
// there too; otherwise the message goes to stderr for a person.
const jsonOutput =
  process.argv[process.argv.indexOf("--output") + 1] === "json";
try {
  await program.parseAsync();
} catch (error) {
  const message = (error as Error).message;
  if (jsonOutput) {
    process.stdout.write(
      `${JSON.stringify({
        code: error instanceof ProviderError ? error.category : "UNEXPECTED",
        details: {},
        error: true,
        message,
      })}\n`
    );
  } else {
    process.stderr.write(`${message}\n`);
  }
  process.exitCode = 1;
}
