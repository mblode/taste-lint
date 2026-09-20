import fs from "node:fs";
import path from "node:path";

import { parse } from "yaml";

import { InputError } from "../lib/errors.js";
import { RULE_STATUSES } from "../types.js";
import type { Rule, Tuning, TuningEntry } from "../types.js";
import { CODE_RULES } from "./code/index.js";
import { validateRule } from "./validate.js";

// Walk up from this module to find the packaged data directory, so the CLI
// works both from the repo and from an installed tarball.
export const resolveRulesDir = (explicit?: string): string => {
  if (explicit) {
    const abs = path.resolve(explicit);
    if (!fs.existsSync(abs)) {
      throw new Error(`Rules directory not found: ${abs}`);
    }
    return abs;
  }
  let dir = import.meta.dirname;
  for (let i = 0; i < 5; i += 1) {
    const candidate = path.join(dir, "data", "rules");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    dir = path.dirname(dir);
  }
  throw new Error(
    "Could not locate data/rules. Reinstall taste-lint or pass --rules."
  );
};

// tuning.json is the one file `tune --write` edits; a typo here would flip a
// rule's status or threshold silently, so every entry is checked.
export const readTuning = (rulesDir: string): Tuning => {
  const file = path.join(rulesDir, "tuning.json");
  if (!fs.existsSync(file)) {
    return {};
  }
  const raw = JSON.parse(fs.readFileSync(file, "utf-8")) as unknown;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`Invalid tuning file ${file}: must be an object`);
  }
  const bad = (id: string, why: string): never => {
    throw new Error(`Invalid tuning file ${file}: ${id} ${why}`);
  };
  const out: Tuning = {};
  for (const [id, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      bad(id, "must be an object");
    }
    const e = entry as Record<string, unknown>;
    const allowed = new Set(["act", "status", "precisionLower", "n", "ts"]);
    for (const key of Object.keys(e)) {
      if (!allowed.has(key)) {
        bad(id, `has unknown key ${key}`);
      }
    }
    const tuned: TuningEntry = {};
    if (e.act !== undefined) {
      if (typeof e.act !== "number" || !(e.act > 0 && e.act <= 1)) {
        bad(id, "act must be a number in (0, 1]");
      }
      tuned.act = e.act as number;
    }
    if (e.status !== undefined) {
      if (!RULE_STATUSES.includes(e.status as (typeof RULE_STATUSES)[number])) {
        bad(id, `status must be one of ${RULE_STATUSES.join(", ")}`);
      }
      tuned.status = e.status as TuningEntry["status"];
    }
    if (e.precisionLower !== undefined) {
      if (typeof e.precisionLower !== "number") {
        bad(id, "precisionLower must be a number");
      }
      tuned.precisionLower = e.precisionLower as number;
    }
    if (e.n !== undefined) {
      if (!Number.isInteger(e.n)) {
        bad(id, "n must be an integer");
      }
      tuned.n = e.n as number;
    }
    if (e.ts !== undefined) {
      if (typeof e.ts !== "string") {
        bad(id, "ts must be a string");
      }
      tuned.ts = e.ts as string;
    }
    out[id] = tuned;
  }
  return out;
};

export interface LoadOptions {
  /** Include rules with status draft (default false). */
  allowDraft?: boolean;
  /** Restrict to these rule ids. */
  only?: string[];
}

export const loadRules = (
  rulesDir: string,
  options: LoadOptions = {}
): Rule[] => {
  const tuning = readTuning(rulesDir);
  const rules: Rule[] = [];
  const seen = new Set<string>();
  const domains = fs
    .readdirSync(rulesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "schema")
    .map((d) => d.name)
    .toSorted();
  for (const domain of domains) {
    const dir = path.join(rulesDir, domain);
    for (const name of fs.readdirSync(dir).toSorted()) {
      if (!name.endsWith(".yaml")) {
        continue;
      }
      const file = path.join(dir, name);
      const expectedId = name.slice(0, -".yaml".length);
      let raw: unknown;
      try {
        raw = parse(fs.readFileSync(file, "utf-8"));
      } catch (error) {
        throw new Error(
          `Invalid rule ${file}: YAML did not parse (${(error as Error).message})`,
          { cause: error }
        );
      }
      const rule = validateRule(raw, file, expectedId);
      if (rule.domain !== domain) {
        throw new Error(
          `Invalid rule ${file}: domain ${rule.domain} does not match folder ${domain}`
        );
      }
      rules.push(rule);
    }
  }
  // Code rules join the same list; a fresh object per load so the overlay
  // below never mutates the module constant.
  for (const code of CODE_RULES) {
    rules.push({ ...code, thresholds: { ...code.thresholds } });
  }
  for (const rule of rules) {
    if (seen.has(rule.id)) {
      throw new Error(`Duplicate rule id ${rule.id}`);
    }
    seen.add(rule.id);
    const overlay = tuning[rule.id];
    if (overlay) {
      if (overlay.act !== undefined) {
        if (!(overlay.act > rule.thresholds.review && overlay.act <= 1)) {
          throw new Error(
            `Invalid tuning for ${rule.id}: act must be above review and at most 1`
          );
        }
        rule.thresholds = { ...rule.thresholds, act: overlay.act };
      }
      if (overlay.status) {
        rule.status = overlay.status;
      }
    }
  }
  for (const id of Object.keys(tuning)) {
    if (!seen.has(id)) {
      throw new Error(`tuning.json names unknown rule ${id}`);
    }
  }
  let out = rules;
  if (!options.allowDraft) {
    out = out.filter((r) => r.status !== "draft");
  }
  if (options.only) {
    const wanted = new Set(options.only);
    const missing = options.only.filter((id) => !seen.has(id));
    if (missing.length > 0) {
      throw new InputError(
        "INVALID_RULE",
        `Unknown rule ids: ${missing.join(", ")}`,
        { rules: missing }
      );
    }
    out = out.filter((r) => wanted.has(r.id));
  }
  return out;
};
