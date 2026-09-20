import fs from "node:fs";
import path from "node:path";

import { afterEach, expect, it } from "vitest";

import { Repository } from "../analysis/repository.js";
import { extractSource } from "../extract/index.js";
import { loadConfig } from "../lib/config.js";
import { runLint } from "../lint.js";
import { UnresolvedError } from "../reduce/mechanical.js";
import { discoverSkills } from "../rules/discover.js";
import { loadRules } from "../rules/load.js";
import { check, temporary } from "./helpers.js";

const dirs: string[] = [];
const setup = (files: Record<string, string>) => {
  const root = temporary();
  dirs.push(root);
  for (const [file, source] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), source);
  }
  const repository = new Repository(root);
  return {
    root,
    unit: (file: string) =>
      extractSource(loadConfig(root), file, files[file], repository).find(
        (u) => u.kind === "source"
      )!,
  };
};
afterEach(() => {
  for (const root of dirs.splice(0)) {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

it.each([
  [
    "copywriting-readme-scaffold",
    "README.md",
    "# Demo\n\nThis is a Next.js project bootstrapped with create-next-app.",
    "# Demo\n\nConvert images to SVG.",
  ],
  [
    "copywriting-readme-description",
    "README.md",
    "# Demo\n\n## Install\n\nUse npm.",
    "# Demo\n\nConvert images.\n\n## Install\n\nUse npm.",
  ],
  [
    "copywriting-readme-quickstart-elision",
    "README.md",
    "## Quickstart\n\n```js\n...\n```",
    "## Quickstart\n\n```js\nconsole.log('ok');\n```",
  ],
  [
    "copywriting-document-empty-heading",
    "docs/guide.md",
    "# Demo\n\n## Setup\n\n## Run\n\nRun it.",
    "# Demo\n\n## Setup\n\nInstall it.",
  ],
  [
    "copywriting-document-heading-order",
    "docs/guide.md",
    "# Demo\n\n### Setup\n\nInstall it.",
    "# Demo\n\n## Setup\n\nInstall it.",
  ],
  [
    "authoring-skill-frontmatter",
    "skills/demo/SKILL.md",
    "# Demo",
    "---\nname: demo\ndescription: Run the demo\n---\n# Demo",
  ],
  [
    "dx-exports-mixed-keys",
    "package.json",
    '{"exports":{".":"./index.js","import":"./index.js"}}',
    '{"exports":{".":{"import":"./index.js"}}}',
  ],
])("%s distinguishes the documented failure", (id, file, bad, good) => {
  expect(check(id)(setup({ [file]: bad }).unit(file)).fired).toBe(true);
  expect(check(id)(setup({ [file]: good }).unit(file)).fired).toBe(false);
});

it("resolves local Markdown links relative to the document and ignores remote routes", () => {
  const fixture = setup({
    "docs/guide.md":
      "[guide](other.md)\n\n[site](https://example.com/missing.md)",
    "docs/other.md": "Present",
  });
  expect(
    check("copywriting-document-broken-local-link")(
      fixture.unit("docs/guide.md")
    ).fired
  ).toBe(false);
  const broken = setup({ "docs/guide.md": "[guide](other.md)" });
  expect(
    check("copywriting-document-broken-local-link")(
      broken.unit("docs/guide.md")
    )
  ).toMatchObject({ fired: true, offset: 0 });
});

it("checks instruction commands against the nearest package and skips explicit workspace commands", () => {
  const files = {
    "AGENTS.md": "Run `npm run missing`.",
    "CLAUDE.md": "Run `npm run test`.",
    "package.json": '{"scripts":{"test":"vitest"}}',
    "skills/demo/SKILL.md": "Run `npm run missing --workspace web`.",
  };
  const fixture = setup(files);
  expect(
    check("authoring-instruction-missing-script")(fixture.unit("AGENTS.md"))
      .fired
  ).toBe(true);
  expect(
    check("authoring-instruction-missing-script")(fixture.unit("CLAUDE.md"))
      .fired
  ).toBe(false);
  expect(
    check("authoring-instruction-missing-script")(
      fixture.unit("skills/demo/SKILL.md")
    ).fired
  ).toBe(false);
});

it("compares install names only for a known non-private package", () => {
  const fixture = setup({
    "README.md": "## Install\n\n```sh\nnpm install old-name\n```",
    "package.json": '{"name":"new-name"}',
  });
  expect(
    check("copywriting-readme-install-name")(fixture.unit("README.md")).fired
  ).toBe(true);
  const privatePackage = setup({
    "README.md": "## Install\n\n```sh\nnpm install public-name\n```",
    "package.json": '{"name":"workspace","private":true}',
  });
  expect(() =>
    check("copywriting-readme-install-name")(privatePackage.unit("README.md"))
  ).toThrow(UnresolvedError);
});

it("checks artifact entries and shebangs without treating unbuilt outputs as defects", () => {
  const missing = setup({ "package.json": '{"main":"missing.js"}' });
  expect(
    check("dx-package-entry-target")(missing.unit("package.json")).fired
  ).toBe(true);
  const unbuilt = setup({
    "package.json": '{"main":"dist/index.js","scripts":{"build":"tsdown"}}',
  });
  expect(() =>
    check("dx-package-entry-target")(unbuilt.unit("package.json"))
  ).toThrow(UnresolvedError);
  for (const [source, failed] of [
    ["console.log('hi')", true],
    ["#!/usr/bin/env node\nconsole.log('hi')", false],
    ["#!/usr/bin/env node\n#!/usr/bin/env node", true],
  ] as const) {
    const fixture = setup({
      "cli.js": source,
      "package.json": '{"bin":"cli.js"}',
    });
    expect(
      check("dx-package-bin-shebang")(fixture.unit("package.json")).fired
    ).toBe(failed);
  }
});

it("parses imports without flagging comments or string examples", () => {
  const fixture = setup({
    "index.js":
      '// import x from "missing"\nconst example = \'import x from "missing"\';\nimport fs from "node:fs";\nimport known from "known";',
    "package.json": '{"dependencies":{"known":"1"}}',
  });
  expect(
    check("architecture-undeclared-import")(fixture.unit("index.js")).fired
  ).toBe(false);
  const missing = setup({
    "index.ts": 'import absent from "absent";',
    "package.json": "{}",
  });
  expect(
    check("architecture-undeclared-import")(missing.unit("index.ts"))
  ).toMatchObject({ fired: true, offset: 0 });
  const aliases = setup({
    "index.ts": 'import aliased from "aliased";',
    "package.json": "{}",
    "tsconfig.json": "{}",
  });
  expect(() =>
    check("architecture-undeclared-import")(aliases.unit("index.ts"))
  ).toThrow(UnresolvedError);
});

it("detects relative imports across declared package roots", () => {
  const fixture = setup({
    "packages/a/index.ts": 'import b from "../b/index.js";',
    "packages/a/local.ts": 'import a from "./index.js";',
    "packages/a/package.json": '{"name":"a"}',
    "packages/b/package.json": '{"name":"b"}',
  });
  expect(
    check("architecture-cross-package-relative-import")(
      fixture.unit("packages/a/index.ts")
    ).fired
  ).toBe(true);
  expect(
    check("architecture-cross-package-relative-import")(
      fixture.unit("packages/a/local.ts")
    ).fired
  ).toBe(false);
});

it("checks local config references and abstains on JSONC", () => {
  const fixture = setup({
    "base.json": "{}",
    "tsconfig.json": '{"references":[{"path":"./missing"}],"extends":"./base"}',
  });
  expect(
    check("architecture-missing-tsconfig-reference")(
      fixture.unit("tsconfig.json")
    ).fired
  ).toBe(true);
  expect(
    check("architecture-missing-local-config-extends")(
      fixture.unit("tsconfig.json")
    ).fired
  ).toBe(false);
  const jsonc = setup({ "tsconfig.json": "{/* comment */}" });
  expect(() =>
    check("architecture-missing-tsconfig-reference")(
      jsonc.unit("tsconfig.json")
    )
  ).toThrow(UnresolvedError);
});

it("refuses repository reads through paths and symlinks outside the root", () => {
  const fixture = setup({ "README.md": "Text" });
  const external = setup({ "private.md": "Not scanned" });
  fs.symlinkSync(
    path.join(external.root, "private.md"),
    path.join(fixture.root, "link.md")
  );
  const repository = new Repository(fixture.root);
  expect(repository.read("link.md")).toBeUndefined();
  expect(repository.exists("link.md")).toBe(false);
  expect(repository.resolve("README.md", "../private.md")).toBeUndefined();
});

it("discovers alternative rule directories and references without executing their content", () => {
  const fixture = setup({
    "skills/demo/SKILL.md": "---\nname: demo\ndescription: Demo\n---\n# Demo",
    "skills/demo/evals/fixture.md": "# Exclude",
    "skills/demo/references/notes.md": "# Notes\n\n## Details",
    "skills/demo/rules-ax/check.md": "---\ntitle: Check\n---\n## Rule",
  });
  const entries = discoverSkills(fixture.root, []);
  expect(entries.map((e) => e.kind).toSorted()).toEqual([
    "entrypoint",
    "guidance",
    "rule",
  ]);
  expect(entries.every((e) => e.status === "needs-triage")).toBe(true);
});

it("reports source-only repository findings and unknowns without provider calls", async () => {
  const fixture = setup({
    "package.json":
      '{"main":"dist/index.js","scripts":{"build":"tsdown"},"exports":{".":"./index.js","import":"./index.js"}}',
  });
  const result = await runLint({
    mechanicalOnly: true,
    only: ["dx-exports-mixed-keys", "dx-package-entry-target"],
    root: fixture.root,
    targets: ["package.json"],
  });
  expect(result.ruleFindings).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        band: "review",
        ruleId: "dx-exports-mixed-keys",
      }),
    ])
  );
  expect(result.unknowns).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ ruleId: "dx-package-entry-target" }),
    ])
  );
  expect(result.usage.requests).toBe(0);
  expect(
    loadRules(path.resolve("data/rules"))
      .filter((r) => /^(?:architecture|dx|authoring)-/.test(r.id))
      .every((r) => r.status === "review-only")
  ).toBe(true);
});

