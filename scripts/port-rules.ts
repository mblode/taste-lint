// Regenerate rule files from a sibling agent-skills checkout.
//
//   npm run port-rules -- --skills-dir ../agent-skills [--out data/rules] [--check] [--write] [--only typography-audit,ui-design]
//
// Two frontmatter dialects are read: ui-design (`id`, `category`,
// `defaultTier`, `detect`, a `## Detection` section with an rg command and a
// false-positive paragraph) and typography-audit / docs-writing (`title`,
// `impact`, `tags`, an Incorrect/Correct pair).
//
// A ui-design rule whose detection is one rg command JavaScript can run
// (optionally piped through `xargs rg --files-without-match`) ships as a
// mechanical rule over the whole file (`unit: [source]`), review-only, with
// `--write`. Everything else (loops, PCRE-only syntax, rendered or rubric
// checks, the copy and typography sources that need a hand-written question)
// is written as a draft under data/rule-drafts, which the loader never reads.
// Existing rule files keep every key listed in `handWritten`; `--check` exits
// 1 when a regeneration would change a traced key or a source has moved.

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { parse, stringify } from "yaml";

import { parseFrontmatter } from "../src/lib/frontmatter.ts";

interface Args {
  skillsDir: string;
  out: string;
  draftsOut: string;
  check: boolean;
  write: boolean;
  only: string[] | null;
}

const args = ((): Args => {
  const { values } = parseArgs({
    options: {
      check: { type: "boolean" },
      only: { type: "string" },
      out: { type: "string" },
      "skills-dir": { type: "string" },
      write: { type: "boolean" },
    },
  });
  const skillsDir =
    values["skills-dir"] ??
    process.env.AGENT_SKILLS_DIR ??
    path.resolve("../agent-skills");
  const out = values.out ?? path.resolve("data/rules");
  return {
    check: values.check ?? false,
    draftsOut: path.join(path.dirname(out), "rule-drafts"),
    only: values.only?.split(",") ?? null,
    out,
    skillsDir: path.resolve(skillsDir),
    write: values.write ?? false,
  };
})();

const SKILLS: {
  skill: string;
  folder: string;
  dialect: "ui-design" | "code-pair";
}[] = [
  { dialect: "code-pair", folder: "rules", skill: "typography-audit" },
  { dialect: "ui-design", folder: "rules", skill: "ui-design" },
  { dialect: "code-pair", folder: "rules", skill: "docs-writing" },
];

// Prefix of the source rule id -> taste-training category.
const CATEGORY_MAP: [RegExp, string][] = [
  [/^punct-/, "typographic-detail"],
  [/^hierarchy-/, "type-hierarchy"],
  [/^(size|spacing)-/, "reading-comfort"],
  [/^font-/, "type-quality"],
  [/^pairing-/, "type-pairing"],
  [/^brand-/, "type-voice"],
  [/^display-/, "type-hierarchy"],
  [/^opentype-/, "typographic-detail"],
  [/^layout-/, "reading-comfort"],
  [/^microcopy-/, "actionable-microcopy"],
  [/^slop-unverifiable-proof/, "evidence-over-claims"],
  [/^slop-token-drift|^slop-near-duplicate-scale/, "look-constraints"],
  [/^slop-/, "generic-decoration"],
  [/^type-/, "reading-comfort"],
  [/^a11y-|^focus-|^interaction-/, "focus-and-a11y"],
  [/^forms-/, "form-usability"],
  [/^states-|^async-/, "state-coverage"],
  [/^perf-|^mobile-|^dark-i18n-/, "resilience"],
  [/^voice-/, "reader-first-framing"],
  [/^clarity-/, "reader-first-framing"],
  [/^structure-|^nav-|^scan-/, "page-structure"],
  [/^code-/, "reference-reading"],
  [/^format-/, "typographic-detail"],
  [/^hygiene-|^review-/, "reference-reading"],
];

const DOMAIN_BY_CATEGORY: Record<string, string> = {
  "actionable-microcopy": "copywriting",
  "evidence-over-claims": "copywriting",
  "focus-and-a11y": "interaction",
  "form-usability": "interaction",
  "generic-decoration": "craft",
  "look-constraints": "craft",
  "page-structure": "copywriting",
  "reader-first-framing": "copywriting",
  "reading-comfort": "typography",
  "reference-reading": "copywriting",
  resilience: "craft",
  "state-coverage": "interaction",
  "type-hierarchy": "typography",
  "type-pairing": "typography",
  "type-quality": "typography",
  "type-voice": "typography",
  "typographic-detail": "typography",
};

