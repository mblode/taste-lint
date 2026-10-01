import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { afterEach, expect, it } from "vitest";

import { runLint } from "../lint.js";
import { FIXTURES, temporary } from "./helpers.js";

const roots: string[] = [];
const QUOTED = 'A "quoted" word.\n';
const CLEAN = "A plain word.\n";

const repository = () => {
  const root = temporary();
  roots.push(root);
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", root, ...args], { stdio: "ignore" });
  git("init", "--quiet");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  const write = (file: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  };
  const lint = (options: Parameters<typeof runLint>[0] = {}) =>
    runLint({
      dryRun: true,
      resultsDir: path.join(root, "results"),
      root,
      rulesDir: path.join(FIXTURES, "rules"),
      ...options,
    });
  return { git, lint, root, write };
};
const quotes = (result: Awaited<ReturnType<typeof runLint>>) =>
  result.ruleFindings.filter((f) => f.ruleId === "typography-straight-quotes");

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

it("lints the staged blob, not the working tree", async () => {
  const { git, lint, write } = repository();
  write("note.md", QUOTED);
  git("add", "note.md");
  write("note.md", CLEAN);
  const staged = await lint({ staged: true });
  expect(quotes(staged)).toHaveLength(1);
  expect(staged.exitCode).toBe(1);

  write("note.md", CLEAN);
  git("add", "note.md");
  write("note.md", QUOTED);
  const clean = await lint({ staged: true });
  expect(quotes(clean)).toHaveLength(0);
  expect(clean.exitCode).toBe(0);
});

it("reads every staged path when files share one blob", async () => {
  const { git, lint, write } = repository();
  write("a.md", QUOTED);
  write("docs/b.md", QUOTED);
  git("add", "a.md", "docs/b.md");
  const result = await lint({ staged: true });
  expect(quotes(result).map((f) => f.file)).toEqual(["a.md", "docs/b.md"]);
});

it("passes when nothing staged is in scope", async () => {
  const { git, lint, write } = repository();
  const nothing = await lint({ staged: true });
  expect(nothing.exitCode).toBe(0);
  write("notes.txt", "Not a supported file.");
  write("taste-lint.config.json", '{ "exclude": ["drafts/**"] }');
  write("drafts/idea.md", QUOTED);
  git("add", "notes.txt", "drafts/idea.md");
  const result = await lint({ staged: true });
  expect(result.scope.files).toBe(0);
  expect(result.exitCode).toBe(0);
  expect(result.status).toBe("dry-run");
});

it("reports only staged changed lines with --since", async () => {
  const { git, lint, write } = repository();
  write("note.md", `${QUOTED}\n${CLEAN}`);
  git("add", "note.md");
  git("commit", "--quiet", "-m", "base");
  write("note.md", `${QUOTED}\n${QUOTED}`);
  git("add", "note.md");
  const result = await lint({ since: "HEAD", staged: true });
  expect(quotes(result).map((f) => f.line)).toEqual([3]);
});

it("rejects paths and --fix with --staged", async () => {
  const { lint } = repository();
  await expect(lint({ staged: true, targets: ["."] })).rejects.toThrow(
    /drop the paths/
  );
  await expect(lint({ fix: true, staged: true })).rejects.toThrow(
    /working tree/
  );
});

it("fails an empty selection unless unmatched patterns are allowed", async () => {
  const { lint, write } = repository();
  write("taste-lint.config.json", '{ "exclude": ["drafts/**"] }');
  write("drafts/idea.md", QUOTED);
  write("notes.txt", "Not a supported file.");
  const strict = await lint({ targets: ["drafts/idea.md"] });
  expect(strict.exitCode).toBe(2);
  await expect(lint({ targets: ["notes.txt"] })).rejects.toThrow(
    /Unsupported target/
  );
  await expect(lint({ targets: ["gone.md"] })).rejects.toThrow(/Cannot read/);

  const lenient = await lint({
    errorOnUnmatchedPattern: false,
    targets: ["drafts/idea.md", "notes.txt", "gone.md"],
  });
  expect(lenient.exitCode).toBe(0);
  expect(lenient.scope.files).toBe(0);

  write("note.md", QUOTED);
  const mixed = await lint({
    errorOnUnmatchedPattern: false,
    targets: ["notes.txt", "note.md"],
  });
  expect(quotes(mixed)).toHaveLength(1);
  expect(mixed.exitCode).toBe(1);
});
