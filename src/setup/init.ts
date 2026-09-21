import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import pkg from "../../packages/cli/package.json" with { type: "json" };
import { InputError } from "../lib/errors.js";

export const managers = ["npm", "pnpm", "yarn", "bun"] as const;
type Manager = (typeof managers)[number];
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
  const needsDependency = !("taste-lint" in dependencies);
  const installArgs =
    pm === "npm" ? ["install", "--save-dev"] : ["add", "--dev"];
  installArgs.push(`taste-lint@^${pkg.version}`);
  const shouldInstall = needsDependency && options.install !== false;
  const result = {
    agentAdded: addAgent,
    dryRun: Boolean(options.dryRun),
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
  if (added.length > 0) {
    manifest.scripts = scripts;
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  if (addAgent) {
    fs.writeFileSync(
      agentPath,
      `${previousAgent}${previousAgent ? "\n\n" : ""}${agentText}`
    );
  }
  return result;
}
