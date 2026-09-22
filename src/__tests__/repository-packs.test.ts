import fs from "node:fs";
import path from "node:path";

import { afterEach, expect, it } from "vitest";

import { Repository } from "../analysis/repository.js";
import { extractSource } from "../extract/index.js";
import { loadConfig } from "../lib/config.js";
import { UnresolvedError } from "../reduce/mechanical.js";
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

// A missing link target is a fact about the repository, so it may block.
// Every other document and instruction port stays review-only until tuned.
it("keeps every document and instruction port review-only until it is tuned", () => {
  const ports = loadRules(path.resolve("data/rules")).filter((r) =>
    /^(?:authoring|copywriting-(?:readme|document))-/.test(r.id)
  );
  expect(ports.filter((r) => r.status === "active").map((r) => r.id)).toEqual([
    "copywriting-document-broken-local-link",
  ]);
});

it("does not serialize repository capabilities into extracted units", () => {
  const fixture = setup({ "README.md": "# Demo\n\nText." });
  const unit = fixture.unit("README.md");
  expect(unit.facts?.document).toBeDefined();
  const serialized = JSON.stringify(unit);
  expect(serialized).not.toContain(fixture.root);
  expect(JSON.parse(serialized)).not.toHaveProperty("facts");
});
