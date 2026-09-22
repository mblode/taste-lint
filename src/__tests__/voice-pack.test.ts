import fs from "node:fs";
import path from "node:path";

import { afterEach, expect, it } from "vitest";

import { loadConfig } from "../lib/config.js";
import type { InputError } from "../lib/errors.js";
import { runLint } from "../lint.js";
import { loadRules, resolveRulesDir } from "../rules/load.js";
import { FIXTURES, temporary } from "./helpers.js";

// Copies the fixture pack to stand in for $GHOSTWRITER_HOME/taste-lint.
const pack = (): string => {
  const home = temporary();
  fs.cpSync(path.join(FIXTURES, "voice-pack"), path.join(home, "taste-lint"), {
    recursive: true,
  });
  return home;
};

const saved = process.env.GHOSTWRITER_HOME;
afterEach(() => {
  process.env.GHOSTWRITER_HOME = saved;
});

it("loads a voice pack from $GHOSTWRITER_HOME and scopes it by glob", async () => {
  process.env.GHOSTWRITER_HOME = pack();
  const root = temporary();
  fs.writeFileSync(
    path.join(root, "taste-lint.config.json"),
    JSON.stringify({ rules: ["$GHOSTWRITER_HOME/taste-lint"] })
  );
  fs.writeFileSync(
    path.join(root, "hello.email.md"),
    "Pick one.\n\nBest,\nMatthew\n"
  );
  fs.writeFileSync(
    path.join(root, "notes.md"),
    "Pick one.\n\nBest,\nMatthew\n"
  );
  const run = await runLint(
    {
      dryRun: true,
      only: ["copywriting-voice-email-stock-lines"],
      resultsDir: temporary(),
      root,
    },
    { stderr: () => {}, stdout: () => {} }
  );
  expect(run.findings.map((f) => f.file)).toEqual(["hello.email.md"]);
  expect(run.exitCode).toBe(1);
});

it("names the missing variable when a voice pack path cannot expand", () => {
  delete process.env.GHOSTWRITER_HOME;
  const root = temporary();
  fs.writeFileSync(
    path.join(root, "taste-lint.config.json"),
    JSON.stringify({ rules: ["$GHOSTWRITER_HOME/taste-lint"] })
  );
  expect(() => loadConfig(root)).toThrow(/GHOSTWRITER_HOME/);
});

const packWith = (files: Record<string, string>): string => {
  const dir = temporary();
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), text);
  }
  return dir;
};
const loadError = (dir: string): InputError => {
  try {
    loadRules(resolveRulesDir(), { extraDirs: [dir] });
  } catch (error) {
    return error as InputError;
  }
  throw new Error("expected loadRules to throw");
};

it("reports a malformed pack rule as the author's input, naming the file", () => {
  const error = loadError(
    packWith({ "copywriting/copywriting-x.yaml": "id: copywriting-x\n" })
  );
  expect(error.code).toBe("INVALID_RULE");
  expect(String(error.details.file)).toMatch(/copywriting-x\.yaml$/u);
});

it("names both files when a pack reuses a packaged rule id", () => {
  const packaged = path.join(
    resolveRulesDir(),
    "copywriting/copywriting-tee-up.yaml"
  );
  const error = loadError(
    packWith({
      "copywriting/copywriting-tee-up.yaml": fs.readFileSync(packaged, "utf-8"),
    })
  );
  expect(error.code).toBe("DUPLICATE_RULE");
  expect(error.message).toContain(packaged);
  expect(error.details.files).toHaveLength(2);
});

it("rejects a pack with no rules in domain folders instead of passing silently", () => {
  const rule = fs.readFileSync(
    path.join(
      FIXTURES,
      "voice-pack/copywriting/copywriting-voice-email-stock-lines.yaml"
    ),
    "utf-8"
  );
  const error = loadError(
    packWith({ "copywriting-voice-email-stock-lines.yaml": rule })
  );
  expect(error.code).toBe("INVALID_CONFIG");
  expect(error.message).toContain("copywriting/");
});
