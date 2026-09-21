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
