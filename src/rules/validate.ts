// Fail-closed rule validation. Any problem throws with the file path so a bad
// rule aborts the run before a single request is made.

import {
  CONTEXT_KEYS,
  DOC_TYPES,
  DOMAINS,
  ROLES,
  RULE_STATUSES,
  SEVERITIES,
  TIERS,
  UNIT_KINDS,
} from "../types.js";
import type {
  CriterionSide,
  Domain,
  Fix,
  Mechanical,
  Preconditions,
  Question,
  Rule,
  Severity,
  Tier,
} from "../types.js";
import { CATEGORY_BY_ID } from "./taxonomy.js";

const EM_DASH = "—";
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type Raw = Record<string, unknown>;

const fail = (file: string, message: string): never => {
  throw new Error(`Invalid rule ${file}: ${message}`);
};

const isRecord = (v: unknown): v is Raw =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const str = (file: string, raw: Raw, key: string): string => {
  const v = raw[key];
  if (typeof v !== "string" || v.trim() === "") {
    fail(file, `${key} must be a nonempty string`);
  }
  return v as string;
};

const optStrList = (
  file: string,
  raw: Raw,
  key: string
): string[] | undefined => {
  const v = raw[key];
  if (v === undefined) {
    return undefined;
  }
  if (!Array.isArray(v) || v.some((s) => typeof s !== "string")) {
    fail(file, `${key} must be a list of strings`);
  }
  return v as string[];
};

const oneOf = <T extends string>(
  file: string,
  key: string,
  v: unknown,
  allowed: readonly T[]
): T => {
  if (typeof v !== "string" || !allowed.includes(v as T)) {
    fail(file, `${key} must be one of ${allowed.join(", ")}`);
  }
  return v as T;
};

const noEmDash = (file: string, key: string, v: string): void => {
  if (v.includes(EM_DASH)) {
    fail(file, `${key} contains an em dash; use a comma, colon or period`);
  }
};

const side = (file: string, key: string, v: unknown): CriterionSide => {
  if (!isRecord(v)) {
    fail(file, `${key} must be an object with what and examples`);
  }
  const what = str(file, v as Raw, "what");
  noEmDash(file, `${key}.what`, what);
  const examples = optStrList(file, v as Raw, "examples") ?? [];
  if (examples.length === 0) {
    fail(file, `${key}.examples needs at least one example`);
  }
  return { examples, what };
};

const question = (file: string, v: unknown): Question => {
  if (!isRecord(v)) {
    fail(file, "question must be an object");
  }
  const raw = v as Raw;
  const type = oneOf(file, "question.type", raw.type, ["noul"] as const);
  const instructions = str(file, raw, "instructions");
  noEmDash(file, "question.instructions", instructions);
  let criteria: Question["criteria"];
  if (raw.criteria !== undefined) {
    if (!isRecord(raw.criteria)) {
      fail(file, "question.criteria must be an object");
    }
    const c = raw.criteria as Raw;
    criteria = {
      false: side(file, "question.criteria.false", c.false),
      true: side(file, "question.criteria.true", c.true),
    };
  }
  const context = optStrList(file, raw, "context") as Question["context"];
  for (const key of context ?? []) {
    oneOf(file, "question.context", key, CONTEXT_KEYS);
  }
  return { context, criteria, instructions, type };
};

const mechanical = (file: string, v: unknown): Mechanical => {
  if (!isRecord(v)) {
    fail(file, "mechanical must be an object");
  }
  const raw = v as Raw;
  const out: Mechanical = {};
  if (raw.regex !== undefined) {
    out.regex = str(file, raw, "regex");
    out.flags = typeof raw.flags === "string" ? raw.flags : "gu";
    try {
      const compiled = new RegExp(out.regex, out.flags);
      void compiled;
    } catch (error) {
      fail(
        file,
        `mechanical.regex does not compile: ${(error as Error).message}`
      );
    }
  }
  if (raw.phrases !== undefined) {
    out.phrases = optStrList(file, raw, "phrases");
    if (out.phrases?.length === 0) {
      fail(file, "mechanical.phrases must not be empty");
    }
  }
  if (raw.function !== undefined) {
    out.function = str(file, raw, "function");
  }
  if (raw.minMatches !== undefined) {
    if (typeof raw.minMatches !== "number" || raw.minMatches < 1) {
      fail(file, "mechanical.minMatches must be a positive number");
    }
    out.minMatches = raw.minMatches as number;
  }
  if (!(out.regex || out.phrases || out.function)) {
    fail(file, "mechanical needs regex, phrases or function");
  }
  return out;
};

const preconditions = (file: string, v: unknown): Preconditions => {
  if (!isRecord(v)) {
    fail(file, "preconditions must be an object");
  }
  const raw = v as Raw;
  const out: Preconditions = {};
  if (raw.notInCode !== undefined) {
    if (raw.notInCode !== true) {
      fail(file, "preconditions.notInCode may only be true");
    }
    out.notInCode = true;
  }
  if (raw.docType !== undefined) {
    out.docType = (optStrList(file, raw, "docType") ?? []).map((d) =>
      oneOf(file, "preconditions.docType", d, DOC_TYPES)
    );
  }
  if (raw.role !== undefined) {
    out.role = (optStrList(file, raw, "role") ?? []).map((r) =>
      oneOf(file, "preconditions.role", r, ROLES)
    );
  }
  if (raw.element !== undefined) {
    out.element = optStrList(file, raw, "element");
  }
  if (raw.smartQuotesAtBuild !== undefined) {
    if (raw.smartQuotesAtBuild !== false) {
      fail(file, "preconditions.smartQuotesAtBuild may only be false");
    }
    out.smartQuotesAtBuild = false;
  }
  return out;
};