const SEVERITY_MAP: Record<string, string> = {
  CRITICAL: "major",
  HIGH: "minor",
  LOW: "minor",
  "LOW-MEDIUM": "minor",
  MEDIUM: "minor",
  "MEDIUM-HIGH": "minor",
  backlog: "minor",
  "fix-this-sprint": "minor",
  "release-blocker": "major",
};

// A subset of PCRE that JavaScript accepts as-is. A leading `(?s)` becomes the
// `s` flag; inline modifier groups such as `(?i:...)`, possessive quantifiers,
// `\K`, `\h` and named groups in PCRE syntax are left for a hand port.
const translateRegex = (
  raw: string
): { pattern: string; flags: string } | null => {
  let pattern = raw;
  let flags = "gu";
  if (pattern.startsWith("(?s)")) {
    pattern = pattern.slice(4);
    flags += "s";
  }
  if (/\\K|\(\?[>|]|\(\?[a-z]+:|\+\+|\*\+|\?\+|\\h|\(\?P</.test(pattern)) {
    return null;
  }
  try {
    const re = new RegExp(pattern, flags);
    void re;
    return { flags, pattern };
  } catch {
    return null;
  }
};

interface RgCommand {
  pattern: string;
  /** rg flags that change matching: i (case), U (multiline). */
  caseInsensitive: boolean;
  multiline: boolean;
  include: string[];
  exclude: string[];
  /** `| xargs rg --files-without-match -P '<pattern>'`: fire only when absent. */
  absent?: string;
  /** The command continued into a pipeline or loop this script cannot run. */
  piped: boolean;
}

const RG_TYPE_GLOBS: Record<string, string[]> = {
  css: ["**/*.css"],
  js: ["**/*.js", "**/*.jsx", "**/*.mjs", "**/*.cjs"],
  ts: ["**/*.ts", "**/*.tsx"],
};

// Split a shell line on `|` outside single quotes, so an alternation inside
// the rg pattern is not mistaken for a pipe.
const splitPipeline = (line: string): string[] => {
  const parts: string[] = [];
  let current = "";
  let quoted = false;
  for (const ch of line) {
    if (ch === "'") {
      quoted = !quoted;
    }
    if (ch === "|" && !quoted) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  parts.push(current.trim());
  return parts;
};

// The first rg invocation in the first bash block, with the shell
// continuation lines joined so the pipeline is visible.
const firstRgCommand = (body: string): RgCommand | null => {
  const block = body.match(/```bash\n([\s\S]*?)```/);
  if (!block) {
    return null;
  }
  const joined = block[1].replaceAll(/\\\n\s*/g, " ");
  const commands = joined
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  const line = commands.find((l) => l.startsWith("rg "));
  if (!line) {
    return null;
  }
  const [head, ...rest] = splitPipeline(line);
  const quoted = head.match(/'((?:[^'\\]|\\.)*)'/);
  if (!quoted) {
    return null;
  }
  const shortFlags = [...head.matchAll(/(?:^|\s)-([a-zA-Z]+)(?=\s)/g)]
    .map((m) => m[1])
    .join("");
  const include: string[] = [];
  const exclude: string[] = [];
  for (const m of head.matchAll(/(?:-g|--glob)\s+'([^']+)'/g)) {
    if (m[1].startsWith("!")) {
      exclude.push(`**/${m[1].slice(1)}`);
    } else {
      include.push(`**/${m[1]}`);
    }
  }
  for (const m of head.matchAll(/--type[= ](\w+)/g)) {
    include.push(...(RG_TYPE_GLOBS[m[1]] ?? []));
  }
  let absent: string | undefined;
  let piped = rest.length > 0;
  if (rest.length === 1) {
    const without = rest[0].match(
      /^xargs(?:\s+-r)?\s+rg\s+--files-without-match\s+(?:-P\s+)?'((?:[^'\\]|\\.)*)'\s*$/
    );
    if (without) {
      absent = without[1];
      piped = false;
    }
  }
  return {
    absent,
    caseInsensitive: shortFlags.includes("i"),
    exclude,
    include,
    multiline: shortFlags.includes("U"),
    pattern: quoted[1],
    piped,
  };
};

