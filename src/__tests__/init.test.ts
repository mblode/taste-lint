import fs from "node:fs";
import path from "node:path";

import { afterEach, expect, it } from "vitest";

import { initProject } from "../setup/init.js";
import { temporary } from "./helpers.js";

const roots: string[] = [];
function project(manifest = {}) {
  const root = temporary();
  roots.push(root);
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify(manifest));
  return root;
}
afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { force: true, recursive: true });
  }
});
it("previews detected setup without writing or installing", () => {
  const root = project({ dependencies: { next: "16" } });
  fs.writeFileSync(path.join(root, "pnpm-lock.yaml"), "");
  const before = fs.readFileSync(path.join(root, "package.json"), "utf-8");
  expect(initProject({ agent: true, dryRun: true, root })).toMatchObject({
    agentAdded: true,
    packageManager: "pnpm",
    profile: "product",
    scriptsAdded: ["taste"],
  });
  expect(fs.readFileSync(path.join(root, "package.json"), "utf-8")).toBe(
    before
  );
  expect(fs.existsSync(path.join(root, "AGENTS.md"))).toBe(false);
});
it("preserves existing scripts and instructions and is idempotent", () => {
  const root = project({
    scripts: { "check:taste": "custom", test: "vitest" },
  });
  fs.writeFileSync(path.join(root, "AGENTS.md"), "Keep this guidance.");
  initProject({ agent: true, install: false, root });
  const manifest = fs.readFileSync(path.join(root, "package.json"), "utf-8");
  const agents = fs.readFileSync(path.join(root, "AGENTS.md"), "utf-8");
  expect(JSON.parse(manifest).scripts).toEqual({
    "check:taste": "custom",
    taste: "taste-lint lint --profile writing",
    test: "vitest",
  });
  expect(agents).toContain("Keep this guidance.");
  expect(initProject({ agent: true, install: false, root })).toMatchObject({
    agentAdded: false,
    scriptsAdded: [],
  });
  expect(fs.readFileSync(path.join(root, "package.json"), "utf-8")).toBe(
    manifest
  );
  expect(fs.readFileSync(path.join(root, "AGENTS.md"), "utf-8")).toBe(agents);
});
it("requires a choice for conflicting lockfiles and honors packageManager", () => {
  const root = project();
  fs.writeFileSync(path.join(root, "yarn.lock"), "");
  fs.writeFileSync(path.join(root, "package-lock.json"), "{}");
  expect(() => initProject({ dryRun: true, root })).toThrow(
    "Multiple lockfiles"
  );
  expect(initProject({ dryRun: true, pm: "bun", root }).packageManager).toBe(
    "bun"
  );
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ packageManager: "pnpm@10.0.0" })
  );
  expect(initProject({ dryRun: true, root }).packageManager).toBe("pnpm");
});
it("rejects invalid input before writes and skips existing dependencies", () => {
  const root = project({ scripts: [] });
  expect(() => initProject({ install: false, root })).toThrow(
    "scripts must be an object"
  );
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ devDependencies: { "taste-lint": "^0.0.3" } })
  );
  expect(initProject({ dryRun: true, root }).installCommand).toBeNull();
  expect(() => initProject({ dryRun: true, pm: "bad", root })).toThrow(
    "Choose --pm"
  );
});
it("adds a lefthook job without disturbing existing jobs, once", () => {
  const root = project({ dependencies: { next: "16" } });
  const file = path.join(root, "lefthook.yml");
  fs.writeFileSync(
    file,
    "# Keep this comment.\npre-commit:\n  parallel: true\n  jobs:\n    - run: npx oxlint {staged_files}\n"
  );
  const result = initProject({ hook: "lefthook", install: false, root });
  expect(result.hook).toMatchObject({
    files: ["lefthook.yml"],
    name: "lefthook",
  });
  const written = fs.readFileSync(file, "utf-8");
  expect(written).toContain("# Keep this comment.");
  expect(written).toContain("npx oxlint {staged_files}");
  expect(written).toContain(
    'name: taste-lint\n      glob: "*.{tsx,jsx,css,scss}"\n      run: npx taste-lint lint --staged --profile product --dry-run'
  );
  initProject({ hook: "lefthook", install: false, root });
  expect(fs.readFileSync(file, "utf-8")).toBe(written);
});
it("appends to a husky hook and adds the prepare script", () => {
  const root = project({ scripts: {} });
  fs.writeFileSync(path.join(root, "pnpm-lock.yaml"), "");
  fs.mkdirSync(path.join(root, ".husky"));
  const hook = path.join(root, ".husky", "pre-commit");
  fs.writeFileSync(hook, "pnpm exec lint-staged");
  const result = initProject({ hook: "husky", install: false, root });
  expect(result.hook?.notes).toContain(
    "Run pnpm exec husky to activate the hook."
  );
  expect(fs.readFileSync(hook, "utf-8")).toBe(
    "pnpm exec lint-staged\n# taste-lint\npnpm exec taste-lint lint --staged --profile writing --dry-run\n"
  );
  expect(fs.statSync(hook).mode & 0o111).not.toBe(0);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf-8")
  );
  expect(manifest.scripts.prepare).toBe("husky");
});
it("merges a lint-staged entry that tolerates ignored and unsupported files", () => {
  const command =
    "taste-lint lint --profile writing --dry-run --no-error-on-unmatched-pattern";
  const inPackage = project({ "lint-staged": { "*.{md,mdx}": "prettier" } });
  initProject({ hook: "lint-staged", install: false, root: inPackage });
  expect(
    initProject({ hook: "lint-staged", install: false, root: inPackage }).hook
  ).toMatchObject({ files: [], packageJson: false });
  expect(
    JSON.parse(fs.readFileSync(path.join(inPackage, "package.json"), "utf-8"))[
      "lint-staged"
    ]
  ).toEqual({ "*.{md,mdx}": ["prettier", command] });

  const fresh = project();
  const result = initProject({
    hook: "lint-staged",
    install: false,
    root: fresh,
  });
  expect(
    JSON.parse(fs.readFileSync(path.join(fresh, ".lintstagedrc.json"), "utf-8"))
  ).toEqual({ "*.{md,mdx}": command });
  expect(result.hook?.notes[0]).toMatch(/--hook husky or --hook lefthook/);

  const scripted = project();
  fs.writeFileSync(path.join(scripted, "lint-staged.config.mjs"), "export {}");
  expect(
    initProject({ hook: "lint-staged", install: false, root: scripted }).hook
      ?.notes[0]
  ).toMatch(/is not JSON/);
  expect(
    fs.readFileSync(path.join(scripted, "lint-staged.config.mjs"), "utf-8")
  ).toBe("export {}");
});
it("suggests the detected hook runner and previews hooks without writing", () => {
  const root = project();
  fs.mkdirSync(path.join(root, ".husky"));
  expect(initProject({ dryRun: true, root }).hookSuggestion).toMatch(
    /--hook husky/
  );
  const result = initProject({ dryRun: true, hook: "lefthook", root });
  expect(result.installCommand).toEqual([
    "npm",
    "install",
    "--save-dev",
    expect.stringMatching(/^taste-lint@/),
    "lefthook",
  ]);
  expect(fs.existsSync(path.join(root, "lefthook.yml"))).toBe(false);
});
