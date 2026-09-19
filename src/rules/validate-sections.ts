// Field-level validators for one rule file. Every helper fails closed with the
// file path; `validateRule` in validate.ts composes them.

import { FIXES } from "../reduce/fixes.js";
import { FUNCTIONS } from "../reduce/mechanical.js";
import { CONTEXT_KEYS, DOC_TYPES, ROLES } from "../types.js";
import type {
  CriterionSide,
  Fix,
  Mechanical,
  Preconditions,
  Question,
} from "../types.js";

const EM_DASH = String.fromCodePoint(0x20_14);
export type Raw = Record<string, unknown>;

export const fail = (file: string, message: string): never => {
  throw new Error(`Invalid rule ${file}: ${message}`);
};

export const isRecord = (v: unknown): v is Raw =>
  typeof v === "object" && v !== null && !Array.isArray(v);

// A key the validator does not read would otherwise be a silent no-op; a typo
// such as `threshold` must fail, not fall back to the default.
export const knownKeys = (
  file: string,
  where: string,
  raw: Raw,
  allowed: readonly string[]
): void => {
  for (const key of Object.keys(raw)) {
    if (!allowed.includes(key)) {
      fail(file, `${where} has unknown key ${key}`);
    }
  }
};

// A number when present; absent falls back. A present non-number fails.
export const optNumber = (
  file: string,
  raw: Raw,
  key: string,
  fallback: number
): number => {
  const v = raw[key];
  if (v === undefined) {
    return fallback;
  }
  if (typeof v !== "number" || !Number.isFinite(v)) {
    fail(file, `${key} must be a number`);
  }
  return v as number;
};

export const str = (file: string, raw: Raw, key: string): string => {
  const v = raw[key];
  if (typeof v !== "string" || v.trim() === "") {
    fail(file, `${key} must be a nonempty string`);
  }
  return v as string;
};

export const optStrList = (
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

export const oneOf = <T extends string>(
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

export const noEmDash = (file: string, key: string, v: string): void => {
  if (v.includes(EM_DASH)) {
    fail(file, `${key} contains an em dash; use a comma, colon or period`);
  }
};

const side = (file: string, key: string, v: unknown): CriterionSide => {
  if (!isRecord(v)) {
    fail(file, `${key} must be an object with what and examples`);
  }
  knownKeys(file, key, v as Raw, ["what", "examples"]);
  const what = str(file, v as Raw, "what");
  noEmDash(file, `${key}.what`, what);
  const examples = optStrList(file, v as Raw, "examples") ?? [];
  if (examples.length === 0) {
    fail(file, `${key}.examples needs at least one example`);
  }
  for (const example of examples) {
    noEmDash(file, `${key}.examples`, example);
  }
  return { examples, what };
};

export const question = (file: string, v: unknown): Question => {
  if (!isRecord(v)) {
    fail(file, "question must be an object");
  }
  const raw = v as Raw;
  knownKeys(file, "question", raw, [
    "type",
    "instructions",
    "criteria",
    "context",
  ]);
  const type = oneOf(file, "question.type", raw.type, ["noul"] as const);
  const instructions = str(file, raw, "instructions");
  noEmDash(file, "question.instructions", instructions);
  let criteria: Question["criteria"];
  if (raw.criteria !== undefined) {
    if (!isRecord(raw.criteria)) {
      fail(file, "question.criteria must be an object");
    }
    const c = raw.criteria as Raw;
    knownKeys(file, "question.criteria", c, ["true", "false"]);
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

export const mechanical = (file: string, v: unknown): Mechanical => {
  if (!isRecord(v)) {
    fail(file, "mechanical must be an object");
  }
  const raw = v as Raw;
  knownKeys(file, "mechanical", raw, [
    "regex",
    "flags",
    "phrases",
    "function",
    "minMatches",
  ]);
  const out: Mechanical = {};
  if (raw.flags !== undefined && typeof raw.flags !== "string") {
    fail(file, "mechanical.flags must be a string");
  }
  if (raw.regex !== undefined) {
    out.regex = str(file, raw, "regex");
    out.flags = (raw.flags as string | undefined) ?? "gu";
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
    for (const phrase of out.phrases ?? []) {
      noEmDash(file, "mechanical.phrases", phrase);
    }
  }
  if (raw.function !== undefined) {
    out.function = str(file, raw, "function");
    if (!(out.function in FUNCTIONS)) {
      fail(
        file,
        `mechanical.function ${out.function} is not registered in src/reduce/mechanical.ts`
      );
    }
  }
  if (raw.minMatches !== undefined) {
    if (!Number.isInteger(raw.minMatches) || (raw.minMatches as number) < 1) {
      fail(file, "mechanical.minMatches must be a positive integer");
    }
    out.minMatches = raw.minMatches as number;
  }
  if (!(out.regex || out.phrases || out.function)) {
    fail(file, "mechanical needs regex, phrases or function");
  }
  return out;
};

export const preconditions = (file: string, v: unknown): Preconditions => {
  if (!isRecord(v)) {
    fail(file, "preconditions must be an object");
  }
  const raw = v as Raw;
  knownKeys(file, "preconditions", raw, [
    "notInCode",
    "docType",
    "role",
    "element",
    "smartQuotesAtBuild",
  ]);
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

export const fix = (file: string, v: unknown): Fix => {
  if (!isRecord(v)) {
    fail(file, "fix must be an object");
  }
  const raw = v as Raw;
  knownKeys(file, "fix", raw, ["mode", "hint", "function"]);
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
    if (!(out.function in FIXES)) {
      fail(
        file,
        `fix.function ${out.function} is not registered in src/reduce/fixes.ts`
      );
    }
  }
  if (mode === "deterministic" && !out.function) {
    fail(file, "fix.mode deterministic needs fix.function");
  }
  return out;
};
