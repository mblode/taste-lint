import { parse } from "yaml";

import { descendants, nodeText } from "../../analysis/repository.js";
import type { DocumentNode } from "../../analysis/repository.js";
import { none, UnresolvedError } from "../../reduce/mechanical.js";
import type { MechanicalHit, Rule, Unit } from "../../types.js";
import { codeRule } from "./rule.js";

const at = (node: DocumentNode, evidence: string): MechanicalHit => ({
  evidence,
  fired: true,
  offset: node.position?.start.offset ?? 0,
});
const document = (unit: Unit): DocumentNode => {
  if (!unit.facts?.document) {
    throw new UnresolvedError("Markdown structure unavailable");
  }
  return unit.facts.document;
};
const nodes = (unit: Unit) => descendants(document(unit));
const make = (
  name: string,
  title: string,
  source: string,
  include: string[],
  check: (unit: Unit) => MechanicalHit,
  hint: string,
  authoring = false,
  status: Rule["status"] = "review-only"
) =>
  codeRule(
    {
      categoryId: authoring ? "instruction-quality" : "reference-reading",
      check,
      hint,
      id: `${authoring ? "authoring" : "copywriting"}-${name}`,
      scope: { include },
      source: {
        line: 1,
        path: `skills/${source}`,
        repo: "mblode/agent-skills",
      },
      status,
      title,
      unit: ["source"],
    },
    "src/rules/code/documents.ts"
  );
const README = ["**/README.md"];
const INSTRUCTIONS = ["**/AGENTS.md", "**/CLAUDE.md", "**/SKILL.md"];
const DOCS = ["**/*.md"];
const README_SOURCE = "ghostwriter/references/readme.md";

