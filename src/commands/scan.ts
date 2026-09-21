import fs from "node:fs";
import path from "node:path";

import { Option } from "commander";
import type { Command } from "commander";

import pkg from "../../packages/cli/package.json" with { type: "json" };
import { InputError } from "../lib/errors.js";
import { renderSarif } from "../report/sarif.js";
import { PROFILE_NAMES, profileFor } from "../scan/profiles.js";
import { readReport, readDecisions, renderScan } from "../scan/report.js";
import { runScan } from "../scan/run.js";
import type { ScanOptions } from "../scan/run.js";
import { labelsToCorpus } from "../scan/samples.js";
import { writeJson } from "../scan/storage.js";
import { registerScanReportCommands } from "./scan-reports.js";

export const registerScanCommand = (program: Command): void => {
  const scan = program
    .command("scan")
    .enablePositionalOptions()
    .description(
      "Run a scoped scan with stable findings, baselines, and review exports"
    )
    .argument("[paths...]", "Targets within the root; defaults to .")
    .option("--root <path>", "Repository root", process.cwd())
    .addOption(
      new Option("--profile <name>", "Scan objective")
        .choices(PROFILE_NAMES)
        .default("product")
    )
    .option("--rules <path>", "Rules directory")
    .option(
      "--audit <file>",
      "Audit a page from its brief, browser artifacts and attributed observations"
    )
    .option(
      "--only <ids>",
      "Comma-separated rule IDs within the selected profile"
    )
    .option("--exclude <globs>", "Additional comma-separated exclusions")
    .option("--dry-run", "Preview scope and cost without provider calls")
    .option("--model <id>", "Evaluation model", "jev-latest")
    .option(
      "--results-dir <path>",
      "Answer cache and sanitized request records"
    )
    .option("--baseline <file>", "Compare a compatible completed scan")
    .option(
      "--new-only",
      "Report and gate only new findings against the baseline"
    )
    .option(
      "--since <ref>",
      "Report changed lines against a Git commit; retain analysis context"
    )
    .option(
      "--decisions <file>",
      "Apply accepted or dismissed review decisions"
    )
    .option(
      "--dependency-cruiser <file>",
      "Import dependency-cruiser JSON violations"
    )
    .option(
      "--samples <file>",
      "Export blind labeling samples, including source text, without predicted scores"
    )
    .option(
      "--save <file>",
      "Save a scan report; only completed scans can serve as baselines"
    )
    .addOption(
      new Option("--output <format>", "Output format")
        .choices(["tty", "json", "sarif"])
        .default("tty")
    )
    .option("--progress", "Print provider progress to stderr")
    .action(
      async (
        targets: string[],
        options: Omit<ScanOptions, "only" | "exclude" | "samples"> & {
          rules?: string;
          only?: string;
          exclude?: string;
          samples?: string;
          save?: string;
          output: string;
          progress?: boolean;
        }
      ) => {
        if (
          options.save &&
          options.baseline &&
          path.resolve(options.save) === path.resolve(options.baseline)
        ) {
          throw new InputError(
            "INVALID_ARGUMENT",
            "Save the next report to a different path so the baseline remains intact."
          );
        }
        let last = 0;
        const { report, rules, samples } = await runScan(
          {
            ...options,
            exclude: options.exclude?.split(",").filter(Boolean),
            only: options.only?.split(",").filter(Boolean),
            rulesDir: options.rules,
            samples: !!options.samples,
            targets: targets.length ? targets : ["."],
          },
          {
            onProgress: (p) => {
              if (
                options.progress &&
                (Date.now() - last > 2000 || p.phase === "complete")
              ) {
                last = Date.now();
                process.stderr.write(
                  `${p.phase}: ${p.completed}/${p.planned} requests, ${p.failed} failed\n`
                );
              }
            },
          }
        );
        if (options.save) {
          writeJson(options.save, report);
        }
        if (options.samples) {
          writeJson(options.samples, {
            instructions:
              "Blind review: set label true for a violation, false for acceptable, or leave null when uncertain. No predicted probabilities are included. Split is grouped by source file.",
            samples,
            version: 2,
          });
        }
        const visible = new Set(report.reporting.visible);
        const findings = report.findings.filter((f) =>
          visible.has(f.fingerprint)
        );
        const output =
          options.output === "json"
            ? `${JSON.stringify(report, null, 2)}\n`
            : options.output === "sarif"
              ? renderSarif(
                  { findings, ruleFindings: findings },
                  rules,
                  pkg.version
                )
              : renderScan(report);
        process.stdout.write(output);
        process.exitCode = report.exitCode;
      }
    );
  scan
    .command("profiles")
    .description("Describe scan objectives, selection, and advisory rules")
    .action(() => {
      process.stdout.write(
        `${JSON.stringify(PROFILE_NAMES.map(profileFor), null, 2)}\n`
      );
    });
  scan
    .command("review <report> <fingerprint>")
    .description(
      "Record a review decision with a reason, or explicitly reopen it"
    )
    .requiredOption("--decisions <file>", "Review decisions JSON")
    .addOption(
      new Option("--status <status>", "Review status")
        .choices(["accepted", "dismissed", "open"])
        .makeOptionMandatory()
    )
    .option("--reason <text>", "Reason for accepting or dismissing")
    .action(
      (
        file: string,
        fingerprint: string,
        options: { decisions: string; status: string; reason?: string }
      ) => {
        const report = readReport(file);
        if (!report.findings.some((f) => f.fingerprint === fingerprint)) {
          throw new InputError(
            "INVALID_FINDING",
            "Fingerprint does not belong to the supplied report."
          );
        }
        if (options.status !== "open" && !options.reason?.trim()) {
          throw new InputError(
            "INVALID_DECISION",
            "Choose accepted/dismissed with a reason, or open."
          );
        }
        const decisions = fs.existsSync(options.decisions)
          ? readDecisions(options.decisions, report.signature)
          : {};
        decisions[fingerprint] =
          options.status === "open"
            ? { reason: "Reopened by reviewer", status: "open" }
            : {
                reason: options.reason!,
                status: options.status as "accepted" | "dismissed",
              };
        writeJson(options.decisions, {
          decisions,
          signature: report.signature,
          version: 1,
        });
        process.stdout.write(`Review decision saved: ${options.status}\n`);
      }
    );
  registerScanReportCommands(scan);
  scan
    .command("labels <samples>")
    .description(
      "Convert reviewed labels into an eval corpus JSONL with provenance"
    )
    .requiredOption("--out <file>", "New corpus JSONL file")
    .option("--rules <path>", "Rules directory used to validate labels")
    .action((file: string, options: { out: string; rules?: string }) => {
      process.stdout.write(
        `Exported ${labelsToCorpus(file, options.out, options.rules)} labels.\n`
      );
    });
};
