import fs from "node:fs";
import path from "node:path";

import { afterEach, expect, it } from "vitest";

import { loadConfig } from "../lib/config.js";
import { runLint } from "../lint.js";
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
