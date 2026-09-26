// Which files and rules the code profile reads.

import path from "node:path";

import { expect, it } from "vitest";

import { matchesAny } from "../lib/glob.js";
import { loadRules } from "../rules/load.js";
import { profileFor, profileRules } from "../scan/profiles.js";

const rules = loadRules(path.resolve("data/rules"));
const ruleById = (id: string) => rules.find((r) => r.id === id)!;

it("keeps engineering rules out of the product profile and in code", () => {
  const product = profileRules(profileFor("product"), rules).map(
    (r) => r.domain
  );
  const code = profileRules(profileFor("code"), rules).map((r) => r.domain);
  expect(product).not.toContain("engineering");
  expect(product).toContain("seo");
  expect(new Set(code)).toEqual(new Set(["engineering"]));
});

it("reads every file the secret rule covers under the code profile", () => {
  const profile = profileFor("code");
  const secret = ruleById("engineering-hardcoded-secret");
  for (const file of [
    ".env",
    "apps/web/.env.production",
    "config/app.yml",
    "wrangler.toml",
    "src/keys.json",
  ]) {
    expect(matchesAny(file, secret.scope.include)).toBe(true);
    expect(matchesAny(file, profile.include)).toBe(true);
    expect(matchesAny(file, profile.exclude)).toBe(false);
  }
});

it("lets a rule about tests read test files, and only that rule", () => {
  expect(ruleById("engineering-test-focused").scope.exclude).not.toContain(
    "**/*.test.*"
  );
  expect(ruleById("engineering-empty-catch").scope.exclude).toContain(
    "**/*.test.*"
  );
});
