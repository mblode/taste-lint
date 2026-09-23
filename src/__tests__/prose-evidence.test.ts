import path from "node:path";

import { describe, expect, it } from "vitest";

import { Repository } from "../analysis/repository.js";
import { extractSource } from "../extract/index.js";
import { planRequests } from "../map/plan.js";
import { buildState } from "../map/state.js";
import { runMechanical } from "../reduce/mechanical.js";
import { loadRules } from "../rules/load.js";
import type { Unit } from "../types.js";
import { config } from "./helpers.js";

const rules = loadRules(path.resolve("data/rules"));
const rule = (id: string) => {
  const found = rules.find((r) => r.id === id);
  if (!found) {
    throw new Error(`No rule ${id}`);
  }
  return found;
};
const units = (file: string, text: string): Unit[] =>
  extractSource(
    config(process.cwd()),
    file,
    text,
    new Repository(process.cwd())
  ).filter((u) => u.kind !== "source");
const byText = (list: Unit[], start: string): Unit => {
  const found = list.find((u) => u.text.startsWith(start));
  if (!found) {
    throw new Error(`No unit starting ${start}`);
  }
  return found;
};

const PAGE = `# Northwind

When two people edit the same file offline, Northwind keeps both versions side by side.

## Pricing

It costs $8 per seat per month.

## Conflicts

Conflicting edits are never overwritten: you keep both versions, side by side, when two people edit offline.

Available for macOS and Windows.
`;

describe("earlier-sentence evidence", () => {
  const list = units("page.md", PAGE);

  it("gives a later echo the sentence it repeats", () => {
    const echo = byText(list, "Conflicting edits");
    expect(echo.context.earlier).toContain("keeps both versions side by side");
    expect(rule("copywriting-idea-repetition").check?.(echo).fired).toBe(true);
  });

  it("gives a first mention nothing, so Jev is never asked", () => {
    for (const first of ["When two people", "It costs", "Available for"]) {
      const unit = byText(list, first);
      expect(unit.context.earlier).toBeUndefined();
      expect(rule("copywriting-idea-repetition").check?.(unit).fired).toBe(
        false
      );
    }
  });

  it("never offers a heading as the earlier sentence", () => {
    const body = units(
      "b.md",
      "## Both versions kept side by side\n\nNorthwind keeps both versions of a conflicting file.\n"
    );
    expect(byText(body, "Northwind keeps").context.earlier).toBeUndefined();
  });

  it("puts the evidence in the state only when the question asks", () => {
    const echo = byText(list, "Conflicting edits");
    expect(
      buildState(echo, [rule("copywriting-idea-repetition")]).state
    ).toContain("EARLIER: When two people");
    expect(
      buildState(echo, [rule("copywriting-generic-language")]).state
    ).not.toContain("EARLIER:");
  });
});

describe("brief evidence", () => {
  const [label] = units(
    "settings.tsx",
    "export const S = () => <label>Relay only</label>;"
  );

  it("does not judge invented capability without a brief", () => {
    expect(rule("copywriting-invented-capability").check?.(label!).fired).toBe(
      false
    );
  });

  it("sends the brief with the text when one is given", () => {
    const briefed = {
      ...label!,
      context: {
        ...label!.context,
        brief: "Local network first, relay fallback.",
      },
    };
    expect(rule("copywriting-invented-capability").check?.(briefed).fired).toBe(
      true
    );
    expect(
      buildState(briefed, [rule("copywriting-invented-capability")]).state
    ).toContain("BRIEF: Local network first");
  });
});

describe("prose rules read prose, not labels", () => {
  const list = units(
    "landing.tsx",
    `export const L = () => (<main>
      <p>A little care for every file you share.</p>
      <button>Start free trial</button>
      <span>/ seat / month</span>
    </main>);`
  );

  it("judges a JSX sentence and skips a short label", () => {
    const plan = planRequests(
      list,
      [rule("copywriting-generic-language")],
      config(".")
    );
    const judged = plan.jobs.map((job) => job.unit.text);
    expect(judged).toContain("A little care for every file you share.");
    expect(judged).not.toContain("Start free trial");
    expect(judged).not.toContain("/ seat / month");
  });

  it("skips a greeting in Markdown", () => {
    const plan = planRequests(
      units(
        "email.md",
        "Hi,\n\nNorthwind keeps both versions of every file you edit.\n"
      ),
      [rule("copywriting-generic-language")],
      config(".")
    );
    expect(plan.jobs.map((job) => job.unit.text)).toEqual([
      "Northwind keeps both versions of every file you edit.",
    ]);
  });
});

describe.each([
  ["A folder, not a portal.", true],
  ["A shared folder. Not another place to work.", true],
  ["Conflicts are kept, not resolved for you.", true],
  ["Use their numbers, not generic benchmarks.", true],
  ["Northwind keeps both versions side by side.", false],
  ["It is not ready yet.", false],
])("antithesis candidates: %s", (text, candidate) => {
  it(candidate ? "is sent to Jev" : "is not a candidate", () => {
    const { mechanical } = rule("copywriting-antithesis-contrast");
    expect(
      runMechanical(mechanical!, {
        ...units("a.md", `${text}\n`)[0]!,
        codeSpans: [],
        text,
      }).fired
    ).toBe(candidate);
  });
});
