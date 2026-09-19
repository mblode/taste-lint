import fs from "node:fs";
import path from "node:path";

const DEFAULT_EXCLUDE = [
  "**/node_modules/**",
  "**/dist/**",
  "**/.next/**",
  "**/.git/**",
  "**/results/**",
  "**/coverage/**",
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
  exclude: string[] = []
): string[] => {
  const excludes = [...DEFAULT_EXCLUDE, ...exclude];
  const out = new Set<string>();
  const visit = (abs: string): void => {
    let stat: fs.Stats;
    try {
      stat = fs.statSync(abs);
    } catch {
      return;
    }
    const rel = toPosix(path.relative(root, abs));
    if (stat.isDirectory()) {
      if (rel && matchesAny(`${rel}/`, excludes)) {
        return;
      }
      for (const entry of fs.readdirSync(abs)) {
        visit(path.join(abs, entry));
      }
      return;
    }
    if (matchesAny(rel, excludes)) {
      return;
    }
    if (matchesAny(rel, include)) {
      out.add(rel);
    }
  };
  for (const target of targets) {
    visit(path.resolve(root, target));
  }
  return [...out].toSorted();
};
