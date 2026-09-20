import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { afterEach, expect, it } from "vitest";

import { temporary } from "./helpers.js";

const cli = path.resolve(import.meta.dirname, "../../dist/cli.js");
const dirs: string[] = [];
const run = (...args: string[]) =>
  spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf-8",
    env: { ...process.env, AI_GATEWAY_API_KEY: "", TYPESAFE_API_KEY: "" },
  });
afterEach(() => {
  for (const dir of dirs.splice(0)) {
    fs.rmSync(dir, { force: true, recursive: true });
  }
});
it("returns JSON for parser and validation failures in either flag syntax", () => {
  for (const format of [["--output", "json"], ["--output=json"]]) {
    for (const tail of [["--wat"], ["--limit-units", "bad"]]) {
      const result = run("lint", ".", "--dry-run", ...format, ...tail);
      expect(result.status).toBe(1);
      expect(JSON.parse(result.stdout)).toMatchObject({
        code: "INVALID_ARGUMENT",
        error: true,
      });
      expect(result.stderr).toBe("");
    }
  }
});
it("keeps piped JSON clean and threshold policy consistent", () => {
  const root = temporary();
  dirs.push(root);
  fs.writeFileSync(path.join(root, "note.md"), 'A "quoted" word.');
  const args = [
    "lint",
    "--root",
    root,
    "note.md",
    "--mechanical-only",
    "--only",
    "typography-straight-quotes",
    "--results-dir",
    path.join(root, "results"),
  ];
  const result = run(...args, "--fail-on", "major", "--output=json");
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout).summary).toMatchObject({
    failOn: "major",
    failing: 0,
  });
  expect(result.stderr).toBe("");
  expect(result.stdout).not.toContain("\u001B");
  expect(run(...args, "--fail-on", "major").stdout).toContain("PASS");
  const failure = run(...args, "--fail-on", "minor");
  expect(failure.status).toBe(1);
  expect(failure.stdout).toContain("FAIL");
});
it("fails on missing targets and exposes help without credentials", () => {
  const missing = run(
    "lint",
    "never-a-real-target-982",
    "--dry-run",
    "--output=json"
  );
  expect(JSON.parse(missing.stdout).code).toBe("TARGET_NOT_FOUND");
  expect(missing.status).toBe(1);
  expect(run("--version").status).toBe(0);
  expect(run("lint", "--help").stdout).toContain("--progress");
});
