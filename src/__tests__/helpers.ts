import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { vi } from "vitest";

import { CODE_RULES } from "../rules/code/index.js";
import type {
  Config,
  Evaluate,
  MechanicalHit,
  Rule,
  SystemOneRequest,
  Unit,
} from "../types.js";

// The check of a code rule, by id, for unit-level tests.
export const check = (id: string): ((unit: Unit) => MechanicalHit) => {
  const found = CODE_RULES.find((r) => r.id === id);
  if (!found?.check) {
    throw new Error(`No code rule ${id}`);
  }
  return found.check;
};

export const FIXTURES = path.join(import.meta.dirname, "fixtures");

export const temporary = (): string =>
  fs.mkdtempSync(path.join(os.tmpdir(), "slop-cop-test-"));

export const config = (
  root: string,
  overrides: Partial<Config> = {}
): Config => ({
  components: {
    skip: ["ExerciseRun", "JudgementExercise"],
    unwrap: ["Callout"],
  },
  docTypes: [
    { glob: "**/*.mdx", type: "lesson" },
    { glob: "**/*.tsx", type: "ui" },
  ],
  exclude: [],
  root,
  smartQuotesAtBuild: false,
  tailwind: { theme: {} },
  ...overrides,
});

export const rule = (overrides: Partial<Rule> = {}): Rule => ({
  categoryId: "evidence-over-claims",
  domain: "copywriting",
  file: "/unused.yaml",
  fix: { hint: "Cut it.", mode: "none" },
  handWritten: [],
  id: "copywriting-test-rule",
  question: {
    criteria: {
      false: { examples: ["checked"], what: "checkable" },
      true: { examples: ["unchecked"], what: "unchecked" },
    },
    instructions: "Is the TEXT an unchecked claim?",
    type: "noul",
  },
  scope: { include: ["**/*"] },
  severity: "minor",
  source: { line: 1, path: "fixture", repo: "test/test" },
  status: "active",
  thresholds: { act: 0.7, review: 0.35 },
  tier: "jev",
  title: "Test rule",
  unit: ["paragraph", "heading", "jsx-text", "attr-string"],
  ...overrides,
});

// An Evaluate that answers each question from `answers` (by rule id) and
// records every request it saw.
export const fakeEvaluate = (
  answers: Record<string, number> | ((ruleId: string, state: string) => number),
  usage = 100
): Evaluate & { calls: SystemOneRequest[] } => {
  const calls: SystemOneRequest[] = [];
  const evaluate = ((request: SystemOneRequest) => {
    calls.push(request);
    const out: Record<string, { noul: number; type: "noul" }> = {};
    for (const id of Object.keys(request.questions)) {
      const noul =
        typeof answers === "function"
          ? answers(id, String(request.state))
          : (answers[id] ?? 0);
      out[id] = { noul, type: "noul" };
    }
    return Promise.resolve({
      answers: out,
      model: request.model,
      usage: { input_tokens: usage, output_tokens: 0 },
    });
  }) as Evaluate & { calls: SystemOneRequest[] };
  evaluate.calls = calls;
  return evaluate;
};

export const silence = (): void => {
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
};

export const copyFixtures = (root: string, names: string[]): void => {
  for (const name of names) {
    fs.cpSync(path.join(FIXTURES, name), path.join(root, name), {
      recursive: true,
    });
  }
};
