// Engineering checks that count or compare: files past the size a reader can
// hold, repeated blocks, type bypasses, commented-out code and dependencies
// nothing imports. From the tidy skill; every one reports and never fails a
// run until measured.

import path from "node:path";

import { hit, none, UnresolvedError } from "../../reduce/mechanical.js";
import type { MechanicalHit, Unit } from "../../types.js";
import {
  GENERATED,
  skillSource,
  SOURCE_FILES,
  stripComments,
} from "./engineering-shared.js";
import { TEST_RULES } from "./engineering-tests.js";
import { codeRule } from "./rule.js";

const MODULE = "src/rules/code/engineering.ts";

// `as unknown as` is left out: it is the documented escape hatch at an untyped
// boundary, and on real repositories it was usually that.
const BYPASS =
  /\bas\s+any\b|\b(?:useState|useRef|Array|Record|Promise|Map|Set)<any\b|:\s*any\b(?=\s*[,)=;\]])/u;
const SUPPRESS = /\/\/\s*@ts-ignore\b|\/\/\s*@ts-expect-error\s*$/mu;

export const typeBypass = (unit: Unit): MechanicalHit => {
  const suppressed = SUPPRESS.exec(unit.text);
  const cast = BYPASS.exec(stripComments(unit.text));
  const first = [suppressed, cast]
    .filter((m): m is RegExpExecArray => m !== null)
    .toSorted((a, b) => a.index - b.index)[0];
  return first ? { ...hit(first[0].trim()), offset: first.index } : none;
};

const MAX_LINES = 1000;

export const oversized = (unit: Unit): MechanicalHit => {
  const lines = unit.text.split("\n").length;
  return lines > MAX_LINES ? { ...hit(`${lines} lines`), offset: 0 } : none;
};

// A block of this many significant lines repeated in one file is a helper
// waiting to be named. Shorter windows match ordinary JSX and switch arms.
const WINDOW = 8;
const MIN_WINDOW_CHARS = 240;
const TRIVIAL =
  /^(?:[)\]}>;,]+|<\/[\w.]+>|\/?>|\)\s*;?|import\b.*|export\s*\{.*\}\s*;?)$/u;

export const duplicatedBlock = (unit: Unit): MechanicalHit => {
  const significant: { line: number; text: string; offset: number }[] = [];
  let offset = 0;
  for (const [index, raw] of unit.text.split("\n").entries()) {
    const text = raw.trim();
    if (
      text &&
      !text.startsWith("//") &&
      !text.startsWith("/*") &&
      !text.startsWith("*") &&
      !TRIVIAL.test(text)
    ) {
      significant.push({ line: index + 1, offset, text });
    }
    offset += raw.length + 1;
  }
  const seen = new Map<string, number>();
  for (let i = 0; i + WINDOW <= significant.length; i += 1) {
    const window = significant.slice(i, i + WINDOW);
    const key = window.map((l) => l.text).join("\n");
    if (key.length < MIN_WINDOW_CHARS) {
      continue;
    }
    const first = seen.get(key);
    if (first === undefined) {
      seen.set(key, i);
      continue;
    }
    // Overlapping windows are one run of identical lines, not a copy.
    if (i - first >= WINDOW) {
      return {
        ...hit(
          `lines ${window[0].line}-${window.at(-1)?.line} repeat lines ${significant[first].line}-${significant[first + WINDOW - 1].line}`
        ),
        offset: window[0].offset,
      };
    }
  }
  return none;
};

