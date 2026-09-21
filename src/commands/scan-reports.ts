import fs from "node:fs";
import path from "node:path";

import { Option } from "commander";
import type { Command } from "commander";

import { verifyAudit } from "../audit/verify.js";
import { InputError } from "../lib/errors.js";
import { resolveRulesDir } from "../rules/load.js";
import { remediationHandoff } from "../scan/handoff.js";
import { readReport } from "../scan/report.js";
import { writeJson } from "../scan/storage.js";

const outputFormat = (command: Command): string => {
  const output =
    command.opts<{ output?: string }>().output ??
    command.optsWithGlobals<{ output: string }>().output;
  if (!["tty", "json"].includes(output)) {
    throw new InputError(
      "INVALID_ARGUMENT",
      "--output must be tty or json for this command."
    );
  }
  return output;
};
const print = (format: string, data: unknown, message: string): void => {
  process.stdout.write(
    format === "json" ? `${JSON.stringify(data, null, 2)}\n` : message
  );
};

export const registerScanReportCommands = (scan: Command): void => {
  scan
    .command("guide")
    .description(
      "Print the agent workflow for a whole-page audit and verified repairs"
    )
    .addOption(
      new Option("--output <format>", "Output format").choices(["tty", "json"])
    )
    .action((_options, command: Command) => {
      const format = outputFormat(command);
      const guide = fs.readFileSync(
        path.join(resolveRulesDir(), "../audit/SKILL.md"),
        "utf-8"
      );
      print(format, { guide }, guide);
    });
  scan
    .command("verify <before>")
    .description(
      "Record repeated page checks against complete before and after audits"
    )
    .requiredOption("--after <file>", "After scan report")
    .requiredOption(
      "--evidence <file>",
      "Verification checks and artifact references"
    )
    .requiredOption("--out <file>", "Verified report destination")
    .addOption(
      new Option("--output <format>", "Output format").choices(["tty", "json"])
    )
    .action(
      (
        before: string,
        options: { after: string; evidence: string; out: string },
        command: Command
      ) => {
        const format = outputFormat(command);
        if (
          [before, options.after, options.evidence].some(
            (file) => path.resolve(file) === path.resolve(options.out)
          )
        ) {
          throw new InputError(
            "INVALID_ARGUMENT",
            "Write verification to a new report path."
          );
        }
        const report = verifyAudit(
          readReport(before),
          readReport(options.after),
          options.evidence
        );
        writeJson(options.out, report);
        const checks = report.audit!.verification!.checks;
        print(
          format,
          report,
          `Verification recorded: ${["passed", "failed", "unknown"].map((outcome) => `${checks.filter((check) => check.outcome === outcome).length} ${outcome}`).join(", ")}.\n`
        );
        process.exitCode = report.exitCode;
      }
    );
  scan
    .command("export <report>")
    .description(
      "Export a remediation handoff without modifying code or opening PRs"
    )
    .requiredOption("--out <file>", "Remediation JSON destination")
    .addOption(
      new Option("--output <format>", "Output format").choices(["tty", "json"])
    )
    .action((file: string, options: { out: string }, command: Command) => {
      const format = outputFormat(command);
      const handoff = remediationHandoff(readReport(file), file);
      writeJson(options.out, handoff);
      print(format, handoff, `Remediation handoff saved to ${options.out}\n`);
    });
};
