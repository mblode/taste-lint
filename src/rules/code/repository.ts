import { builtinModules } from "node:module";

import { none, UnresolvedError } from "../../reduce/mechanical.js";
import type { MechanicalHit, Unit } from "../../types.js";
import { codeRule } from "./rule.js";

const at = (evidence: string, offset = 0): MechanicalHit => ({
  evidence,
  fired: true,
  offset,
});
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const json = (u: Unit): Record<string, unknown> => {
  try {
    return object(JSON.parse(u.text));
  } catch {
    throw new UnresolvedError("JSON is not parseable");
  }
};
const builtins = new Set([
  ...builtinModules,
  ...builtinModules.map((n) => `node:${n}`),
]);
const make = (
  domain: "architecture" | "dx",
  id: string,
  title: string,
  include: string[],
  source: string,
  check: (u: Unit) => MechanicalHit,
  hint: string
) =>
  codeRule(
    {
      categoryId:
        domain === "dx" ? "package-contracts" : "repository-contracts",
      check,
      hint,
      id: `${domain}-${id}`,
      scope: { include },
      source: {
        line: 1,
        path: `skills/${source}`,
        repo: "mblode/agent-skills",
      },
      status: "review-only",
      title,
      unit: ["source"],
    },
    "src/rules/code/repository.ts"
  );
const GUARD = "codebase-architecture/references/guardrail-tooling.md";
const PKG = ["**/package.json"];
const CODE = ["**/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts}"];

