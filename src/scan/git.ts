import { execFileSync } from "node:child_process";

import { InputError } from "../lib/errors.js";

const git = (
  root: string,
  args: string[],
  failure: [code: string, message: string] = [
    "INVALID_GIT_BASE",
    "Cannot compare Git revisions. Use a valid base in the scan repository.",
  ]
): string => {
  try {
    return execFileSync("git", ["-C", root, ...args], {
      encoding: "utf-8",
      maxBuffer: 32 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    throw new InputError(failure[0], failure[1]);
  }
};
const NOT_A_REPOSITORY: [string, string] = [
  "NOT_A_GIT_REPOSITORY",
  "--staged reads Git's index. Run it inside a Git repository.",
];

// Paths relative to `root` of files added, copied, modified or renamed in the
// index. Deletions are left out: there is nothing left to lint.
export const stagedFiles = (root: string): string[] =>
  git(
    root,
    [
      "diff",
      "--cached",
      "--relative",
      "--no-ext-diff",
      "--no-renames",
      "--name-only",
      "--diff-filter=ACMR",
      "-z",
    ],
    NOT_A_REPOSITORY
  )
    .split("\0")
    .filter(Boolean);

// The staged blobs, which are what the commit will contain. The working tree
// can differ when only some hunks of a file were added. Two Git processes
// whatever the file count: the index listing names each blob, and one
// cat-file batch reads them all.
export const stagedSources = (
  root: string,
  files: string[]
): Map<string, string> => {
  const sources = new Map<string, string>();
  if (files.length === 0) {
    return sources;
  }
  const wanted = new Set(files);
  // Identical files share one blob, so a blob can name several paths.
  const blobs = new Map<string, string[]>();
  for (const entry of git(
    root,
    ["ls-files", "--stage", "-z"],
    NOT_A_REPOSITORY
  ).split("\0")) {
    // <mode> <oid> <stage>\t<path>; stage 0 is the merged, committable entry.
    const tab = entry.indexOf("\t");
    const [, oid, stage] = entry.slice(0, tab).split(" ");
    const file = entry.slice(tab + 1);
    if (stage === "0" && wanted.has(file)) {
      blobs.set(oid, [...(blobs.get(oid) ?? []), file]);
    }
  }
  let output: Buffer;
  try {
    output = execFileSync("git", ["-C", root, "cat-file", "--batch"], {
      input: [...blobs.keys()].join("\n"),
      maxBuffer: 256 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch {
    throw new InputError(...NOT_A_REPOSITORY);
  }
  // Each object is "<oid> blob <size>\n", <size> bytes, then "\n".
  for (let at = 0; at < output.length;) {
    const newline = output.indexOf(10, at);
    const [oid, , size] = output.subarray(at, newline).toString().split(" ");
    const start = newline + 1;
    const end = start + Number(size);
    const text = output.subarray(start, end).toString("utf-8");
    for (const file of blobs.get(oid) ?? []) {
      sources.set(file, text);
    }
    at = end + 1;
  }
  const unread = files.find((file) => !sources.has(file));
  if (unread) {
    throw new InputError(
      "STAGED_READ_FAILED",
      `Cannot read the staged copy of ${unread}. Resolve any merge conflict in it, then retry.`,
      { path: unread }
    );
  }
  return sources;
};

export interface ChangedLines {
  ranges: Map<string, [number, number][]>;
  untracked: Set<string>;
  base: string;
}
// With `cached`, compare the index rather than the working tree, so line
// numbers match the staged blobs `stagedSource` returns.
export const changedLines = (
  root: string,
  ref: string,
  cached = false
): ChangedLines => {
  const base = git(root, [
    "rev-parse",
    "--verify",
    "--end-of-options",
    `${ref}^{commit}`,
  ]).trim();
  const diff = [
    "diff",
    ...(cached ? ["--cached"] : []),
    "--relative",
    "--no-ext-diff",
    "--no-textconv",
    "--no-renames",
  ];
  const names = git(root, [...diff, "--name-only", "-z", base, "--"])
    .split("\0")
    .filter(Boolean);
  const ranges = new Map<string, [number, number][]>();
  for (const file of names) {
    const patch = git(root, [...diff, "--unified=0", base, "--", file]);
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
  // A staged new file already shows up in the cached diff as all additions.
  const untracked = new Set(
    cached
      ? []
      : git(root, ["ls-files", "--others", "--exclude-standard", "-z"])
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