// A commented line that reads as a statement rather than a sentence.
const CODE_LINE =
  /(?:[;{}(]\s*$|^(?:const|let|var|import|export|return|if|else|for|while|await|function|class|throw|try|catch)\b|^[\w$.[\]]+\s*\(.*\)\s*;?$|^[\w$.[\]]+\s*[+\-*/]?=\s*\S|=>\s*[{(]?$|^<\/?[A-Za-z][\w.]*(?:\s[^>]*)?\/?>$)/u;
const DIRECTIVE =
  /^\s*\/\/\s*(?:eslint|oxlint|biome|prettier|@ts-|istanbul|c8|v8|webpack|#|region|endregion|TODO|FIXME|NOTE|HACK|XXX)/iu;
const MIN_COMMENTED = 3;

export const commentedOutCode = (unit: Unit): MechanicalHit => {
  let run:
    | { start: number; code: number; lines: number; offset: number }
    | undefined;
  let offset = 0;
  // Most of the run must read as code: a header comment with one line ending
  // in a semicolon is still prose.
  const flush = (): MechanicalHit | undefined =>
    run &&
    run.lines >= MIN_COMMENTED &&
    run.code >= MIN_COMMENTED &&
    run.code / run.lines >= 0.6
      ? {
          ...hit(`${run.lines} commented-out lines from line ${run.start}`),
          offset: run.offset,
        }
      : undefined;
  for (const [index, raw] of unit.text.split("\n").entries()) {
    const comment = /^\s*\/\/(?!\/)(.*)$/u.exec(raw);
    if (comment && !DIRECTIVE.test(raw)) {
      run ??= { code: 0, lines: 0, offset, start: index + 1 };
      run.lines += 1;
      if (CODE_LINE.test(comment[1].trim())) {
        run.code += 1;
      }
    } else {
      const found = flush();
      if (found) {
        return found;
      }
      run = undefined;
    }
    offset += raw.length + 1;
  }
  return flush() ?? none;
};

// Packages a runtime or framework loads by name without an import.
const IMPLICIT = new Set([
  "react-dom",
  "sharp",
  "typescript",
  "tslib",
  "server-only",
  "client-only",
  "@swc/helpers",
  "pg-native",
  "encoding",
  "bufferutil",
  "utf-8-validate",
]);
const SEARCHED =
  /\.(?:[cm]?[jt]sx?|json|jsonc|css|scss|ya?ml|mdx?|html|toml|prisma|sh|vue|svelte|astro)$/u;

export const unusedDependency = (unit: Unit): MechanicalHit => {
  const repository = unit.facts?.repository;
  if (!repository) {
    throw new UnresolvedError("Needs the repository to search for imports");
  }
  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(unit.text) as Record<string, unknown>;
  } catch {
    throw new UnresolvedError("package.json does not parse");
  }
  const deps = Object.keys(
    (manifest.dependencies as Record<string, string> | undefined) ?? {}
  ).filter((name) => !(name.startsWith("@types/") || IMPLICIT.has(name)));
  if (deps.length === 0) {
    return none;
  }
  const dir = path.posix.dirname(unit.file);
  const others = repository
    .files(dir)
    .filter((file) => file !== unit.file && SEARCHED.test(file));
  // Scripts and config keys in the manifest itself name CLIs and plugins.
  const { dependencies: _deps, ...rest } = manifest;
  const haystacks = [JSON.stringify(rest)];
  for (const file of others) {
    haystacks.push(repository.read(file) ?? "");
  }
  // A package another dependency declares as a peer is loaded by that
  // dependency (shiki by rehype-pretty-code, @mdx-js/loader by @next/mdx).
  const peers = new Set<string>();
  let readable = 0;
  const installed = [
    ...Object.keys((manifest.dependencies as Record<string, string>) ?? {}),
    ...Object.keys((manifest.devDependencies as Record<string, string>) ?? {}),
  ];
  for (const other of installed) {
    for (let at = dir; ; at = path.posix.dirname(at)) {
      const text = repository.read(
        path.posix.join(at, "node_modules", other, "package.json")
      );
      if (text !== undefined) {
        readable += 1;
        try {
          const meta = JSON.parse(text) as {
            peerDependencies?: Record<string, string>;
          };
          for (const peer of Object.keys(meta.peerDependencies ?? {})) {
            peers.add(peer);
          }
        } catch {
          // An unreadable manifest names no peers.
        }
        break;
      }
      if (at === ".") {
        break;
      }
    }
  }
  // Without installed manifests every framework peer looks unused.
  if (installed.length > 0 && readable === 0) {
    throw new UnresolvedError(
      "Install dependencies so peer dependencies can be read"
    );
  }
  const unused = deps.filter((name) => {
    if (peers.has(name)) {
      return false;
    }
    const quoted = new RegExp(
      `["'\`]${name.replaceAll(/[.*+?^${}()|[\]\\/]/gu, "\\$&")}(?:["'\`/])|(?<![\\w@/-])${name.replaceAll(/[.*+?^${}()|[\]\\/]/gu, "\\$&")}(?![\\w-])`,
      "u"
    );
    return !haystacks.some((text) => quoted.test(text));
  });
  if (unused.length === 0) {
    return none;
  }
  // Every dependency unused means the package's source lives elsewhere (a
  // publishing wrapper built from the repo root), not that all are dead.
  if (unused.length === deps.length && deps.length > 1) {
    throw new UnresolvedError(
      "No file in the package imports any dependency; its source is built from elsewhere"
    );
  }
  const at = unit.text.indexOf(`"${unused[0]}"`);
  return {
    ...hit(
      `no file under ${dir === "." ? "the root" : dir} names ${unused.join(", ")}`
    ),
    offset: Math.max(0, at),
  };
};
export const ENGINEERING_RULES = [
  ...TEST_RULES,
  codeRule(
    {
      categoryId: "code-quality",
      check: oversized,
      hint: "Split by responsibility: move each self-contained part (a component, a parser, a table of data) into its own module with its own tests.",
      id: "engineering-oversized-file",
      preconditions: { notGenerated: true },
      scope: { exclude: GENERATED, include: SOURCE_FILES },
      source: skillSource(
        "skills/tidy/references/structural-quality-rubric.md",
        33
      ),
      status: "review-only",
      title: "File is over 1000 lines",
      unit: ["source"],
    },
    MODULE
  ),
  codeRule(
    {
      categoryId: "code-quality",
      check: typeBypass,
      hint: "Fix the type at its source, or narrow with a type guard. Where a suppression is truly needed, use @ts-expect-error with the reason on the same line.",
      id: "engineering-type-bypass",
      preconditions: { notGenerated: true },
      scope: {
        exclude: GENERATED,
        include: ["**/*.{ts,tsx,mts,cts}"],
      },
      source: skillSource("skills/tidy/references/ai-slop-patterns.md", 82),
      status: "review-only",
      title: "Type check bypassed",
      unit: ["source"],
    },
    MODULE
  ),
  codeRule(
    {
      categoryId: "code-quality",
      check: duplicatedBlock,
      hint: "Name the repeated block once as a function or component and call it from both places, so a fix lands everywhere.",
      id: "engineering-duplicated-block",
      preconditions: { notGenerated: true },
      // components/ui is a vendored kit (shadcn) whose variants repeat by design.
      scope: {
        exclude: [...GENERATED, "**/components/ui/**"],
        include: SOURCE_FILES,
      },
      source: skillSource(
        "skills/tidy/references/structural-quality-rubric.md",
        70
      ),
      status: "review-only",
      title: "The same block appears twice in one file",
      unit: ["source"],
    },
    MODULE
  ),
  codeRule(
    {
      categoryId: "dead-code",
      check: commentedOutCode,
      hint: "Delete it. Version control keeps the old code; a comment keeps a second, untested copy that drifts.",
      id: "engineering-commented-out-code",
      preconditions: { notGenerated: true },
      scope: { exclude: GENERATED, include: SOURCE_FILES },
      source: skillSource("skills/tidy/references/ai-slop-patterns.md", 171),
      status: "review-only",
      title: "Commented-out code",
      unit: ["source"],
    },
    MODULE
  ),
  codeRule(
    {
      categoryId: "dead-code",
      check: unusedDependency,
      hint: "Remove the dependency, then install and build. Check dynamic imports, framework plugins named in config, and CLIs run from CI before deleting.",
      id: "engineering-unused-dependency",
      preconditions: { notGenerated: true },
      scope: {
        exclude: ["**/fixtures/**", "**/__fixtures__/**", "**/examples/**"],
        include: ["**/package.json"],
      },
      source: skillSource(
        "skills/tidy/references/structural-quality-rubric.md",
        26
      ),
      status: "review-only",
      title: "Dependency nothing in the package imports",
      unit: ["source"],
    },
    MODULE
  ),
];