export const REPOSITORY_RULES = [
  make(
    "dx",
    "package-entry-target",
    "Package entry points to a missing artifact",
    PKG,
    "scaffold-cli/references/post-scaffold.md",
    (u) => {
      const value = json(u);
      const entries: string[] = [];
      for (const key of ["main", "module", "types", "typings"]) {
        if (typeof value[key] === "string") {
          entries.push(value[key]);
        }
      }
      if (typeof value.bin === "string") {
        entries.push(value.bin);
      } else {
        entries.push(
          ...Object.values(object(value.bin)).filter(
            (v): v is string => typeof v === "string"
          )
        );
      }
      const visit = (v: unknown): void => {
        if (typeof v === "string") {
          entries.push(v);
        } else if (v && typeof v === "object") {
          for (const child of Object.values(v)) {
            visit(child);
          }
        }
      };
      visit(value.exports);
      for (const entry of entries) {
        if (entry.includes("*")) {
          continue;
        }
        const resolved = u.facts!.repository.resolve(u.file, entry);
        if (resolved === undefined) {
          return at(`Entry escapes repository: ${entry}`);
        }
        if (!u.facts!.repository.exists(resolved)) {
          if (
            /^(?:\.\/)?(?:dist|build|lib)\//.test(entry) &&
            object(value.scripts).build
          ) {
            throw new UnresolvedError(
              `Build output not available: ${entry}. Build or inspect the packed artifact.`
            );
          }
          return at(`Missing package entry: ${entry}`);
        }
      }
      return none;
    },
    "Build and inspect the package, then make bin, exports, and declaration paths match its actual artifacts."
  ),
  make(
    "dx",
    "package-bin-shebang",
    "CLI executable has no Node shebang",
    PKG,
    "scaffold-cli/references/scaffold-source.md",
    (u) => {
      const value = json(u);
      const bins =
        typeof value.bin === "string"
          ? [value.bin]
          : Object.values(object(value.bin)).filter(
              (v): v is string => typeof v === "string"
            );
      for (const bin of bins) {
        if (!/\.[cm]?js$/.test(bin)) {
          continue;
        }
        const resolved = u.facts!.repository.resolve(u.file, bin);
        const text =
          resolved === undefined
            ? undefined
            : u.facts!.repository.read(resolved);
        if (text === undefined) {
          throw new UnresolvedError(`CLI artifact unavailable: ${bin}`);
        }
        if (!/^#![^\n]*\bnode\b/.test(text)) {
          return at(`Node CLI lacks shebang: ${bin}`);
        }
        if (/^#![^\n]*\n#!/.test(text)) {
          return at(`Duplicate CLI shebang: ${bin}`);
        }
      }
      return none;
    },
    "Emit exactly one Node shebang in the published executable."
  ),
  make(
    "dx",
    "exports-mixed-keys",
    "Package exports mixes conditions and subpaths",
    PKG,
    "dx-audit/rules/api-stable-contract.md",
    (u) => {
      const keys = Object.keys(object(json(u).exports));
      return keys.some((k) => k.startsWith(".")) &&
        keys.some((k) => !k.startsWith("."))
        ? at("Exports mixes subpath keys with condition keys at the same level")
        : none;
    },
    "Put conditions inside each exported subpath, or use a conditions-only root export."
  ),
  make(
    "architecture",
    "undeclared-import",
    "Import has no declared package dependency",
    CODE,
    GUARD,
    (u) => {
      if (!u.facts?.imports) {
        throw new UnresolvedError(
          u.facts?.parseError ?? "Import facts unavailable"
        );
      }
      const manifest = u.facts.repository.manifest(u.file);
      if (!manifest) {
        throw new UnresolvedError("No readable package manifest");
      }
      const value = manifest.value;
      const declared = new Set([
        value.name,
        ...[
          "dependencies",
          "devDependencies",
          "peerDependencies",
          "optionalDependencies",
        ].flatMap((key) => Object.keys(object(value[key]))),
      ]);
      for (const item of u.facts.imports) {
        if (
          /^(?:\.|\/|#|~|[a-z]+:)/i.test(item.name) ||
          builtins.has(item.name)
        ) {
          continue;
        }
        const name = item.name.startsWith("@")
          ? item.name.split("/").slice(0, 2).join("/")
          : item.name.split("/")[0];
        if (declared.has(name)) {
          continue;
        }
        const tsconfig = u.facts.repository.resolve(
          manifest.file,
          "tsconfig.json"
        );
        if (tsconfig && u.facts.repository.exists(tsconfig)) {
          throw new UnresolvedError(
            `Undeclared ${name} may resolve through TypeScript aliases; resolve the project graph`
          );
        }
        return at(
          `Import ${name} is absent from ${manifest.file}`,
          item.offset
        );
      }
      return none;
    },
    "Declare the dependency in the consuming package, or configure its alias resolution."
  ),
  make(
    "architecture",
    "cross-package-relative-import",
    "Relative import bypasses a package boundary",
    CODE,
    GUARD,
    (u) => {
      if (!u.facts?.imports) {
        throw new UnresolvedError(
          u.facts?.parseError ?? "Import facts unavailable"
        );
      }
      const own = u.facts.repository.manifest(u.file);
      if (!own) {
        throw new UnresolvedError("No readable package manifest");
      }
      for (const item of u.facts.imports.filter((i) =>
        i.name.startsWith(".")
      )) {
        const target = u.facts.repository.resolve(u.file, item.name);
        if (!target) {
          continue;
        }
        const other = u.facts.repository.manifest(target);
        if (other && other.file !== own.file) {
          return at(
            `Relative import crosses from ${own.file} to ${other.file}: ${item.name}`,
            item.offset
          );
        }
      }
      return none;
    },
    "Import through the sibling package's public entry and declare the dependency, unless an explicit workspace convention permits this edge."
  ),
  make(
    "architecture",
    "missing-tsconfig-reference",
    "TypeScript project reference points to a missing target",
    ["**/tsconfig*.json"],
    GUARD,
    (u) => {
      // JSONC needs the TypeScript parser; do not mistake it for invalid configuration.
      const value = json(u);
      for (const entry of Array.isArray(value.references)
        ? value.references
        : []) {
        const target = object(entry).path;
        if (typeof target !== "string") {
          continue;
        }
        const resolved = u.facts!.repository.resolve(u.file, target);
        if (!resolved) {
          throw new UnresolvedError("Project reference outside repository");
        }
        if (!u.facts!.repository.exists(resolved)) {
          return at(`Missing TypeScript reference: ${target}`);
        }
      }
      return none;
    },
    "Correct the project reference or restore the referenced project."
  ),
  make(
    "architecture",
    "missing-local-config-extends",
    "Config extends a missing local file",
    ["**/tsconfig*.json"],
    GUARD,
    (u) => {
      const value = json(u);
      const bases = Array.isArray(value.extends)
        ? value.extends
        : [value.extends];
      for (const base of bases) {
        if (typeof base !== "string" || !base.startsWith(".")) {
          continue;
        }
        const resolved = u.facts!.repository.resolve(u.file, base);
        if (resolved === undefined) {
          throw new UnresolvedError("Extended config outside repository");
        }
        if (
          !u.facts!.repository.exists(resolved) &&
          !u.facts!.repository.exists(`${resolved}.json`)
        ) {
          return at(`Missing extended config: ${base}`);
        }
      }
      return none;
    },
    "Update extends to the existing configuration path."
  ),
];
