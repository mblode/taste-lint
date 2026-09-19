// Fail-closed rule validation. Any problem throws with the file path so a bad
// rule aborts the run before a single request is made. Field validators live
// in validate-sections.ts.

import {
  DOMAINS,
  RULE_STATUSES,
  SEVERITIES,
  TIERS,
  UNIT_KINDS,
} from "../types.js";
import type { Domain, Rule, Severity, Tier } from "../types.js";
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
  str,
} from "./validate-sections.js";
import type { Raw } from "./validate-sections.js";

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
    "domain",
    "source",
    "related",
    "scope",
    "unit",
    "tier",
    "mechanical",
    "question",
    "thresholds",
    "severity",
    "severityOverrides",
    "fix",
    "preconditions",
    "status",
    "handWritten",
    "portNotes",
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
  knownKeys(file, "source", s, ["repo", "path", "line", "ruleId", "tier"]);
  const source: Rule["source"] = {
    line: optNumber(file, s, "line", 1),
    path: str(file, s, "path"),
    repo: str(file, s, "repo"),
  };
  if (s.ruleId !== undefined) {
    source.ruleId = str(file, s, "ruleId");
  }
  if (s.tier !== undefined) {
    source.tier = str(file, s, "tier");
  }
  if (!isRecord(r.scope)) {
    fail(file, "scope must be an object with include");
  }
  knownKeys(file, "scope", r.scope as Raw, ["include", "exclude"]);
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
  // Jev never sees a whole file: source-unit rules are mechanical and only
  // ever pattern-match raw markup.
  if (unit.includes("source") && (tier !== "mechanical" || unit.length > 1)) {
    fail(file, "unit source needs tier mechanical and no other unit kind");
  }
  const mech =
    r.mechanical === undefined ? undefined : mechanical(file, r.mechanical);
  const q = r.question === undefined ? undefined : question(file, r.question);
  if (tier !== "jev" && !mech) {
    fail(
      file,
      `tier ${tier} needs a mechanical section (a check that counts or measures is a code rule in src/rules/code)`
    );
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
    knownKeys(file, "thresholds", t, ["act", "review"]);
    const act = optNumber(file, t, "act", 0.7);
    const review = optNumber(file, t, "review", 0.35);
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
      knownKeys(file, "severityOverrides", o as Raw, ["scope", "severity"]);
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
