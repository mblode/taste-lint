import fs from "node:fs";
import path from "node:path";

import { afterEach, expect, it } from "vitest";

import { loadConfig } from "../lib/config.js";
import { runLint } from "../lint.js";
import { renderTty } from "../report/tty.js";
import { temporary } from "./helpers.js";

const roots: string[] = [];
const fixture = () => {
  const root = temporary();
  roots.push(root);
  fs.writeFileSync(path.join(root, "note.md"), 'A "quoted" word.\n');
  return {
    only: ["typography-straight-quotes"],
    resultsDir: path.join(root, "results"),
    root,
    targets: ["note.md"],
  };
};
afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { force: true, recursive: true });
  }
});
it("uses the same threshold for the exit and the report", async () => {
  const result = await runLint({ ...fixture(), failOn: "major" });
  expect(result.exitCode).toBe(0);
  expect(renderTty(result)).toContain("PASS");
  expect(renderTty(result)).not.toContain("FAIL");
});
it("rejects a missing target instead of reporting a clean scan", async () => {
  await expect(
    runLint({ ...fixture(), targets: ["missing"] })
  ).rejects.toMatchObject({ code: "TARGET_NOT_FOUND" });
});
it("validates nested config before extracting or calling a provider", () => {
  const { root } = fixture();
  fs.writeFileSync(
    path.join(root, "taste-lint.config.json"),
    JSON.stringify({ exclude: "docs/**" })
  );
  expect(() => loadConfig(root)).toThrow(/exclude/);
});

it("can finish entirely from cache without credentials", async () => {
  const opts = {
    ...fixture(),
    only: ["copywriting-generic-framing"],
  };
  const { fakeEvaluate } = await import("./helpers.js");
  await runLint(opts, { evaluate: fakeEvaluate(() => 0.8) });
  const replay = await runLint(opts);
  expect(replay.status).toBe("complete");
  expect(replay.usage.requests).toBe(0);
  expect(replay.usage.cached).toBeGreaterThan(0);
});

it("preserves every same-category finding while bounding the human view", async () => {
  const opts = {
    ...fixture(),
    only: ["copywriting-unnatural-polish", "copywriting-generic-language"],
  };
  const { fakeEvaluate } = await import("./helpers.js");
  const result = await runLint(opts, { evaluate: fakeEvaluate(() => 0.9) });
  expect(result.ruleFindings).toHaveLength(2);
  expect(result.findings).toHaveLength(1);
  const findings = Array.from({ length: 10_000 }, (_, i) => ({
    ...result.findings[0],
    file: `file-${i}.md`,
    unitId: `${i}`,
  }));
  const large = { ...result, findings, reportPath: "/tmp/full.json" };
  expect(renderTty(large)).toContain("10000 review notes from 1 rule");
  expect(renderTty(large)).not.toContain("file-9999.md");
  expect(renderTty(large)).toContain("/tmp/full.json");
  expect(renderTty(large).length).toBeLessThan(15_000);
  expect(renderTty(large, { verbose: true })).toContain("file-9999.md");
});

it("reports an empty scope explicitly", async () => {
  const opts = fixture();
  const result = await runLint({ ...opts, exclude: ["**/*.md"] });
  expect(result.scope?.excluded).toBe(1);
  expect(renderTty(result)).toContain("NO SCAN");
  expect(renderTty(result)).not.toContain("PASS");
});

it("keeps config schema fields and document types in sync", async () => {
  const { DOC_TYPES } = await import("../types.js");
  const { validateConfig } = await import("../lib/config.js");
  const schema = JSON.parse(
    fs.readFileSync(
      path.resolve(import.meta.dirname, "../../data/config.schema.json"),
      "utf-8"
    )
  );
  expect(schema.properties.docTypes.items.properties.type.enum).toEqual([
    ...DOC_TYPES,
  ]);
  const valid = {
    $schema: "schema.json",
    components: { skip: [], unwrap: [] },
    docTypes: [{ glob: "**/*.md", type: "reference" }],
    exclude: ["docs/**"],
    rules: ["~/voice"],
    smartQuotesAtBuild: false,
    tailwind: { theme: { sm: "14px" } },
  };
  expect(Object.keys(valid).toSorted()).toEqual(
    Object.keys(schema.properties).toSorted()
  );
  expect(() => validateConfig(valid)).not.toThrow();
  for (const bad of [
    { unknown: true },
    { components: { skip: "No" } },
    { docTypes: [{ glob: "*", type: "bogus" }] },
    { tailwind: { theme: { sm: 14 } } },
    { rules: "voice" },
  ]) {
    expect(() => validateConfig(bad)).toThrow(/taste-lint.config.json/);
  }
});

it("does not let a grouped minor finding hide a failing major rule", async () => {
  const opts = fixture();
  // Use a temporary rule pack so two same-category mechanical findings tie.
  const rulesDir = path.join(opts.root, "rules");
  fs.mkdirSync(path.join(rulesDir, "copywriting"), { recursive: true });
  const { stringify } = await import("yaml");
  for (const [id, severity] of [
    ["copywriting-a", "minor"],
    ["copywriting-b", "major"],
  ]) {
    fs.writeFileSync(
      path.join(rulesDir, "copywriting", `${id}.yaml`),
      stringify({
        categoryId: "machine-prose",
        fix: { hint: "Review" },
        id,
        mechanical: { flags: "gu", regex: "word" },
        severity,
        source: { line: 1, path: "fixture", repo: "test/test" },
        status: "active",
        title: "Fixture",
        unit: ["paragraph"],
      })
    );
  }
  const result = await runLint({
    ...opts,
    failOn: "major",
    only: ["copywriting-a", "copywriting-b"],
    rulesDir,
  });
  expect(result.summary?.failing).toBe(1);
  expect(result.exitCode).toBe(1);
  expect(result.ruleFindings).toHaveLength(2);
  expect(result.findings).toHaveLength(1);
});
