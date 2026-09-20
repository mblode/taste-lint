import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { expect, it } from "vitest";

import { collectFiles } from "../lib/glob.js";
import { temporary } from "./helpers.js";

it("skips Git-ignored artifacts and dangling excluded links while retaining tracked files", () => {
  const root = temporary();
  try {
    execFileSync("git", ["init", "--quiet", root]);
    fs.writeFileSync(path.join(root, ".gitignore"), "staging/\ntracked.md\n");
    fs.writeFileSync(path.join(root, "tracked.md"), "Tracked source");
    execFileSync("git", ["-C", root, "add", "-f", "tracked.md"]);
    fs.writeFileSync(path.join(root, "fresh.md"), "New source");
    fs.mkdirSync(path.join(root, "staging"));
    fs.symlinkSync("missing", path.join(root, "staging", "broken.md"));
    expect(collectFiles(root, ["staging/broken.md"], ["**/*.md"])).toEqual([]);
    fs.symlinkSync("missing", path.join(root, "node_modules"));
    expect(collectFiles(root, ["."], ["**/*.md"])).toEqual([
      "fresh.md",
      "tracked.md",
    ]);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});
