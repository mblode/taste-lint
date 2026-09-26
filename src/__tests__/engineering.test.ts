import fs from "node:fs";
import path from "node:path";

import { afterEach, expect, it } from "vitest";

import { Repository } from "../analysis/repository.js";
import { extractSource } from "../extract/index.js";
import { loadConfig } from "../lib/config.js";
import { planRequests } from "../map/plan.js";
import { jevFindings } from "../reduce/bands.js";
import { runMechanical, UnresolvedError } from "../reduce/mechanical.js";
import { loadRules } from "../rules/load.js";
import { check, config, temporary } from "./helpers.js";

const dirs: string[] = [];
const setup = (files: Record<string, string>) => {
  const root = temporary();
  dirs.push(root);
  for (const [file, source] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), source);
  }
  const repository = new Repository(root);
  return (file: string) =>
    extractSource(loadConfig(root), file, files[file], repository).find(
      (u) => u.kind === "source"
    )!;
};
afterEach(() => {
  for (const root of dirs.splice(0)) {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

const rules = loadRules(path.resolve("data/rules"));
const ruleById = (id: string) => rules.find((r) => r.id === id)!;
const fires = (id: string, file: string, text: string): boolean => {
  const unit = setup({ [file]: text })(file);
  const rule = ruleById(id);
  return rule.check
    ? rule.check(unit).fired
    : runMechanical(rule.mechanical!, unit).fired;
};

it.each([
  ["it('adds', () => { add(1, 2) })", true],
  ["it('adds', () => { expect(add(1, 2)).toBe(3) })", false],
  ["test.each([[1]])('n %i', (n) => { assert.equal(n, 1) })", false],
  [
    "const expectSum = (a) => expect(a).toBe(3)\nit('adds', () => { expectSum(add(1, 2)) })",
    false,
  ],
  [
    "function verify(x) { expect(x).toBeTruthy() }\nit('runs', () => { verify(run()) })",
    false,
  ],
  ["it.skip('later', () => {})", false],
])("assertion-free test: %s", (source, expected) => {
  const unit = setup({ "a.test.ts": source })("a.test.ts");
  expect(check("engineering-test-no-assertion")(unit).fired).toBe(expected);
});

it("flags a test whose only assertion is a snapshot", () => {
  const snapshot = check("engineering-test-snapshot-only");
  const only = setup({
    "b.test.tsx":
      "it('renders', () => { expect(render(<A />)).toMatchSnapshot() })",
  })("b.test.tsx");
  const mixed = setup({
    "c.test.tsx":
      "it('renders', () => { const r = render(<A />); expect(r.text).toBe('x'); expect(r).toMatchSnapshot() })",
  })("c.test.tsx");
  expect(snapshot(only).fired).toBe(true);
  expect(snapshot(mixed).fired).toBe(false);
});

it("counts lines, repeated blocks and commented-out code", () => {
  const big = setup({ "big.ts": "const a = 1;\n".repeat(1001) })("big.ts");
  expect(check("engineering-oversized-file")(big).fired).toBe(true);

  const block = Array.from(
    { length: 8 },
    (_, i) => `  const value${i} = compute(input.field${i}, options.flag${i});`
  ).join("\n");
  const twice = setup({
    "dup.ts": `function a() {\n${block}\n}\nfunction b() {\n${block}\n}\n`,
  })("dup.ts");
  expect(check("engineering-duplicated-block")(twice).evidence).toMatch(
    /repeat lines 2-9/
  );

  const commented = setup({
    "old.ts":
      "// const user = await getUser(id);\n// if (!user) {\n//   return null;\n// }\nexport const x = 1;\n",
  })("old.ts");
  const prose = setup({
    "why.ts":
      "// Stripe retries webhooks for three days,\n// so the handler dedupes on the event id\n// before it writes anything.\nexport const x = 1;\n",
  })("why.ts");
  expect(check("engineering-commented-out-code")(commented).fired).toBe(true);
  expect(check("engineering-commented-out-code")(prose).fired).toBe(false);
});

it("names dependencies no file in the package mentions", () => {
  const unit = setup({
    "node_modules/zod/package.json": "{}",
    "package.json": JSON.stringify({
      dependencies: {
        "left-pad": "1",
        react: "19",
        "react-dom": "19",
        zod: "4",
      },
      scripts: { build: "tsc" },
    }),
    "src/app.ts": 'import { z } from "zod";\nimport React from "react";\n',
  })("package.json");
  expect(check("engineering-unused-dependency")(unit).evidence).toBe(
    "no file under the root names left-pad"
  );
});

it("abstains when no file in the package imports any dependency", () => {
  const unit = setup({
    "node_modules/a/package.json": "{}",
    "package.json": JSON.stringify({ dependencies: { a: "1", b: "1" } }),
  })("package.json");
  expect(() => check("engineering-unused-dependency")(unit)).toThrow(
    UnresolvedError
  );
});

it("abstains on unused dependencies when nothing is installed", () => {
  const unit = setup({
    "package.json": JSON.stringify({ dependencies: { vue: "3" } }),
  })("package.json");
  expect(() => check("engineering-unused-dependency")(unit)).toThrow(
    UnresolvedError
  );
});

it("finds Next.js pages and layouts missing search metadata", () => {
  const files = {
    "app/about/page.tsx":
      "export default function About() { return <p>Hi</p> }",
    "app/blog/layout.tsx":
      "export const metadata = { title: 'Blog' }\nexport default function L({ children }) { return children }",
    "app/blog/page.tsx":
      "export default function Blog() { return <p>Posts</p> }",
    "app/dashboard/page.tsx":
      "export default function D() { return <p>Me</p> }",
    "app/layout.tsx":
      "export const metadata = { title: 'Site', openGraph: { images: ['/og.png'] } }\nexport default function R({ children }) { return children }",
    "app/sitemap.ts": "export default function sitemap() { return [] }",
  };
  const unit = setup(files);
  const page = check("seo-page-missing-metadata");
  expect(page(unit("app/about/page.tsx")).fired).toBe(true);
  expect(page(unit("app/blog/page.tsx")).fired).toBe(false);
  expect(page(unit("app/dashboard/page.tsx")).fired).toBe(false);
  expect(
    check("seo-missing-metadata-base")(unit("app/layout.tsx")).evidence
  ).toBe("metadata sets openGraph with no metadataBase");
  expect(
    check("seo-missing-crawl-files")(unit("app/layout.tsx")).evidence
  ).toBe("no robots for this app");
});

it.each([
  [
    "engineering-test-focused",
    "a.test.ts",
    "describe.only('x', () => {})",
    true,
  ],
  [
    "engineering-test-focused",
    "a.test.ts",
    "describe('only', () => {})",
    false,
  ],
  [
    "engineering-test-self-comparison",
    "a.test.ts",
    "expect(total).toBe(total)",
    true,
  ],
  [
    "engineering-test-self-comparison",
    "a.test.ts",
    "expect(total).toBe(10)",
    false,
  ],
  [
    "engineering-test-self-comparison",
    "a.test.ts",
    "expect(host.author).toBe(host.author)",
    false,
  ],
  [
    "engineering-test-skipped",
    "a.spec.ts",
    'test.skip(process.env.CI === "true", "needs a stack")',
    false,
  ],
  ["engineering-test-skipped", "a.spec.ts", 'it.skip("later", () => {})', true],
  [
    "engineering-test-focused",
    "a.test.ts",
    "const cases = [\"describe.only('x', () => {})\"]",
    false,
  ],
  [
    "engineering-test-self-comparison",
    "a.test.ts",
    "const src = `expect(total).toBe(total)`",
    false,
  ],
  [
    "engineering-test-skipped",
    "a.spec.ts",
    "// it.skip('later', () => {})\nconst s = 'xit(\"later\")'",
    false,
  ],
  [
    "engineering-empty-catch",
    "a.ts",
    "const body = await res.json().catch(() => null)",
    false,
  ],
  [
    "engineering-catch-rethrow",
    "a.ts",
    "try { go() } catch (e) { throw e }",
    true,
  ],
  [
    "engineering-catch-rethrow",
    "a.ts",
    "try { go() } catch (e) { throw new Error('x', { cause: e }) }",
    false,
  ],
  ["engineering-empty-catch", "a.ts", "try { go() } catch {}", true],
  [
    "engineering-empty-catch",
    "a.ts",
    "try { go() } catch { /* optional file */ }",
    false,
  ],
  [
    "engineering-test-no-assertion",
    "a.test.ts",
    "it('caps', () => { if (long.length) { throw new Error('too long') } })",
    false,
  ],
  [
    "engineering-hardcoded-secret",
    "a.ts",
    `const key = "sk_live_${"a".repeat(24)}"`,
    true,
  ],
  [
    "engineering-hardcoded-secret",
    "a.ts",
    "const key = process.env.STRIPE_KEY",
    false,
  ],
  [
    "engineering-ci-no-concurrency",
    ".github/workflows/ci.yml",
    "on:\n  pull_request:\njobs: {}\n",
    true,
  ],
  [
    "engineering-ci-no-concurrency",
    ".github/workflows/ci.yml",
    "on:\n  pull_request:\nconcurrency:\n  group: x\njobs: {}\n",
    false,
  ],
  [
    "engineering-ci-no-concurrency",
    ".github/workflows/labeler.yml",
    "on:\n  pull_request_target:\n    types: [labeled]\njobs: {}\n",
    false,
  ],
  [
    "seo-sitemap-build-time-lastmod",
    "app/sitemap.ts",
    "[{ url, lastModified: new Date() }]",
    true,
  ],
])("%s on %s: %s", (id, file, source, expected) => {
  expect(fires(id, file, source)).toBe(expected);
});

it("ignores `as any` in prose and keeps real casts", () => {
  const bypass = check("engineering-type-bypass");
  const prose = setup({
    "a.ts": "// the same as any other node\nexport const x = 1;\n",
  })("a.ts");
  const cast = setup({ "b.ts": "export const x = (y as any).z;\n" })("b.ts");
  const suppressed = setup({
    "c.ts": "// @ts-ignore\nexport const x = y.z;\n",
  })("c.ts");
  expect(bypass(prose).fired).toBe(false);
  expect(bypass(cast).evidence).toBe("as any");
  expect(bypass(suppressed).fired).toBe(true);
});

it("treats a peer of another dependency as used", () => {
  const unit = setup({
    "next.config.ts": 'export default { plugins: ["rehype-pretty-code"] }',
    "node_modules/rehype-pretty-code/package.json": JSON.stringify({
      peerDependencies: { shiki: "*" },
    }),
    "package.json": JSON.stringify({
      dependencies: { "rehype-pretty-code": "1", shiki: "1" },
    }),
  })("package.json");
  expect(check("engineering-unused-dependency")(unit).fired).toBe(false);
});

it("reads a prose header as prose even when a line ends in a semicolon", () => {
  const unit = setup({
    "a.mjs":
      "// Scans every doc and checks that:\n// - each script exists in the package\n//   nearest the doc (its own scripts);\n// - each link resolves from the doc's directory;\n// Known drift lives in the baseline file.\nexport const x = 1;\n",
  })("a.mjs");
  expect(check("engineering-commented-out-code")(unit).fired).toBe(false);
});

it("skips minified and generated files", () => {
  const minified = setup({ "assets/app.js": `var a=1;${"x".repeat(1200)}\n` })(
    "assets/app.js"
  );
  const marked = setup({
    "api.ts": "// @generated by openapi\nexport const a = 1;\n",
  })("api.ts");
  const written = setup({ "b.ts": "export const a = 1;\n" })("b.ts");
  expect(minified.context.generated).toBe(true);
  expect(marked.context.generated).toBe(true);
  expect(written.context.generated).toBeUndefined();
});

it("reads branch coverage to find modules the tests barely run", () => {
  const root = temporary();
  dirs.push(root);
  const files: Record<string, string> = {
    "src/billing.ts": "export const a = 1;\n",
    "src/pricing.ts": "export const b = 1;\n",
    "src/tax.ts": "export const c = 1;\n",
  };
  const abs = (file: string) => path.join(fs.realpathSync(root), file);
  files["coverage/coverage-summary.json"] = JSON.stringify({
    [abs("src/billing.ts")]: { branches: { covered: 9, total: 10 } },
    [abs("src/pricing.ts")]: { branches: { covered: 2, total: 10 } },
  });
  for (const [file, source] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), source);
  }
  const repository = new Repository(root);
  const unit = (file: string) =>
    extractSource(loadConfig(root), file, files[file], repository).find(
      (u) => u.kind === "source"
    )!;
  const untested = check("engineering-untested-module");
  expect(untested(unit("src/pricing.ts")).evidence).toBe(
    "8 of 10 branches never run in tests"
  );
  expect(untested(unit("src/billing.ts")).fired).toBe(false);
  expect(untested(unit("src/tax.ts")).evidence).toBe(
    "no test loads this module"
  );
});

it("abstains on test gaps without a coverage report, once per run", () => {
  const unit = setup({
    "src/a.ts": "export const a = 1;\n",
    "src/b.ts": "export const b = 1;\n",
  });
  expect(() => check("engineering-untested-module")(unit("src/a.ts"))).toThrow(
    UnresolvedError
  );
  const plan = planRequests(
    [unit("src/a.ts"), unit("src/b.ts")],
    [ruleById("engineering-untested-module")],
    config("src/a.ts")
  );
  expect(plan.unknowns.map((u) => u.file)).toEqual(["src/a.ts"]);
  expect(plan.skipped.get(unit("src/b.ts").id)).toEqual({
    "engineering-untested-module": "precondition",
  });
});

it("judges a long file on a window around the candidate, under the file's id", () => {
  const filler = "export const pad = 1;\n".repeat(3000);
  const loop =
    "for (const id of ids) {\n  const user = await db.user.findUnique({ where: { id } });\n}\n";
  const file = "src/load.ts";
  const unit = setup({ [file]: `${filler}${loop}${filler}` })(file);
  const plan = planRequests(
    [unit],
    [ruleById("engineering-query-in-loop")],
    config(unit.file)
  );
  expect(plan.unknowns).toEqual([]);
  const [job] = plan.jobs;
  expect(job.unit.id).toBe(unit.id);
  expect(job.unit.text).toContain("findUnique");
  expect(job.unit.text.length).toBeLessThan(unit.text.length);
  const answers = new Map([[unit.id, { "engineering-query-in-loop": 0.9 }]]);
  const [finding] = jevFindings(plan.jobs, answers).findings;
  expect(finding).toMatchObject({ column: 1, line: 3001 });
});
