import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import pkg from "../../package.json" with { type: "json" };
import { InputError } from "../lib/errors.js";

const managers = ["npm", "pnpm", "yarn", "bun"] as const;
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

Taste Lint uses Jev to judge copy and UI. Preview the taste script with --dry-run, then run it with a user-supplied AI_GATEWAY_API_KEY.
Fix act findings, review advisory findings in context, and recheck the edited files.
Never invent a key or treat unknown checks as passes.
Docs: https://taste-lint.blode.md
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
  for (const oldProfile of ["product", "writing"]) {
    if (
      scripts["check:taste"] ===
      `taste-lint scan . --profile ${oldProfile} --mechanical-only`
    ) {
      scripts["check:taste"] = `taste-lint scan . --profile ${oldProfile}`;
      added.push("check:taste");
    }
  }
  for (const [name, command] of Object.entries({
    taste: `taste-lint scan . --profile ${profile}`,
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
  const legacyAgentText = `${marker}
## Taste Lint

Run the local check with the project's check:taste script after editing copy or UI.
For AI checks, preview the taste script with --dry-run, then run it with a user-supplied AI_GATEWAY_API_KEY.
Fix act findings, review advisory findings in context, and recheck the edited files.
Never invent a key or treat unknown checks as passes.
<!-- /taste-lint -->
`;
  const upgradeAgent = Boolean(
    options.agent && previousAgent.includes(legacyAgentText)
  );
  const addAgent = Boolean(options.agent && !previousAgent.includes(marker));
  const needsDependency = !("taste-lint" in dependencies);
  const installArgs =
    pm === "npm" ? ["install", "--save-dev"] : ["add", "--dev"];
  installArgs.push(`taste-lint@^${pkg.version}`);
  const shouldInstall = needsDependency && options.install !== false;
  const result = {
    agentAdded: addAgent || upgradeAgent,
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
  if (upgradeAgent) {
    fs.writeFileSync(
      agentPath,
      previousAgent.replace(legacyAgentText, agentText)
    );
  }
  if (addAgent) {
    fs.writeFileSync(
      agentPath,
      `${previousAgent}${previousAgent ? "\n\n" : ""}${agentText}`
    );
  }
  return result;
}
