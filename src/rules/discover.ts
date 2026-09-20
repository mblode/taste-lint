import fs from "node:fs";
import path from "node:path";

import { parse } from "yaml";

import { InputError } from "../lib/errors.js";
import type { Rule } from "../types.js";

export interface DiscoveredSource {
  path: string;
  skill: string;
  kind: "entrypoint" | "rule" | "guidance";
  title: string;
  sections: { title: string; line: number }[];
  citedBy: string[];
  status: "cited" | "needs-triage";
  diagnostic?: string;
}

// Discovery never executes source instructions or turns a document into a rule.
export const discoverSkills = (
  root: string,
  rules: Rule[]
): DiscoveredSource[] => {
  const absolute = path.resolve(root);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isDirectory()) {
    throw new InputError(
      "INVALID_SKILL_SOURCE",
      `Skill source must be a directory: ${absolute}`
    );
  }
  const entries: DiscoveredSource[] = [];
  const visit = (dir: string, owner?: string, skillRoot?: string): void => {
    const skill = fs.existsSync(path.join(dir, "SKILL.md"))
      ? path.basename(dir)
      : owner;
    const base = skill !== owner ? dir : skillRoot;
    for (const entry of fs
      .readdirSync(dir, { withFileTypes: true })
      .toSorted((a, b) => a.name.localeCompare(b.name))) {
      if (
        entry.isSymbolicLink() ||
        [
          "node_modules",
          ".git",
          "dist",
          "evals",
          "evaluations",
          "scripts",
          "agents",
        ].includes(entry.name)
      ) {
        continue;
      }
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(file, skill, base);
        continue;
      }
      if (
        !skill ||
        !base ||
        !entry.name.endsWith(".md") ||
        /evaluation-scenarios/.test(entry.name)
      ) {
        continue;
      }
      const text = fs.readFileSync(file, "utf-8");
      const sections = text
        .split("\n")
        .flatMap((line, i) =>
          /^#{1,3} /.test(line)
            ? [{ line: i + 1, title: line.replace(/^#+ /, "") }]
            : []
        );
      let title = sections[0]?.title ?? entry.name;
      let diagnostic: string | undefined;
      const front = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (front) {
        try {
          const value = parse(front[1]) as { title?: unknown } | null;
          if (typeof value?.title === "string") {
            title = value.title;
          }
        } catch {
          diagnostic =
            "Frontmatter could not be parsed; retained for manual triage";
        }
      }
      const relative = path.relative(base, file).split(path.sep).join("/");
      const canonical = `skills/${skill}/${relative}`;
      const citedBy = rules
        .filter((r) => r.source.path === canonical)
        .map((r) => r.id);
      const kind =
        entry.name === "SKILL.md"
          ? "entrypoint"
          : /^rules(?:-arch|-ax)?\//.test(relative) &&
              !entry.name.startsWith("_")
            ? "rule"
            : "guidance";
      entries.push({
        citedBy,
        diagnostic,
        kind,
        path: file,
        sections,
        skill,
        status: citedBy.length ? "cited" : "needs-triage",
        title,
      });
    }
  };
  visit(absolute);
  return entries;
};
