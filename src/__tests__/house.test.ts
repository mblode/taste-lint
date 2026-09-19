// Structural checks for repository conventions that prose alone does not hold.
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { docTypeFor, loadConfig } from "../lib/config.js";
import { FIXES } from "../reduce/fixes.js";
import { FUNCTIONS } from "../reduce/mechanical.js";
import { loadRules } from "../rules/load.js";
import { DOC_TYPES, ROLES } from "../types.js";

const root = path.resolve(import.meta.dirname, "../..");
const EM_DASH = String.fromCodePoint(0x20_14);

const walk = (dir: string, keep: (file: string) => boolean): string[] => {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!["node_modules", "dist", ".git", "results"].includes(entry.name)) {
        out.push(...walk(abs, keep));
      }
    } else if (keep(abs)) {
      out.push(abs);
    }
  }
  return out;
};

describe("house rules", () => {
  it("has no em dash in source, rules, docs or scripts", () => {
    const files = walk(
      root,
      (f) =>
        /\.(ts|mjs|yaml|json|md)$/.test(f) &&
        !f.includes(`${path.sep}data${path.sep}corpus${path.sep}`) &&
        !f.includes(`${path.sep}__tests__${path.sep}fixtures${path.sep}`) &&
        !f.endsWith("package-lock.json")
    );
    const offenders = files.filter((f) =>
      fs.readFileSync(f, "utf-8").includes(EM_DASH)
    );
    expect(offenders.map((f) => path.relative(root, f))).toEqual([]);
  });

  it("references every registered mechanical function and fix from at least one rule", () => {
    const rules = loadRules(path.join(root, "data/rules"), {
      allowDraft: true,
    });
    const usedFunctions = new Set(
      rules.map((r) => r.mechanical?.function).filter(Boolean)
    );
    const usedFixes = new Set(rules.map((r) => r.fix.function).filter(Boolean));
    expect(Object.keys(FUNCTIONS).filter((f) => !usedFunctions.has(f))).toEqual(
      []
    );
    expect(Object.keys(FIXES).filter((f) => !usedFixes.has(f))).toEqual([]);
  });

  it("keeps every Jev-backed rule review-only until tune promotes it", () => {
    const rules = loadRules(path.join(root, "data/rules"), {
      allowDraft: true,
    });
    const tuning = fs.existsSync(path.join(root, "data/rules/tuning.json"))
      ? (JSON.parse(
          fs.readFileSync(path.join(root, "data/rules/tuning.json"), "utf-8")
        ) as Record<string, { status?: string }>)
      : {};
    const unproven = rules.filter(
      (r) =>
        r.tier !== "mechanical" &&
        r.status === "active" &&
        tuning[r.id]?.status !== "active"
    );
    expect(unproven.map((r) => r.id)).toEqual([]);
  });

  it("keeps the editor schema's enums equal to the validator's", () => {
    const schema = JSON.parse(
      fs.readFileSync(
        path.join(root, "data/rules/schema/rule.schema.json"),
        "utf-8"
      )
    ) as {
      properties: {
        preconditions: {
          properties: {
            docType: { items: { enum: string[] } };
            role: { items: { enum: string[] } };
          };
        };
      };
    };
    expect(
      schema.properties.preconditions.properties.docType.items.enum
    ).toEqual([...DOC_TYPES]);
    expect(schema.properties.preconditions.properties.role.items.enum).toEqual([
      ...ROLES,
    ]);
  });

  it("classifies marketing routes before the tsx catch-all", () => {
    const config = loadConfig(root);
    expect(docTypeFor(config, "app/(marketing)/page.tsx")).toBe("marketing");
    expect(docTypeFor(config, "app/settings/page.tsx")).toBe("ui");
  });

  it("names only existing paths in AGENTS.md and docs/DESIGN.md", () => {
    const docs = ["AGENTS.md", "docs/DESIGN.md"]
      .map((f) => fs.readFileSync(path.join(root, f), "utf-8"))
      .join("\n");
    const paths = [
      ...docs.matchAll(/`((?:src|data|docs|scripts)\/[A-Za-z0-9_./-]+)`/g),
    ].map((m) => m[1]);
    const missing = paths.filter(
      (p) => !fs.existsSync(path.join(root, p.replace(/\/$/, "")))
    );
    expect(missing).toEqual([]);
  });
});
