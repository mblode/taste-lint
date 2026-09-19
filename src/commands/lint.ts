import fs from "node:fs";
import path from "node:path";

import type { Command } from "commander";

import { extractCapture, runStyleCapture } from "../extract/rendered.js";
import { parseCaptureInput } from "../extract/style-capture-text.js";
import { defaultResultsDir, runLint } from "../lint.js";
import { DEFAULT_MODEL } from "../map/jev.js";
import { renderJson } from "../report/json.js";
import { renderSarif } from "../report/sarif.js";
import { renderTty } from "../report/tty.js";
import type { Severity } from "../types.js";

export function registerLintCommand(program: Command): void {
  program
    .command("lint")
    .description("Lint files (or a rendered page) against the taste rules")
    .argument("[paths...]", "Files or directories to lint, relative to --root")
    .option("--root <path>", "Project root for globs and config", process.cwd())
    .option("--rules <path>", "Rules directory (default: packaged data/rules)")
    .option("--only <ids>", "Comma-separated rule ids")
    .option(
      "--exclude <globs>",
      "Comma-separated globs to skip (added to slop-cop.config.json exclude)"
    )
    .option("--dry-run", "Plan and estimate cost without calling Jev")
    .option(
      "--print-requests",
      "With --dry-run, print request payloads as JSONL"
    )
    .option("--mechanical-only", "Skip every Jev-backed rule")
    .option(
      "--no-cache",
      "Ignore cached answers (new answers are still recorded)"
    )
    .option("--limit-units <n>", "Only consider the first n units")
    .option(
      "--fail-on <severity>",
      "Lowest severity that fails the run: critical, major or minor",
      "minor"
    )
    .option("--fix", "Apply deterministic fixes for act-band findings")
    .option("--output <format>", "tty, json or sarif", "tty")
    .option(
      "--results-dir <path>",
      "Where logs and cache live",
      defaultResultsDir()
    )
    .option("--model <id>", "Jev model id", DEFAULT_MODEL)
    .option("--verbose", "Show suppressed findings and unknowns")
    .option("--url <url>", "Lint a rendered page through style-capture")
    .option("--selector <css>", "Root selector for --url", "body")
    .option("--capture <file>", "Lint a saved style-capture CaptureResult JSON")
    .action(
      async (
        paths: string[],
        options: {
          root: string;
          rules?: string;
          only?: string;
          exclude?: string;
          dryRun?: boolean;
          printRequests?: boolean;
          mechanicalOnly?: boolean;
          cache: boolean;
          limitUnits?: string;
          failOn: string;
          fix?: boolean;
          output: string;
          resultsDir: string;
          model: string;
          verbose?: boolean;
          url?: string;
          selector: string;
          capture?: string;
        }
      ) => {
        if (!["critical", "major", "minor"].includes(options.failOn)) {
          throw new Error("--fail-on must be critical, major or minor");
        }
        if (!["tty", "json", "sarif"].includes(options.output)) {
          throw new Error("--output must be tty, json or sarif");
        }
        if (paths.length === 0 && !options.url && !options.capture) {
          throw new Error("Pass at least one path, --url or --capture");
        }
        const limitUnits =
          options.limitUnits === undefined
            ? undefined
            : Number(options.limitUnits);
        if (
          limitUnits !== undefined &&
          (!Number.isInteger(limitUnits) || limitUnits < 0)
        ) {
          throw new Error("--limit-units must be a non-negative integer");
        }
        let extraUnits;
        if (options.capture) {
          extraUnits = extractCapture(
            parseCaptureInput(fs.readFileSync(options.capture, "utf-8")),
            options.capture
          );
        } else if (options.url) {
          extraUnits = extractCapture(
            await runStyleCapture(options.url, options.selector),
            options.url
          );
        }
        const result = await runLint({
          dryRun: options.dryRun,
          exclude: options.exclude
            ?.split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          extraUnits,
          failOn: options.failOn as Severity,
          fix: options.fix,
          limitUnits,
          mechanicalOnly: options.mechanicalOnly,
          model: options.model,
          noCache: !options.cache,
          only: options.only
            ?.split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          printRequests: options.printRequests,
          resultsDir: options.resultsDir,
          root: options.root,
          rulesDir: options.rules,
          targets: paths,
        });
        const json = renderJson(result, result.manifest);
        if (result.status !== "dry-run") {
          fs.mkdirSync(options.resultsDir, { recursive: true });
          fs.writeFileSync(
            path.join(
              options.resultsDir,
              `lint-${new Date().toISOString().replaceAll(":", "-")}.json`
            ),
            json
          );
        }
        if (options.output === "json") {
          process.stdout.write(json);
        } else if (options.output === "sarif") {
          process.stdout.write(
            renderSarif(
              result,
              result.rulesLoaded,
              program.version() ?? "0.0.0"
            )
          );
        } else {
          process.stdout.write(renderTty(result, { verbose: options.verbose }));
        }
        process.exitCode = result.exitCode;
      }
    );
}
