// Pre-commit wiring for `init --hook`. Each hook blocks a commit on act
// findings with the mechanical checks only (--dry-run): a hook must be fast,
// offline and never bill a key. Existing configuration is merged, never
// replaced, and a second run changes nothing.

import fs from "node:fs";
import path from "node:path";

import YAML from "yaml";

import { InputError } from "../lib/errors.js";

export const hooks = ["lefthook", "husky", "lint-staged"] as const;
export type Hook = (typeof hooks)[number];
type Manager = "npm" | "pnpm" | "yarn" | "bun";

// Files each profile reads; with --staged the CLI filters again, so these
// globs only let the runner skip the job when nothing relevant is staged.
const GLOBS: Record<string, string> = {
  product: "*.{tsx,jsx,css,scss}",
  writing: "*.{md,mdx}",
};
const LEFTHOOK_FILES = [
  "lefthook.yml",
  "lefthook.yaml",
  ".lefthook.yml",
  ".lefthook.yaml",
];
const LINT_STAGED_JSON = [".lintstagedrc.json", ".lintstagedrc"];
const LINT_STAGED_OTHER = [
  ".lintstagedrc.yaml",
  ".lintstagedrc.yml",
  ".lintstagedrc.js",
  ".lintstagedrc.cjs",
  ".lintstagedrc.mjs",
  "lint-staged.config.js",
  "lint-staged.config.cjs",
  "lint-staged.config.mjs",
];
const HUSKY_FILE = ".husky/pre-commit";
const MARK = "taste-lint";

export const exec = (pm: Manager, bin: string): string[] => {
  switch (pm) {
    case "pnpm": {
      return ["pnpm", "exec", bin];
    }
    case "yarn": {
      return ["yarn", bin];
    }
    case "bun": {
      return ["bunx", bin];
    }
    default: {
      return ["npx", bin];
    }
  }
};

export interface HookPlan {
  hook: Hook;
  /** Files to write, relative to the project root. Empty when already wired. */
  writes: { file: string; content: string }[];
  /** Applied to package.json before it is written. */
  manifest?: (manifest: Record<string, unknown>) => void;
  /** Development dependency to install when the project lacks it. */
  dependency?: string;
  /** Command that makes Git call the hook after the files are written. */
  activate?: string[];
  notes: string[];
}

const read = (root: string, file: string): string | undefined => {
  const abs = path.join(root, file);
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf-8") : undefined;
};
const first = (root: string, files: string[]): string | undefined =>
  files.find((file) => fs.existsSync(path.join(root, file)));

const lefthook = (root: string, command: string, glob: string) => {
  const file = first(root, LEFTHOOK_FILES) ?? "lefthook.yml";
  const text = read(root, file) ?? "";
  if (text.includes(MARK)) {
    return [];
  }
  const doc = YAML.parseDocument(text);
  if (doc.errors.length > 0) {
    throw new InputError(
      "INVALID_PROJECT",
      `Cannot parse ${file}. Fix the YAML, then rerun init --hook lefthook.`
    );
  }
  // A Map keeps the order people write a job in: name first.
  const job = new Map([
    ["name", MARK],
    ["glob", glob],
    ["run", command],
  ]);
  if (doc.contents === null) {
    // Empty or comment-only file: keep the comments, add the hook.
    const created = new YAML.Document(
      new Map([["pre-commit", new Map([["jobs", [job]]])]])
    );
    const kept = text.trim() ? text.replace(/\n*$/u, "\n") : "";
    return [{ content: `${kept}${created}`, file }];
  }
  if (!YAML.isMap(doc.contents)) {
    throw new InputError(
      "INVALID_PROJECT",
      `${file} must be a map of hooks. Add the job by hand: ${command}`
    );
  }
  const pre = doc.get("pre-commit");
  if (pre === undefined) {
    doc.set("pre-commit", doc.createNode(new Map([["jobs", [job]]])));
  } else if (!YAML.isMap(pre)) {
    throw new InputError(
      "INVALID_PROJECT",
      `${file}: pre-commit must be a map. Add the job by hand: ${command}`
    );
  } else if (pre.has("commands") && !pre.has("jobs")) {
    // Lefthook's older commands map; keep one style per hook.
    job.delete("name");
    pre.setIn(["commands", MARK], doc.createNode(job));
  } else {
    const jobs = pre.get("jobs");
    if (YAML.isSeq(jobs)) {
      jobs.add(doc.createNode(job));
    } else {
      pre.set("jobs", doc.createNode([job]));
    }
  }
  return [{ content: doc.toString(), file }];
};