const fix = (file: string, v: unknown): Fix => {
  if (!isRecord(v)) {
    fail(file, "fix must be an object");
  }
  const raw = v as Raw;
  const mode = oneOf(file, "fix.mode", raw.mode, [
    "deterministic",
    "llm",
    "none",
  ] as const);
  const hint = str(file, raw, "hint");
  noEmDash(file, "fix.hint", hint);
  const out: Fix = { hint, mode };
  if (raw.function !== undefined) {
    out.function = str(file, raw, "function");
  }
  if (mode === "deterministic" && !out.function) {
    fail(file, "fix.mode deterministic needs fix.function");
  }
  return out;
};

export const validateRule = (
  raw: unknown,
  file: string,
  expectedId: string
): Rule => {
  if (!isRecord(raw)) {
    fail(file, "rule must be a mapping");
  }
  const r = raw as Raw;
  const id = str(file, r, "id");
  if (!KEBAB.test(id)) {
    fail(file, "id must be kebab-case");
  }
  if (id !== expectedId) {
    fail(file, `id ${id} does not match filename ${expectedId}`);
  }
  const title = str(file, r, "title");
  noEmDash(file, "title", title);
  const categoryId = str(file, r, "categoryId");
  const category = CATEGORY_BY_ID.get(categoryId);
  if (!category) {
    fail(file, `unknown categoryId ${categoryId}`);
  }
  const domain = oneOf<Domain>(file, "domain", r.domain, DOMAINS);
  if (domain !== category?.domain) {
    fail(
      file,
      `domain ${domain} does not match category ${categoryId} (${category?.domain})`
    );
  }
  if (!id.startsWith(`${domain}-`)) {
    fail(file, `id must start with ${domain}-`);
  }
  if (!isRecord(r.source)) {
    fail(file, "source must be an object");
  }
  const s = r.source as Raw;
  const source: Rule["source"] = {
    line: typeof s.line === "number" ? s.line : 1,
    path: str(file, s, "path"),
    repo: str(file, s, "repo"),
  };
  if (typeof s.ruleId === "string") {
    source.ruleId = s.ruleId;
  }
  if (typeof s.tier === "string") {
    source.tier = s.tier;
  }
  if (!isRecord(r.scope)) {
    fail(file, "scope must be an object with include");
  }
  const include = optStrList(file, r.scope as Raw, "include") ?? [];
  if (include.length === 0) {
    fail(file, "scope.include needs at least one glob");
  }
  const scope: Rule["scope"] = { include };
  const exclude = optStrList(file, r.scope as Raw, "exclude");
  if (exclude) {
    scope.exclude = exclude;
  }
  const unit = (optStrList(file, r, "unit") ?? []).map((u) =>
    oneOf(file, "unit", u, UNIT_KINDS)
  );
  if (unit.length === 0) {
    fail(file, "unit needs at least one kind");
  }
  const tier = oneOf<Tier>(file, "tier", r.tier, TIERS);
  const mech =
    r.mechanical === undefined ? undefined : mechanical(file, r.mechanical);
  const q = r.question === undefined ? undefined : question(file, r.question);
  if (tier !== "jev" && !mech) {
    fail(file, `tier ${tier} needs a mechanical section`);
  }
  if (tier === "mechanical" && q) {
    fail(file, "tier mechanical must not carry a question");
  }
  const status = oneOf(file, "status", r.status ?? "active", RULE_STATUSES);
  if (tier !== "mechanical" && !q && status !== "draft") {
    fail(file, `tier ${tier} needs a question unless status is draft`);
  }
  let thresholds: Rule["thresholds"] = { act: 0.7, review: 0.35 };
  if (r.thresholds !== undefined) {
    if (!isRecord(r.thresholds)) {
      fail(file, "thresholds must be an object");
    }
    const t = r.thresholds as Raw;
    const act = typeof t.act === "number" ? t.act : 0.7;
    const review = typeof t.review === "number" ? t.review : 0.35;
    if (!(review >= 0 && review < act && act <= 1)) {
      fail(file, "thresholds need 0 <= review < act <= 1");
    }
    thresholds = { act, review };
  }
  const severity = oneOf<Severity>(file, "severity", r.severity, SEVERITIES);
  let severityOverrides: Rule["severityOverrides"];
  if (r.severityOverrides !== undefined) {
    if (!Array.isArray(r.severityOverrides)) {
      fail(file, "severityOverrides must be a list");
    }
    severityOverrides = (r.severityOverrides as unknown[]).map((o) => {
      if (!isRecord(o)) {
        fail(file, "severityOverrides entries must be objects");
      }
      return {
        scope: str(file, o as Raw, "scope"),
        severity: oneOf<Severity>(
          file,
          "severityOverrides.severity",
          (o as Raw).severity,
          SEVERITIES
        ),
      };
    });
  }
  const f = fix(file, r.fix);
  const pre =
    r.preconditions === undefined
      ? undefined
      : preconditions(file, r.preconditions);
  const handWritten = optStrList(file, r, "handWritten") ?? [];
  const related = optStrList(file, r, "related");
  return {
    categoryId,
    domain,
    file,
    fix: f,
    handWritten,
    id,
    mechanical: mech,
    preconditions: pre,
    question: q,
    related,
    scope,
    severity,
    severityOverrides,
    source,
    status,
    thresholds,
    tier,
    title,
    unit,
  };
};
