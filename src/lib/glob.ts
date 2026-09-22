import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { InputError } from "./errors.js";

const DEFAULT_EXCLUDE = [
  "**/node_modules/**",
  "**/dist/**",
  "**/.next/**",
  "**/.git/**",
  "**/results/**",
  "**/coverage/**",
  // Legal text and generated release notes are not the author's prose.
  "**/LICENSE",
  "**/LICENSE.*",
  "**/CHANGELOG.md",
];

// Convert a glob to a RegExp over a forward-slash relative path.
const globToRegExp = (glob: string): RegExp => {
  let out = "^";
  for (let i = 0; i < glob.length; i += 1) {
    const ch = glob[i];
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        // `**/` matches zero or more directories; `**` alone matches anything.
        if (glob[i + 2] === "/") {
          out += "(?:.*/)?";
          i += 2;
        } else {
          out += ".*";
          i += 1;
        }
      } else {
        out += "[^/]*";
      }
    } else if (ch === "?") {
      out += "[^/]";
    } else if (ch === "{") {
      const close = glob.indexOf("}", i);
      if (close === -1) {
        out += "\\{";
      } else {
        const alts = glob
          .slice(i + 1, close)
          .split(",")
          .map((a) =>
            a
              .replaceAll(/[.+^$()|[\]\\]/g, "\\$&")
              .replaceAll("*", "[^/]*")
              .replaceAll("?", "[^/]")
          );
        out += `(?:${alts.join("|")})`;
        i = close;
      }
    } else if (/[.+^$()|[\]\\]/.test(ch)) {
      out += `\\${ch}`;
    } else {
      out += ch;
    }
  }
  return new RegExp(`${out}$`);
};

export const matchesAny = (relative: string, globs: string[]): boolean =>
  globs.some((g) => globToRegExp(g).test(relative));

export const toPosix = (p: string): string => p.split(path.sep).join("/");

// Walk `targets` (files or directories) under `root` and return relative
// forward-slash paths matching `include` and not `exclude`.
export const collectFiles = (
  root: string,
  targets: string[],
  include: string[],
  exclude: string[] = [],
  diagnostics?: { excluded: number; messages: string[] }
): string[] => {
  const excludes = [...DEFAULT_EXCLUDE, ...exclude];
  const ignoredResult = spawnSync(
    "git",
    [
      "ls-files",
      "--others",
      "--ignored",
      "--exclude-standard",
      "--directory",
      "-z",
      "--",
      ".",
    ],
    { cwd: root, encoding: "utf-8", maxBuffer: 16 * 1024 * 1024 }
  );
  // Non-Git directories still support the explicit exclusion policy.
  const ignored = new Set(
    ignoredResult.status === 0 ? ignoredResult.stdout.split("\0") : []
  );
  const isIgnored = (relative: string): boolean => {
    if (ignored.has(relative)) {
      return true;
    }
    for (
      let directory = relative;
      directory !== ".";
      directory = path.posix.dirname(directory)
    ) {
      if (ignored.has(`${directory}/`)) {
        return true;
      }
    }
    return false;
  };
  const out = new Set<string>();
  const visited = new Set<string>();
  const visit = (abs: string, explicit = false): void => {
    const rel = toPosix(path.relative(root, abs));
    // Exclude before stat: ignored build trees may contain dangling symlinks.
    if (
      rel &&
      (isIgnored(rel) ||
        matchesAny(rel, excludes) ||
        matchesAny(`${rel}/`, excludes))
    ) {
      if (diagnostics) {
        diagnostics.excluded += 1;
      }
      return;
    }
    let stat: fs.Stats;
    try {
      stat = fs.statSync(abs);
    } catch (error) {
      const code =
        (error as NodeJS.ErrnoException).code === "ENOENT"
          ? "TARGET_NOT_FOUND"
          : "TARGET_UNREADABLE";
      throw new InputError(
        code,
        `Cannot read target ${abs}. Check that it exists and is readable.`,
        { path: abs }
      );
    }
    if (stat.isDirectory()) {
      const real = fs.realpathSync(abs);
      if (visited.has(real)) {
        return;
      }
      visited.add(real);
      let entries: string[];
      try {
        entries = fs.readdirSync(abs);
      } catch {
        throw new InputError(
          "TARGET_UNREADABLE",
          `Cannot read directory ${abs}.`,
          { path: abs }
        );
      }
      for (const entry of entries) {
        visit(path.join(abs, entry));
      }
      visited.delete(real);
      return;
    }
    if (matchesAny(rel, include)) {
      out.add(rel);
    } else if (explicit) {
      throw new InputError(
        "UNSUPPORTED_TARGET",
        `Unsupported target ${abs}. Use Markdown, MDX, TSX, JSX, CSS or SCSS.`,
        { path: abs }
      );
    }
  };
  for (const target of targets) {
    visit(path.resolve(root, target), true);
  }
  return [...out].toSorted();
};
