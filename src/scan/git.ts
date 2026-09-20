import { execFileSync } from "node:child_process";

import { InputError } from "../lib/errors.js";

const git = (root: string, args: string[]): string => {
  try {
    return execFileSync("git", ["-C", root, ...args], {
      encoding: "utf-8",
      maxBuffer: 32 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    throw new InputError(
      "INVALID_GIT_BASE",
      "Cannot compare Git revisions. Use a valid base in the scan repository."
    );
  }
};
export interface ChangedLines {
  ranges: Map<string, [number, number][]>;
  untracked: Set<string>;
  base: string;
}
export const changedLines = (root: string, ref: string): ChangedLines => {
  const base = git(root, [
    "rev-parse",
    "--verify",
    "--end-of-options",
    `${ref}^{commit}`,
  ]).trim();
  const names = git(root, [
    "diff",
    "--relative",
    "--no-ext-diff",
    "--no-textconv",
    "--no-renames",
    "--name-only",
    "-z",
    base,
    "--",
  ])
    .split("\0")
    .filter(Boolean);
  const ranges = new Map<string, [number, number][]>();
  for (const file of names) {
    const patch = git(root, [
      "diff",
      "--relative",
      "--no-ext-diff",
      "--no-textconv",
      "--no-renames",
      "--unified=0",
      base,
      "--",
      file,
    ]);
    const lines: [number, number][] = [];
    for (const match of patch.matchAll(
      /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm
    )) {
      const start = Number(match[1]);
      const length = Number(match[2] ?? 1);
      if (length > 0) {
        lines.push([start, start + length - 1]);
      }
    }
    ranges.set(file, lines);
  }
  const untracked = new Set(
    git(root, ["ls-files", "--others", "--exclude-standard", "-z"])
      .split("\0")
      .filter(Boolean)
  );
  return { base, ranges, untracked };
};
export const touchesChange = (
  diff: ChangedLines,
  file: string,
  start: number,
  end: number
): boolean =>
  diff.untracked.has(file) ||
  (diff.ranges.get(file) ?? []).some(([a, b]) => start <= b && end >= a);
