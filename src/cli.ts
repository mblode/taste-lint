import { Command, CommanderError } from "commander";

import pkg from "../packages/cli/package.json" with { type: "json" };
import { registerEvalCommand } from "./commands/eval.js";
import { registerExtractCommand } from "./commands/extract.js";
import { registerInitCommand } from "./commands/init.js";
import { registerLintCommand } from "./commands/lint.js";
import { registerRulesCommand } from "./commands/rules.js";
import { registerScanCommand } from "./commands/scan.js";
import { registerTuneCommand } from "./commands/tune.js";
import { InputError } from "./lib/errors.js";
import { ProviderError } from "./map/jev.js";

// Configure before registering subcommands: Commander copies the exit hook
// when a child is created, so setting it after registration misses parse errors.
const jsonOutput =
  process.argv.includes("--output=json") ||
  process.argv[process.argv.indexOf("--output") + 1] === "json";
const program = new Command();
program.exitOverride();
program.enablePositionalOptions();
program.configureOutput({
  writeErr: (text) => {
    if (!jsonOutput) {
      process.stderr.write(text);
    }
  },
});

program
  .name("taste-lint")
  .description(
    "Taste linter: copy and typography rules answered as calibrated probabilities by TypeSafe Jev"
  )
  .version(pkg.version)
  .addHelpText(
    "after",
    `
Quickstart:
  export AI_GATEWAY_API_KEY="your-vercel-ai-gateway-key"
  taste-lint scan .

Preview: taste-lint scan . --dry-run
Get a key: https://vercel.com/docs/ai-gateway/authentication-and-byok/api-keys
Docs: https://blode.co/taste-lint/docs
`
  );

registerLintCommand(program);
registerInitCommand(program);
registerScanCommand(program);
registerExtractCommand(program);
registerRulesCommand(program);
registerEvalCommand(program);
registerTuneCommand(program);

// The command surface as JSON, so an agent discovers flags, defaults and
// subcommands without scraping --help.
const describe = (cmd: Command): Record<string, unknown> => ({
  arguments: cmd.registeredArguments.map((arg) => ({
    default: arg.defaultValue,
    description: arg.description,
    enum: arg.argChoices,
    name: arg.name(),
    required: arg.required,
    type: arg.variadic ? "string[]" : "string",
    variadic: arg.variadic,
  })),
  command: cmd.name(),
  description: cmd.description(),
  options: cmd.options.map((opt) => ({
    default: opt.defaultValue ?? (opt.negate ? true : undefined),
    description: opt.description,
    enum: opt.argChoices,
    flag: opt.long,
    flags: opt.flags,
    name: opt.attributeName(),
    negate: opt.negate,
    required: opt.mandatory,
    type:
      opt.isBoolean() || opt.negate
        ? "boolean"
        : opt.variadic
          ? "string[]"
          : "string",
    value: opt.required ? "required" : opt.optional ? "optional" : "none",
  })),
  ...(cmd.commands.length > 0 ? { commands: cmd.commands.map(describe) } : {}),
});
program
  .command("schema")
  .description("Print the command surface as JSON")
  .action(() => {
    process.stdout.write(`${JSON.stringify(program.commands.map(describe))}\n`);
  });

// Data and structured errors go to stdout; progress goes to stderr.
try {
  await program.parseAsync();
} catch (error) {
  if (error instanceof CommanderError && error.exitCode === 0) {
    process.exitCode = 0;
  } else {
    const message = (error as Error).message;
    if (jsonOutput) {
      process.stdout.write(
        `${JSON.stringify({
          code:
            error instanceof ProviderError
              ? error.category
              : error instanceof InputError
                ? error.code
                : error instanceof CommanderError
                  ? "INVALID_ARGUMENT"
                  : "UNEXPECTED",
          details: error instanceof InputError ? error.details : {},
          error: true,
          message,
        })}\n`
      );
    } else if (!(error instanceof CommanderError)) {
      process.stderr.write(`${message}\n`);
    }
    process.exitCode = 1;
  }
}