it("enforces only declared architecture boundaries and deprecations", () => {
  const fixture = setup({
    "src/consumer.ts": 'import old from "old-sdk";',
    "src/data/store.ts": 'import { handler } from "../http/handler.js";',
    "src/generated/good.ts":
      "// GENERATED: npm run codegen\nexport type ID = string;",
    "src/generated/types.ts": "export type ID = string;",
    "taste-lint.config.json": JSON.stringify({
      architecture: {
        boundaries: [
          {
            disallow: "src/http/**",
            from: "src/data/**",
            reason: "Data must not import transport",
          },
        ],
        deprecatedImports: { "old-sdk": "new-sdk" },
        generated: ["src/generated/**"],
      },
    }),
  });
  const config = loadConfig(fixture.root);
  const repository = new Repository(fixture.root, config.architecture);
  const get = (file: string) =>
    extractSource(
      config,
      file,
      fs.readFileSync(path.join(fixture.root, file), "utf-8"),
      repository
    ).find((u) => u.kind === "source")!;
  expect(
    check("architecture-declared-import-boundary")(get("src/data/store.ts"))
      .fired
  ).toBe(true);
  expect(
    check("architecture-deprecated-import")(get("src/consumer.ts")).fired
  ).toBe(true);
  expect(
    check("architecture-generated-regeneration-hint")(
      get("src/generated/types.ts")
    ).fired
  ).toBe(true);
  expect(
    check("architecture-generated-regeneration-hint")(
      get("src/generated/good.ts")
    ).fired
  ).toBe(false);
  expect(
    check("architecture-declared-import-boundary")(
      fixture.unit("src/data/store.ts")
    ).fired
  ).toBe(false);
});

it("rejects malformed architecture contracts before scanning", () => {
  for (const architecture of [
    { boundaries: [{ disallow: "x", from: "src/**" }] },
    { generated: "src/**" },
    { deprecatedImports: { old: false } },
    { boundries: [] },
  ]) {
    const fixture = setup({
      "taste-lint.config.json": JSON.stringify({ architecture }),
    });
    expect(() => loadConfig(fixture.root)).toThrow(/architecture/);
  }
});

it("does not serialize repository capabilities into extracted units", () => {
  const fixture = setup({ "README.md": "# Demo\n\nText." });
  const unit = fixture.unit("README.md");
  expect(unit.facts?.document).toBeDefined();
  const serialized = JSON.stringify(unit);
  expect(serialized).not.toContain(fixture.root);
  expect(JSON.parse(serialized)).not.toHaveProperty("facts");
});
