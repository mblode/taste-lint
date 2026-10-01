import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import pkg from "../../packages/cli/package.json" with { type: "json" };
import { InputError } from "../lib/errors.js";
import { detectHook, hooks, planHook } from "./hooks.js";
import type { Hook } from "./hooks.js";

export const managers = ["npm", "pnpm", "yarn", "bun"] as const;
export type Manager = (typeof managers)[number];
const lockfiles: Record<Manager, string[]> = {
  bun: ["bun.lock", "bun.lockb"],
  npm: ["package-lock.json", "npm-shrinkwrap.json"],
  pnpm: ["pnpm-lock.yaml"],
  yarn: ["yarn.lock"],
};
const marker = "<!-- taste-lint -->";
const agentText = `${marker}
## Taste Lint

Run the taste script after editing copy or UI. Act findings fail the run and must be fixed in the copy or the classes, never by editing a rule.
Review notes never fail a run; read them as suggestions. Unknown means a check could not decide, not a pass.
Jev checks need a user-supplied AI_GATEWAY_API_KEY; add --dry-run to run only the mechanical checks. Never invent a key.
Docs: https://blode.co/taste-lint/docs
<!-- /taste-lint -->
`;

export interface InitOptions {
  root: string;
  pm?: string;
  dryRun?: boolean;
  install?: boolean;
  agent?: boolean;
  hook?: string;
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function initProject(options: InitOptions) {
  const root = path.resolve(options.root);
  const manifestPath = path.join(root, "package.json");
  let manifest: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    if (!object(parsed)) {
      throw new Error("Expected an object");
    }
    manifest = parsed;
  } catch {
    throw new InputError(
      "INVALID_PROJECT",
      "Run init in a project with a valid package.json, or use --root <path>."
    );
  }
  const declared =
    typeof manifest.packageManager === "string"
      ? manifest.packageManager.split("@")[0]
      : undefined;
  const detected = managers.filter((manager) =>
    lockfiles[manager].some((file) => fs.existsSync(path.join(root, file)))
  );
  const selected =
    options.pm ?? declared ?? (detected.length === 1 ? detected[0] : undefined);
  if (!selected && detected.length > 1) {
    throw new InputError(
      "AMBIGUOUS_PACKAGE_MANAGER",
      "Multiple lockfiles found. Choose --pm npm, pnpm, yarn, or bun."
    );
  }
  const pm = selected ?? "npm";
  if (!managers.includes(pm as Manager)) {
    throw new InputError(
      "INVALID_PACKAGE_MANAGER",
      "Choose --pm npm, pnpm, yarn, or bun."
    );
  }
  for (const field of ["scripts", "dependencies", "devDependencies"]) {
    if (manifest[field] !== undefined && !object(manifest[field])) {
      throw new InputError(
        "INVALID_PROJECT",
        `package.json ${field} must be an object.`
      );
    }
  }
  const dependencies = {
    ...(manifest.dependencies as Record<string, unknown>),
    ...(manifest.devDependencies as Record<string, unknown>),
  };
  const profile = ["react", "next", "vue", "svelte", "astro"].some(
    (name) => name in dependencies
  )
    ? "product"
    : "writing";
  const scripts = { ...(manifest.scripts as Record<string, unknown>) };
  const added: string[] = [];
  for (const [name, command] of Object.entries({
    taste: `taste-lint lint --profile ${profile}`,
  })) {
    if (!(name in scripts)) {
      scripts[name] = command;
      added.push(name);
    }
  }
  const agentPath = path.join(root, "AGENTS.md");
  const previousAgent =
    options.agent && fs.existsSync(agentPath)
      ? fs.readFileSync(agentPath, "utf-8")
      : "";
  const addAgent = Boolean(options.agent && !previousAgent.includes(marker));
  if (options.hook && !hooks.includes(options.hook as Hook)) {
    throw new InputError("INVALID_HOOK", `Choose --hook ${hooks.join(", ")}.`);
  }
  const hook = options.hook
    ? planHook(
        root,
        options.hook as Hook,
        pm as Manager,
        profile,
        manifest,
        dependencies
      )
    : undefined;
  const found = hook ? undefined : detectHook(root, manifest);
  const packages = [
    ...("taste-lint" in dependencies ? [] : [`taste-lint@^${pkg.version}`]),
    ...(hook?.dependency ? [hook.dependency] : []),
  ];
  const installArgs = [
    ...(pm === "npm" ? ["install", "--save-dev"] : ["add", "--dev"]),
    ...packages,
  ];
  const shouldInstall = packages.length > 0 && options.install !== false;
  const result = {
    agentAdded: addAgent,
    dryRun: Boolean(options.dryRun),
    hook: hook
      ? {
          files: hook.writes.map((w) => w.file),
          name: hook.hook,
          notes: [
            ...hook.notes,
            ...(options.install === false && hook.dependency
              ? [`Install ${hook.dependency} as a development dependency.`]
              : []),
            ...(options.install === false && hook.activate
              ? [`Run ${hook.activate.join(" ")} to activate the hook.`]
              : []),
          ],
          packageJson: Boolean(hook.manifest),
        }
      : null,
    hookSuggestion: found
      ? `Found ${found}. Rerun init with --hook ${found} to block commits on act findings.`
      : null,
    installCommand: shouldInstall ? [pm, ...installArgs] : null,
    packageManager: pm,
    profile,
    root,
    scriptsAdded: added,
  };
  if (options.dryRun) {
    return result;
  }
  if (shouldInstall) {
    const installed = spawnSync(pm, installArgs, {
      cwd: root,
      shell: false,
      stdio: ["ignore", "inherit", "inherit"],
    });
    if (installed.error || installed.status !== 0) {
      throw new InputError(
        "INSTALL_FAILED",
        `Installation failed. Run ${pm} ${installArgs.join(" ")} and retry init.`
      );
    }
    // The package manager owns dependency and lockfile changes.
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as Record<
      string,
      unknown
    >;
  }
  const before = JSON.stringify(manifest);
  if (added.length > 0) {
    manifest.scripts = { ...(manifest.scripts as object), ...scripts };
  }
  hook?.manifest?.(manifest);
  if (JSON.stringify(manifest) !== before) {
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  for (const { file, content } of hook?.writes ?? []) {
    const abs = path.join(root, file);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
    if (file.startsWith(".husky/")) {
      // Husky 8 and plain Git run the hook file itself.
      fs.chmodSync(abs, 0o755);
    }
  }
  if (hook?.activate && options.install !== false) {
    const [command, ...args] = hook.activate;
    const activated = spawnSync(command, args, {
      cwd: root,
      shell: false,
      stdio: ["ignore", "ignore", "inherit"],
    });
    if (activated.error || activated.status !== 0) {
      result.hook?.notes.push(
        `Could not activate ${hook.hook}. Run ${hook.activate.join(" ")}.`
      );
    }
  }
  if (addAgent) {
    fs.writeFileSync(
      agentPath,
      `${previousAgent}${previousAgent ? "\n\n" : ""}${agentText}`
    );
  }
  return result;
}
