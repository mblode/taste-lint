import { matchesAny } from "../../lib/glob.js";
import { none, UnresolvedError } from "../../reduce/mechanical.js";
import type { MechanicalHit, Unit } from "../../types.js";
import { codeRule } from "./rule.js";

const make = (
  name: string,
  title: string,
  check: (u: Unit) => MechanicalHit,
  hint: string
) =>
  codeRule(
    {
      categoryId: "repository-contracts",
      check,
      hint,
      id: `architecture-${name}`,
      scope: { include: ["**/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts}"] },
      source: {
        line: 1,
        path: "skills/codebase-architecture/references/guardrail-tooling.md",
        repo: "mblode/agent-skills",
      },
      status: "review-only",
      title,
      unit: ["source"],
    },
    "src/rules/code/architecture.ts"
  );

export const ARCHITECTURE_RULES = [
  make(
    "declared-import-boundary",
    "Import violates a declared module boundary",
    (u) => {
      const boundaries = u.facts?.repository.policy?.boundaries?.filter((b) =>
        matchesAny(u.file, [b.from])
      );
      if (!boundaries?.length) {
        return none;
      }
      if (!u.facts?.imports) {
        throw new UnresolvedError(
          u.facts?.parseError ?? "Import facts unavailable"
        );
      }
      for (const item of u.facts.imports) {
        const resolved = item.name.startsWith(".")
          ? u.facts.repository.resolve(u.file, item.name)
          : undefined;
        const boundary = boundaries.find(
          (b) =>
            matchesAny(item.name, [b.disallow]) ||
            (resolved !== undefined && matchesAny(resolved, [b.disallow]))
        );
        if (boundary) {
          return {
            evidence: `${item.name}: ${boundary.reason}`,
            fired: true,
            offset: item.offset,
          };
        }
      }
      return none;
    },
    "Use the declared public interface or change the explicit architecture policy with its owner. Patterns match import specifiers and repository-relative paths for relative imports."
  ),
  make(
    "deprecated-import",
    "Import uses a declared deprecated API",
    (u) => {
      const deprecated = u.facts?.repository.policy?.deprecatedImports;
      if (!deprecated || Object.keys(deprecated).length === 0) {
        return none;
      }
      if (!u.facts?.imports) {
        throw new UnresolvedError(
          u.facts?.parseError ?? "Import facts unavailable"
        );
      }
      for (const item of u.facts.imports) {
        const replacement = deprecated[item.name];
        if (replacement) {
          return {
            evidence: `${item.name}: use ${replacement}`,
            fired: true,
            offset: item.offset,
          };
        }
      }
      return none;
    },
    "Use the replacement named in the repository's deprecation contract."
  ),
  make(
    "generated-regeneration-hint",
    "Declared generated file has no regeneration guidance",
    (u) => {
      const generated = u.facts?.repository.policy?.generated;
      if (!generated?.length || !matchesAny(u.file, generated)) {
        return none;
      }
      const banner = u.text.split("\n").slice(0, 12).join("\n");
      return /generat/i.test(banner) &&
        /(?:regenerat|npm run|pnpm |yarn |bun |codegen|protoc)/i.test(banner)
        ? none
        : {
            evidence:
              "Declared generated output lacks a regeneration hint in its header",
            fired: true,
            offset: 0,
          };
    },
    "Have the generator emit a banner naming the regeneration command or canonical instructions."
  ),
];