export const DOCUMENT_RULES = [
  make(
    "readme-scaffold",
    "README still contains scaffold instructions",
    README_SOURCE,
    README,
    (u) => {
      const n = nodes(u).find(
        (candidate) =>
          candidate.type === "paragraph" &&
          /This is a \[?Next\.js.*bootstrapped with|This template provides a minimal setup to get React working in Vite/i.test(
            nodeText(candidate)
          )
      );
      return n ? at(n, "Default scaffold introduction") : none;
    },
    "Replace scaffold instructions with what the product does and how a consumer uses it."
  ),
  make(
    "readme-description",
    "README has no introductory description",
    README_SOURCE,
    README,
    (u) => {
      const children = document(u).children ?? [];
      const stop = children.findIndex(
        (n) => n.type === "heading" && (n.depth ?? 0) > 1
      );
      const intro = children.slice(0, stop === -1 ? children.length : stop);
      const prose = intro.some(
        (n) => n.type === "paragraph" && nodeText(n).trim().length > 0
      );
      return prose
        ? none
        : {
            evidence: "No introductory prose before the first section",
            fired: true,
            offset: 0,
          };
    },
    "Explain what a reader can do with the product before listing setup steps."
  ),
  make(
    "readme-quickstart-elision",
    "Quickstart example contains an unfinished placeholder",
    README_SOURCE,
    README,
    (u) => {
      let heading = "";
      for (const n of document(u).children ?? []) {
        if (n.type === "heading") {
          heading = nodeText(n);
        }
        if (
          n.type === "code" &&
          /quick\s?start|getting started/i.test(heading) &&
          /^\s*(?:\.\.\.|\/\/\s*(?:TODO|your code here)|#\s*TODO)\s*$/m.test(
            n.value ?? ""
          )
        ) {
          return at(n, "Quickstart contains an elided implementation");
        }
      }
      return none;
    },
    "Provide a complete first-run example; move intentionally partial examples to a tutorial."
  ),
  make(
    "document-empty-heading",
    "A section has no content",
    "ghostwriter/references/docs.md",
    DOCS,
    (u) => {
      const children = document(u).children ?? [];
      for (const [i, n] of children.entries()) {
        if (n.type !== "heading") {
          continue;
        }
        const next = children[i + 1];
        if (
          !next ||
          (next.type === "heading" && (next.depth ?? 0) <= (n.depth ?? 0))
        ) {
          return at(n, `Empty section: ${nodeText(n)}`);
        }
      }
      return none;
    },
    "Add the section's content or remove its heading."
  ),
  make(
    "document-heading-order",
    "Heading skips a structural level",
    "ghostwriter/references/docs.md",
    DOCS,
    (u) => {
      let previous = 0;
      for (const n of nodes(u).filter(
        (candidate) => candidate.type === "heading"
      )) {
        const depth = n.depth ?? 1;
        if (previous > 0 && depth > previous + 1) {
          return at(n, `Heading level jumps from ${previous} to ${depth}`);
        }
        previous = depth;
      }
      return none;
    },
    "Nest heading levels in order so the document outline reflects its structure."
  ),
  make(
    "document-code-fence-language",
    "Code fence has no language tag",
    "ghostwriter/references/docs.md",
    DOCS,
    (u) => {
      const n = nodes(u).find(
        (candidate) => candidate.type === "code" && !candidate.lang
      );
      return n ? at(n, "Fence without a language tag") : none;
    },
    "Tag the fence: ```bash, ```ts, or ```text for output. The tag drives highlighting and tells the reader what to paste where."
  ),
  make(
    "document-broken-local-link",
    "Document links to a missing local file",
    "ghostwriter/references/docs.md",
    DOCS,
    (u) => {
      const repo = u.facts!.repository;
      for (const n of nodes(u).filter((candidate) =>
        ["link", "image", "definition"].includes(candidate.type)
      )) {
        const url = n.url ?? "";
        if (!url || /^(?:[a-z][\w+.-]*:|\/|#)/i.test(url)) {
          continue;
        }
        let target: string;
        try {
          target = decodeURIComponent(url.split(/[?#]/)[0]);
        } catch {
          return at(n, "Malformed URL encoding in local link");
        }
        // Extensionless docs routes and generated web URLs need the site's resolver.
        if (!/\.(?:md|mdx|png|jpe?g|svg|gif|webp|pdf)$/i.test(target)) {
          continue;
        }
        const resolved = repo.resolve(u.file, target);
        if (resolved === undefined) {
          throw new UnresolvedError("Link points outside the repository");
        }
        if (!repo.exists(resolved)) {
          return at(n, `Missing local target: ${target}`);
        }
      }
      return none;
    },
    "Correct the link or provide the referenced file. Generated site routes need a route-aware check.",
    false,
    "active"
  ),
  make(
    "instruction-missing-script",
    "Instruction invokes an undefined package script",
    "agents-md/references/quick-checklist.md",
    INSTRUCTIONS,
    (u) => {
      const manifest = u.facts!.repository.manifest(u.file);
      if (!manifest) {
        throw new UnresolvedError(
          "No readable package manifest for this instruction file"
        );
      }
      const scripts = manifest.value.scripts as
        | Record<string, unknown>
        | undefined;
      for (const n of nodes(u).filter((candidate) =>
        ["code", "inlineCode"].includes(candidate.type)
      )) {
        for (const m of (n.value ?? "").matchAll(/\bnpm run ([\w:-]+)\b/g)) {
          if (/--(?:workspace|prefix)|\bcd\s/.test(n.value ?? "")) {
            continue;
          }
          if (!scripts || !(m[1] in scripts)) {
            return at(n, `Script ${m[1]} is absent from ${manifest.file}`);
          }
        }
      }
      return none;
    },
    "Name a script in the applicable package manifest, or state the workspace where the command runs.",
    true
  ),
  make(
    "skill-frontmatter",
    "Skill frontmatter is missing or invalid",
    "agent-skills-creator/references/format-specification.md",
    ["**/SKILL.md"],
    (u) => {
      const match = u.text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
      if (!match) {
        return { evidence: "Missing YAML frontmatter", fired: true, offset: 0 };
      }
      try {
        const value: unknown = parse(match[1]);
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          return {
            evidence: "Frontmatter must be an object",
            fired: true,
            offset: 0,
          };
        }
        const fields = value as Record<string, unknown>;
        if (
          typeof fields.name !== "string" ||
          !fields.name.trim() ||
          typeof fields.description !== "string" ||
          !fields.description.trim()
        ) {
          return {
            evidence: "Skill needs nonempty name and description",
            fired: true,
            offset: 0,
          };
        }
      } catch {
        return {
          evidence: "Frontmatter is not valid YAML",
          fired: true,
          offset: 0,
        };
      }
      return none;
    },
    "Supply valid YAML with name and description; run the skill repository's full validator for its remaining conventions.",
    true
  ),
  make(
    "readme-license-link",
    "README license link points to a missing file",
    README_SOURCE,
    README,
    (u) => {
      for (const n of nodes(u).filter(
        (candidate) => candidate.type === "link"
      )) {
        if (!/^(?:\.\/)?LICENSE(?:\.[\w-]+)?$/i.test(n.url ?? "")) {
          continue;
        }
        const target = u.facts!.repository.resolve(u.file, n.url!);
        if (target && !u.facts!.repository.exists(target)) {
          return at(n, `Missing license target: ${n.url}`);
        }
      }
      return none;
    },
    "Link to the project's actual license file."
  ),
  make(
    "readme-install-name",
    "README installs an old or unrelated package name",
    README_SOURCE,
    README,
    (u) => {
      const manifest = u.facts!.repository.manifest(u.file);
      if (
        !manifest ||
        manifest.value.private === true ||
        typeof manifest.value.name !== "string"
      ) {
        throw new UnresolvedError(
          "Published package identity is not established"
        );
      }
      let section = "";
      for (const n of document(u).children ?? []) {
        if (n.type === "heading") {
          section = nodeText(n);
        }
        if (n.type !== "code" || !/^install(?:ation)?$/i.test(section)) {
          continue;
        }
        const command = (n.value ?? "").match(
          /^\s*(?:npm (?:install|i)|pnpm add|yarn add|bun add)\s+((?:@[\w.-]+\/)?[\w.-]+)(?:@[^\s]+)?\s*$/m
        );
        if (command && command[1] !== manifest.value.name) {
          return at(
            n,
            `Install names ${command[1]}; manifest names ${manifest.value.name}`
          );
        }
      }
      return none;
    },
    "Check the intended distribution package. Keep companion-package and workspace instructions explicit."
  ),
];