const fenced = (body: string, marker: RegExp): string[] => {
  const idx = body.search(marker);
  if (idx === -1) {
    return [];
  }
  const rest = body.slice(idx);
  const block = rest.match(/```[a-z]*\n([\s\S]*?)```/);
  return block
    ? block[1]
        .split("\n")
        .map((l) => l.trim())
        .filter(
          (l) =>
            l &&
            !l.startsWith("//") &&
            !l.startsWith("/*") &&
            !l.startsWith("<!--")
        )
    : [];
};

const firstParagraph = (body: string): string => {
  const parts = body.split(/\n\s*\n/).map((p) => p.trim());
  return (
    parts.find(
      (p) =>
        p &&
        !p.startsWith("#") &&
        !p.startsWith("```") &&
        !p.startsWith("**") &&
        !p.startsWith("|")
    ) ?? ""
  );
};

const h2Line = (source: string): number => {
  const lines = source.split("\n");
  const i = lines.findIndex((l) => l.startsWith("## "));
  return i === -1 ? 1 : i + 1;
};

// Keys sorted at every depth, so two blocks with the same content compare
// equal whatever order a hand wrote them in.
const canonical = (value: unknown): unknown =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(
        Object.keys(value as Record<string, unknown>)
          .toSorted()
          .map((k) => [k, canonical((value as Record<string, unknown>)[k])])
      )
    : value;

const sortKeys = (
  raw: Record<string, unknown>,
  order: string[]
): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const key of order) {
    if (key in raw) {
      out[key] = raw[key];
    }
  }
  for (const key of Object.keys(raw)) {
    if (!(key in out)) {
      out[key] = raw[key];
    }
  }
  return out;
};

const ORDER = [
  "id",
  "title",
  "categoryId",
  "source",
  "scope",
  "unit",
  "mechanical",
  "question",
  "thresholds",
  "severity",
  "fix",
  "preconditions",
  "status",
  "handWritten",
  "portNotes",
];

let changed = 0;
let written = 0;
let unmapped = 0;
let available = 0;
let ported = 0;
const problems: string[] = [];