const husky = (root: string, command: string) => {
  const text = read(root, HUSKY_FILE);
  if (text?.includes(MARK)) {
    return [];
  }
  const block = `# ${MARK}\n${command}\n`;
  return [
    {
      content: text ? `${text.replace(/\n*$/u, "\n")}${block}` : block,
      file: HUSKY_FILE,
    },
  ];
};

const lintStaged = (
  root: string,
  manifest: Record<string, unknown>,
  command: string,
  glob: string,
  plan: HookPlan
) => {
  const merge = (config: Record<string, unknown>) => {
    if (JSON.stringify(config).includes(MARK)) {
      return false;
    }
    const existing = config[glob];
    config[glob] =
      existing === undefined
        ? command
        : [...(Array.isArray(existing) ? existing : [existing]), command];
    return true;
  };
  const other = first(root, LINT_STAGED_OTHER);
  if (other) {
    if (!read(root, other)?.includes(MARK)) {
      plan.notes.push(
        `${other} is not JSON, so init left it alone. Add "${glob}": "${command}" to it.`
      );
    }
    return;
  }
  const config = manifest["lint-staged"];
  if (config && typeof config === "object" && !Array.isArray(config)) {
    if (JSON.stringify(config).includes(MARK)) {
      return;
    }
    plan.manifest = (m) => {
      merge(m["lint-staged"] as Record<string, unknown>);
    };
    return;
  }
  const file = first(root, LINT_STAGED_JSON) ?? ".lintstagedrc.json";
  const raw = read(root, file);
  let parsed: Record<string, unknown> = {};
  if (raw !== undefined) {
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new InputError(
        "INVALID_PROJECT",
        `Cannot parse ${file} as JSON. Fix it, then rerun init --hook lint-staged.`
      );
    }
  }
  if (merge(parsed)) {
    plan.writes.push({ content: `${JSON.stringify(parsed, null, 2)}\n`, file });
  }
};

// lint-staged needs a hook runner to call it; say which file to touch.
const runnerNote = (root: string): string | undefined => {
  const huskyHook = read(root, HUSKY_FILE);
  if (huskyHook !== undefined) {
    return huskyHook.includes("lint-staged")
      ? undefined
      : `Add "npx lint-staged" to ${HUSKY_FILE} so commits run it.`;
  }
  const lefthookFile = first(root, LEFTHOOK_FILES);
  if (lefthookFile) {
    return read(root, lefthookFile)?.includes("lint-staged")
      ? undefined
      : `Add a pre-commit job that runs lint-staged to ${lefthookFile}.`;
  }
  return "lint-staged runs from a pre-commit hook. Rerun init with --hook husky or --hook lefthook instead, or call lint-staged from your own hook.";
};

export const planHook = (
  root: string,
  hook: Hook,
  pm: Manager,
  profile: string,
  manifest: Record<string, unknown>,
  dependencies: Record<string, unknown>
): HookPlan => {
  const glob = GLOBS[profile] ?? GLOBS.writing;
  const staged = [
    ...exec(pm, "taste-lint"),
    "lint",
    "--staged",
    "--profile",
    profile,
    "--dry-run",
  ].join(" ");
  const plan: HookPlan = { hook, notes: [], writes: [] };
  if (hook === "lefthook") {
    plan.writes = lefthook(root, staged, glob);
    plan.activate = [...exec(pm, "lefthook"), "install"];
  } else if (hook === "husky") {
    plan.writes = husky(root, staged);
    plan.activate = exec(pm, "husky");
    const scripts = manifest.scripts as Record<string, unknown> | undefined;
    if (!scripts?.prepare) {
      plan.manifest = (m) => {
        m.scripts = { ...(m.scripts as object), prepare: "husky" };
      };
    }
  } else {
    // lint-staged hands over the staged paths and stashes unstaged hunks, so
    // the command takes paths and must not fail on an all-ignored set.
    lintStaged(
      root,
      manifest,
      `taste-lint lint --profile ${profile} --dry-run --no-error-on-unmatched-pattern`,
      glob,
      plan
    );
    const note = runnerNote(root);
    if (note) {
      plan.notes.push(note);
    }
  }
  if (!(hook in dependencies)) {
    plan.dependency = hook;
  }
  return plan;
};

// Without --hook, point at the runner the project already uses.
export const detectHook = (
  root: string,
  manifest: Record<string, unknown>
): Hook | undefined => {
  if (first(root, LEFTHOOK_FILES)) {
    return "lefthook";
  }
  if (
    manifest["lint-staged"] ||
    first(root, [...LINT_STAGED_JSON, ...LINT_STAGED_OTHER])
  ) {
    return "lint-staged";
  }
  if (fs.existsSync(path.join(root, ".husky"))) {
    return "husky";
  }
  return undefined;
};
