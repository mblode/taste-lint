import { Option } from "commander";
import type { Command } from "commander";

import { initProject, managers } from "../setup/init.js";
import type { InitOptions } from "../setup/init.js";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Install Taste Lint locally and add project check scripts")
    .option("--root <path>", "Project directory", process.cwd())
    .addOption(new Option("--pm <name>", "Package manager").choices(managers))
    .option("--dry-run", "Preview setup without installing or writing files")
    .option("--no-install", "Add scripts without installing the package")
    .option("--agent", "Append Taste Lint guidance to AGENTS.md")
    .action((options: InitOptions) => {
      const result = initProject(options);
      process.stdout.write(
        `${result.dryRun ? "Setup preview" : "Setup complete"}: ${result.packageManager}, ${result.profile} profile\n`
      );
      process.stdout.write(
        `Scripts added: ${result.scriptsAdded.join(", ") || "none (existing scripts preserved)"}\n`
      );
      if (result.installCommand) {
        process.stdout.write(`Install: ${result.installCommand.join(" ")}\n`);
      }
      if (result.agentAdded) {
        process.stdout.write("Agent instructions: AGENTS.md\n");
      }
      process.stdout.write(
        `\nSet AI_GATEWAY_API_KEY, then run ${result.packageManager} run taste.\n`
      );
      if (options.install === false) {
        process.stdout.write(
          "Installation skipped; the scripts require taste-lint to be installed.\n"
        );
      }
    });
}
