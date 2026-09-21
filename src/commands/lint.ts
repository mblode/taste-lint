import fs from "node:fs";
import path from "node:path";

import { Option } from "commander";
import type { Command } from "commander";

import { SUPPORTED_GLOBS } from "../extract/index.js";
import { extractCapture, runStyleCapture } from "../extract/rendered.js";
import { loadConfig } from "../lib/config.js";
import { InputError } from "../lib/errors.js";
import { collectFiles } from "../lib/glob.js";
import { defaultResultsDir, runLint } from "../lint.js";
import { DEFAULT_MODEL } from "../map/jev.js";
import { renderJson } from "../report/json.js";
import { renderSarif } from "../report/sarif.js";
import { renderTty } from "../report/tty.js";
import { PROFILE_NAMES } from "../scan/profiles.js";
import type { ProfileName } from "../scan/profiles.js";
import { makeSamples } from "../scan/samples.js";
import { writeJson } from "../scan/storage.js";
import { SEVERITIES } from "../types.js";
import type { Severity } from "../types.js";

const quote = (value: string) => `'${value.replaceAll("'", "'\"'\"'")}'`;

export function registerLintCommand(program: Command): void {
  program
    .command("lint")
    .description("Lint files (or a rendered page) against the taste rules")
    .argument("[paths...]", "Files or directories to lint, relative to --root")
    .option("--root <path>", "Project root for globs and config", process.cwd())
    .option("--only <ids>", "Comma-separated rule ids")
    .option(
      "--exclude <globs>",
      "Comma-separated globs to skip (added to taste-lint.config.json exclude)"
    )
    .option("--dry-run", "Plan and estimate cost without calling Jev")
    .option(
      "--print-requests",
      "With --dry-run and --output tty, print request JSONL to stderr"
    )
    .addOption(
      new Option(
        "--profile <name>",
        "Scope: product (tsx, jsx, css), writing (md, mdx), instructions (AGENTS.md, skills, plans) or all"
      ).choices(PROFILE_NAMES)
    )
    .option(
      "--since <ref>",
      "Report only findings on lines changed since this Git revision"
    )
    .option(
      "--samples <file>",
      "Write blind labelling samples for the Jev rules that ran, without their predicted scores"
    )
    .option(
      "--no-cache",
      "Ignore cached answers (new answers are still recorded)"
    )
    .addOption(
      new Option("--fail-on <severity>", "Lowest severity that fails the run")
        .choices(SEVERITIES)
        .default("minor")
    )
    .option("--fix", "Apply deterministic fixes for act-band findings")
    .addOption(
      new Option("--output <format>", "Output format")
        .choices(["tty", "json", "sarif"])
        .default("tty")
    )
    .option(
      "--results-dir <path>",
      "Where logs and cache live",
      defaultResultsDir()
    )
    .option("--model <id>", "Jev model id", DEFAULT_MODEL)
    .option("--progress", "Print periodic progress on stderr even when piped")
    .option("--verbose", "Show suppressed findings and unknowns")
    .option("--url <url>", "Lint a rendered page through style-capture")
    .option("--selector <css>", "Root selector for --url", "body")
    .action(
      async (
        paths: string[],
        options: {
          profile?: ProfileName;
          since?: string;
          samples?: string;
          root: string;
          only?: string;
          exclude?: string;
          dryRun?: boolean;
          printRequests?: boolean;
          cache: boolean;
          failOn: string;
          fix?: boolean;
          output: string;
          resultsDir: string;
          model: string;
          verbose?: boolean;
          progress?: boolean;
          url?: string;
          selector: string;
        }
      ) => {
        const targets = paths.length === 0 && options.profile ? ["."] : paths;
        if (targets.length === 0 && !options.url) {
          throw new InputError(
            "INVALID_ARGUMENT",
            "Pass at least one path, --profile or --url"
          );
        }
        if (
          options.printRequests &&
          (!options.dryRun || options.output !== "tty")
        ) {
          throw new InputError(
            "INVALID_ARGUMENT",
            "--print-requests requires --dry-run and --output tty; request JSONL is written to stderr."
          );
        }
        if (options.progress || process.stderr.isTTY) {
          process.stderr.write("Scanning requested paths...\n");
        }
        const config = { root: path.resolve(options.root) };
        // Rendered capture is the only path with remote work before runLint.
        if (options.url) {
          const resolved = loadConfig(config.root);
          collectFiles(resolved.root, targets, SUPPORTED_GLOBS, [
            ...resolved.exclude,
            ...(options.exclude
              ?.split(",")
              .map((s) => s.trim())
              .filter(Boolean) ?? []),
          ]);
        }
        const extraUnits = options.url
          ? extractCapture(
              await runStyleCapture(options.url, options.selector),
              options.url
            )
          : undefined;
        let lastProgress = 0;
        let samples: ReturnType<typeof makeSamples> = [];
        const result = await runLint(
          {
            dryRun: options.dryRun,
            exclude: options.exclude
              ?.split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            extraUnits,
            failOn: options.failOn as Severity,
            fix: options.fix,
            model: options.model,
            noCache: !options.cache,
            only: options.only
              ?.split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            printRequests: options.printRequests,
            profile: options.profile,
            resultsDir: options.resultsDir,
            root: options.root,
            since: options.since,
            targets,
          },
          {
            onEvidence: options.samples
              ? (units, answers, negatives, rules) => {
                  samples = makeSamples(
                    units,
                    rules,
                    answers,
                    negatives,
                    3,
                    path.basename(config.root)
                  );
                }
              : undefined,
            onProgress: (progress) => {
              if (!(options.progress || process.stderr.isTTY)) {
                return;
              }
              const now = Date.now();
              if (
                lastProgress &&
                now - lastProgress < 2000 &&
                progress.phase !== "complete"
              ) {
                return;
              }
              lastProgress = now;
              process.stderr.write(
                `${progress.phase}: ${progress.completed}/${progress.planned} requests, ${progress.attempts} HTTP attempts, ${progress.cachedAnswers} cached answers, ${progress.failed} failed, ${(progress.elapsedMs / 1000).toFixed(1)}s\n`
              );
            },
            stdout: (text) => process.stderr.write(text),
          }
        );
        const reportPath =
          result.status === "dry-run"
            ? undefined
            : path.resolve(
                options.resultsDir,
                `lint-${new Date().toISOString().replaceAll(":", "-")}.json`
              );
        const retryArgs = [
          // Context is explicit and must survive retry, never inferred from home.
          process.execPath,
          path.resolve(process.argv[1]),
          "lint",
          "--root",
          config.root,
          "--results-dir",
          path.resolve(options.resultsDir),
          "--model",
          options.model,
          "--fail-on",
          options.failOn,
          "--output",
          options.output,
        ];
        if (options.only) {
          retryArgs.push("--only", options.only);
        }
        if (options.exclude) {
          retryArgs.push("--exclude", options.exclude);
        }
        if (options.url) {
          retryArgs.push("--url", options.url, "--selector", options.selector);
        }
        if (options.profile) {
          retryArgs.push("--profile", options.profile);
        }
        if (options.since) {
          retryArgs.push("--since", options.since);
        }
        retryArgs.push("--", ...targets);
        const rerun =
          result.status === "incomplete"
            ? retryArgs.map(quote).join(" ")
            : undefined;
        if (options.samples) {
          writeJson(options.samples, {
            instructions:
              "Blind review: set label true for a violation, false for acceptable, or leave null when uncertain. No predicted probabilities are included.",
            samples,
            version: 2,
          });
        }
        const reported = { ...result, reportPath, rerun };
        const json = renderJson(reported, result.manifest);
        if (reportPath) {
          fs.mkdirSync(options.resultsDir, { recursive: true });
          fs.writeFileSync(reportPath, json);
        }
        if (options.output === "json") {
          process.stdout.write(json);
        } else if (options.output === "sarif") {
          process.stdout.write(
            renderSarif(
              reported,
              result.rulesLoaded,
              program.version() ?? "0.0.0"
            )
          );
        } else {
          process.stdout.write(
            renderTty(reported, { verbose: options.verbose })
          );
        }
        process.exitCode = result.exitCode;
      }
    );
}
