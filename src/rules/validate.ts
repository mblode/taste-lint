// Fail-closed rule validation. Any problem throws with the file path so a bad
// rule aborts the run before a single request is made. Field validators live
// in validate-sections.ts.

import { RULE_STATUSES, SEVERITIES, UNIT_KINDS } from "../types.js";
import type { Rule, Severity } from "../types.js";
import { CATEGORY_BY_ID } from "./taxonomy.js";
import {
  fail,
  fix,
  isRecord,
  knownKeys,
  mechanical,
  noEmDash,
  oneOf,
  optNumber,
  optStrList,
  preconditions,
  question,
  scopeFor,
  str,
} from "./validate-sections.js";
import type { Raw } from "./validate-sections.js";

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const DEFAULT_THRESHOLDS: Rule["thresholds"] = {
  act: 0.7,
  review: 0.35,
};

// The tier is a fact about the rule, not a choice: a mechanical part alone
// decides in code, a question alone asks Jev, both together make the
// mechanical part a candidate filter.
export const tierOf = (
  mech: Rule["mechanical"] | Rule["check"],
  q: Rule["question"]
): Rule["tier"] => {
  if (mech) {
    return q ? "both" : "mechanical";
  }
  return "jev";
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
  knownKeys(file, "rule", r, [
    "id",
    "title",
    "categoryId",
    "source",
    "scope",
    "unit",
    "mechanical",
    "question",
    "thresholds",
    "severity",
    "fix",
    "preconditions",
    "status",
    "handWritten",
  ]);
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
  const domain = category?.domain as Rule["domain"];
  if (!id.startsWith(`${domain}-`)) {
    fail(file, `id must start with ${domain}- (the domain of ${categoryId})`);
  }
  if (!isRecord(r.source)) {
    fail(file, "source must be an object");
  }
  const s = r.source as Raw;
  knownKeys(file, "source", s, ["repo", "path", "line", "ruleId"]);
  const source: Rule["source"] = {
    line: optNumber(file, s, "line", 1),
    path: str(file, s, "path"),
    repo: str(file, s, "repo"),
  };
  if (s.ruleId !== undefined) {
    source.ruleId = str(file, s, "ruleId");
  }
  const unit = (optStrList(file, r, "unit") ?? []).map((u) =>
    oneOf(file, "unit", u, UNIT_KINDS)
  );
  if (unit.length === 0) {
    fail(file, "unit needs at least one kind");
  }
  const scope = scopeFor(file, unit, r.scope);
  const mech =
    r.mechanical === undefined ? undefined : mechanical(file, r.mechanical);
  const q = r.question === undefined ? undefined : question(file, r.question);
  // Source questions require a candidate filter and bounded complete-file context.
  if (unit.includes("source") && (!mech || unit.length > 1)) {
    fail(
      file,
      "unit source needs a mechanical candidate section and no other unit kind"
    );
  }
  const status = oneOf(file, "status", r.status ?? "active", RULE_STATUSES);
  if (!(mech || q) && status !== "draft") {
    fail(
      file,
      "needs a mechanical section or a question unless status is draft (a check that counts or measures is a code rule in src/rules/code)"
    );
  }
  let thresholds = DEFAULT_THRESHOLDS;
  if (r.thresholds !== undefined) {
    if (!isRecord(r.thresholds)) {
      fail(file, "thresholds must be an object");
    }
    const t = r.thresholds as Raw;
    knownKeys(file, "thresholds", t, ["act", "review"]);
    const act = optNumber(file, t, "act", DEFAULT_THRESHOLDS.act);
    const review = optNumber(file, t, "review", DEFAULT_THRESHOLDS.review);
    if (!(review >= 0 && review < act && act <= 1)) {
      fail(file, "thresholds need 0 <= review < act <= 1");
    }
    thresholds = { act, review };
  }
  const severity = oneOf<Severity>(file, "severity", r.severity, SEVERITIES);
  const f = fix(file, r.fix);
  const pre =
    r.preconditions === undefined
      ? undefined
      : preconditions(file, r.preconditions);
  const handWritten = optStrList(file, r, "handWritten") ?? [];
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
    scope,
    severity,
    source,
    status,
    thresholds: { ...thresholds },
    tier: tierOf(mech, q),
    title,
    unit,
  };
};