for (const { skill, folder, dialect } of SKILLS) {
  if (args.only && !args.only.includes(skill)) {
    continue;
  }
  const dir = path.join(args.skillsDir, "skills", skill, folder);
  if (!fs.existsSync(dir)) {
    problems.push(`missing ${dir}`);
    continue;
  }
  for (const name of fs.readdirSync(dir).toSorted()) {
    if (!name.endsWith(".md") || name.startsWith("_")) {
      continue;
    }
    const relPath = `skills/${skill}/${folder}/${name}`;
    const source = fs.readFileSync(path.join(dir, name), "utf-8");
    const { fm, body } = parseFrontmatter(source);
    const sourceId = (fm.id ?? name.slice(0, -3)).trim();
    const category = CATEGORY_MAP.find(([re]) => re.test(sourceId))?.[1];
    if (!category) {
      unmapped += 1;
      continue;
    }
    const domain = DOMAIN_BY_CATEGORY[category];
    const id = `${domain}-${sourceId.replace(/^[a-z]+-/, "")}`.replaceAll(
      /[^a-z0-9-]/g,
      "-"
    );
    const tier = fm.defaultTier ?? fm.impact ?? "MEDIUM";
    // Scope is derived from the unit kinds unless the rg command names file
    // types; a shipped source rule always names them.
    const generated: Record<string, unknown> = {
      categoryId: category,
      fix: { hint: `TODO: ${firstParagraph(body).slice(0, 200)}` },
      id,
      portNotes: [] as string[],
      severity: SEVERITY_MAP[tier] ?? "minor",
      source: {
        line: h2Line(source),
        path: relPath,
        repo: "mblode/agent-skills",
        ruleId: sourceId,
      },
      status: "draft",
      title: (fm.title ?? sourceId).trim(),
      unit:
        domain === "typography" &&
        /^(size|spacing|hierarchy|font|display)-/.test(sourceId)
          ? ["class-list", "element"]
          : ["paragraph", "heading", "jsx-text", "attr-string"],
    };
    const notes = generated.portNotes as string[];
    let shippable = false;
    if (dialect === "ui-design") {
      const rg = firstRgCommand(body);
      const translated = rg ? translateRegex(rg.pattern) : null;
      const absent = rg?.absent ? translateRegex(rg.absent) : null;
      if (rg && (rg.include.length > 0 || rg.exclude.length > 0)) {
        generated.scope = {
          ...(rg.exclude.length > 0 ? { exclude: rg.exclude } : {}),
          include:
            rg.include.length > 0 ? rg.include : ["**/*.tsx", "**/*.jsx"],
        };
      }
      if (
        fm.detect === "static" &&
        rg &&
        translated &&
        !rg.piped &&
        (rg.absent === undefined || absent)
      ) {
        // The whole file is the unit; rg's -U and -i become flags.
        let flags = translated.flags;
        if (rg.multiline && !flags.includes("s")) {
          flags += "s";
        }
        if (rg.caseInsensitive) {
          flags += "i";
        }
        generated.mechanical = {
          ...(absent ? { absent: absent.pattern } : {}),
          flags,
          regex: translated.pattern,
        };
        generated.unit = ["source"];
        generated.scope ??= { include: ["**/*.tsx", "**/*.jsx"] };
        generated.status = "review-only";
        generated.fix = { hint: firstParagraph(body).slice(0, 300) };
        shippable = true;
      } else if (rg && !translated) {
        notes.push(
          `rg pattern uses PCRE features JavaScript lacks: ${rg.pattern}`
        );
      } else if (rg?.piped) {
        notes.push("detection is a shell pipeline or loop; port by hand");
      }
      if (fm.detect === "rendered") {
        generated.unit = ["element"];
        notes.push(
          "detect: rendered; only the rendered extractor can decide this rule"
        );
      }
      const fp =
        body.match(
          /\*\*False-positive guards:\*\*\n([\s\S]*?)(?:\n\n|\n\*\*)/
        )?.[1] ?? body.match(/```\n\n([^\n#*][^\n]+)\n/)?.[1];
      if (!shippable) {
        generated.question = {
          context: ["element", "docType"],
          criteria: {
            false: {
              examples: fenced(body, /\*\*Applied \(passes\)|\*\*Correct/),
              what: fp
                ? fp.trim().slice(0, 300)
                : "TODO: the correct code this pattern also matches",
            },
            true: {
              examples: fenced(
                body,
                /\*\*Anti-pattern \(fails\)|\*\*Incorrect/
              ),
              what: "TODO",
            },
          },
          instructions: `TODO: ${firstParagraph(body).slice(0, 400)}`,
        };
      }
    } else {
      generated.question = {
        context: ["docType"],
        criteria: {
          false: { examples: fenced(body, /\*\*Correct/), what: "TODO" },
          true: { examples: fenced(body, /\*\*Incorrect/), what: "TODO" },
        },
        instructions: `TODO: ${firstParagraph(body).slice(0, 400)}`,
      };
    }
    for (const side of ["true", "false"] as const) {
      const c = (
        generated.question as
          | { criteria: Record<string, { examples: string[] }> }
          | undefined
      )?.criteria[side];
      if (c && c.examples.length === 0) {
        c.examples = ["TODO"];
      }
    }
    if (shippable) {
      delete generated.portNotes;
    }
    const target = path.join(args.out, domain, `${id}.yaml`);
    let existing: Record<string, unknown> | null = null;
    if (fs.existsSync(target)) {
      existing = parse(fs.readFileSync(target, "utf-8")) as Record<
        string,
        unknown
      >;
    }
    const handWritten = new Set<string>(
      existing?.handWritten as string[] | undefined
    );
    const merged: Record<string, unknown> = { ...generated };
    if (existing) {
      for (const key of handWritten) {
        if (key in existing) {
          merged[key] = existing[key];
        }
      }
      if (handWritten.size > 0) {
        merged.handWritten = [...handWritten];
      }
      merged.status = existing.status ?? merged.status;
      if (existing.status !== "draft") {
        delete merged.portNotes;
      }
    }
    const outText = `# Ported from mblode/agent-skills ${relPath} by scripts/port-rules.ts.\n# Keys listed in handWritten are preserved on re-run; everything else is regenerated.\n${stringify(sortKeys(merged, ORDER), { lineWidth: 100 })}`;
    if (existing) {
      // Drift check: only the keys that trace to the source file, and only
      // when they are not hand-written.
      const traced = [
        "source",
        ...(handWritten.has("mechanical") ? [] : ["mechanical"]),
      ];
      const pick = (obj: Record<string, unknown>): string =>
        stringify(
          canonical(Object.fromEntries(traced.map((k) => [k, obj[k]]))),
          { lineWidth: 100 }
        );
      if (pick(existing) !== pick(merged)) {
        changed += 1;
        if (args.check) {
          problems.push(
            `source drift in ${path.relative(process.cwd(), target)}`
          );
          continue;
        }
        const updated: Record<string, unknown> = Object.fromEntries(
          Object.entries(existing).filter(([k]) => !traced.includes(k))
        );
        for (const key of traced) {
          if (merged[key] !== undefined) {
            updated[key] = merged[key];
          }
        }
        fs.writeFileSync(
          target,
          `${fs
            .readFileSync(target, "utf-8")
            .split("\n")
            .filter((l) => l.startsWith("#"))
            .join(
              "\n"
            )}\n${stringify(sortKeys(updated, ORDER), { lineWidth: 100 })}`
        );
        written += 1;
      }
      continue;
    }
    if (shippable) {
      ported += 1;
      if (!args.check && args.write) {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, outText);
        written += 1;
      }
      continue;
    }
    available += 1;
    // A draft someone has finished by hand and moved under data/rules is not
    // regenerated as a draft.
    if (!args.check && args.write && !existing) {
      const draft = path.join(args.draftsOut, domain, `${id}.yaml`);
      fs.mkdirSync(path.dirname(draft), { recursive: true });
      fs.writeFileSync(draft, outText);
      written += 1;
    }
  }
}

// Check mode also walks every shipped rule, whatever its file name, and
// re-derives the traced keys from its own `source.path`. A rule ported one to
// one (source.ruleId equals the source file's id) must still cite the H2 line;
// a rule hand-cut from a guideline or a multi-check source file must cite a
// line that still exists and carries text. A ui-design rule whose mechanical
// part is not hand-written must still carry the source rg pattern.
let checked = 0;
if (args.check) {
  const yamlFiles: string[] = [];
  for (const domain of fs.readdirSync(args.out, { withFileTypes: true })) {
    if (!domain.isDirectory() || domain.name === "schema") {
      continue;
    }
    for (const name of fs.readdirSync(path.join(args.out, domain.name))) {
      if (name.endsWith(".yaml")) {
        yamlFiles.push(path.join(args.out, domain.name, name));
      }
    }
  }
  for (const file of yamlFiles.toSorted()) {
    const rule = parse(fs.readFileSync(file, "utf-8")) as {
      id: string;
      handWritten?: string[];
      mechanical?: { regex?: string };
      source: { repo: string; path: string; line: number; ruleId?: string };
    };
    if (rule.source.repo !== "mblode/agent-skills") {
      continue;
    }
    const rel = path.relative(process.cwd(), file);
    const sourceFile = path.join(args.skillsDir, rule.source.path);
    if (!fs.existsSync(sourceFile)) {
      problems.push(`${rel}: source ${rule.source.path} is missing`);
      continue;
    }
    checked += 1;
    const sourceText = fs.readFileSync(sourceFile, "utf-8");
    const { fm } = parseFrontmatter(sourceText);
    const cited = sourceText.split("\n")[rule.source.line - 1];
    if (cited === undefined || cited.trim() === "") {
      changed += 1;
      problems.push(
        `${rel}: source.line ${rule.source.line} is blank or past the end of ${rule.source.path}`
      );
    } else if (rule.source.ruleId && fm.id === rule.source.ruleId) {
      const line = h2Line(sourceText);
      if (line !== rule.source.line) {
        changed += 1;
        problems.push(
          `${rel}: source.line is ${rule.source.line} but the H2 is now on line ${line}`
        );
      }
    }
    const handWritten = new Set(rule.handWritten);
    if (
      rule.source.path.includes("/ui-design/") &&
      !handWritten.has("mechanical") &&
      rule.mechanical?.regex
    ) {
      const rg = firstRgCommand(parseFrontmatter(sourceText).body);
      const translated = rg ? translateRegex(rg.pattern) : null;
      if (translated?.pattern !== rule.mechanical.regex) {
        changed += 1;
        problems.push(
          `${rel}: mechanical.regex no longer matches the source rg pattern`
        );
      }
    }
  }
}

if (problems.length > 0) {
  process.stderr.write(`${problems.join("\n")}\n`);
}
process.stdout.write(
  `${args.check ? `${checked} shipped rules checked against the source; ${changed} drifted` : `wrote ${written} rule file${written === 1 ? "" : "s"}`}; ${ported} mechanical port${ported === 1 ? "" : "s"} and ${available} draft${available === 1 ? "" : "s"} available (pass --write to generate); ${unmapped} source rules have no category mapping\n`
);
if (args.check && (changed > 0 || problems.length > 0)) {
  process.exit(1);
}
