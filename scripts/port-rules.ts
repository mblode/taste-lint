// Regenerate draft rule files from a sibling agent-skills checkout.
//
//   npm run port-rules -- --skills-dir ../agent-skills [--out data/rules] [--check] [--only typography-audit,ui-design]
//
// Two frontmatter dialects are read: ui-design (`id`, `category`,
// `defaultTier`, `detect`, a `## Detection` section with an rg pattern and a
// false-positive paragraph) and typography-audit / docs-writing (`title`,
// `impact`, `tags`, an Incorrect/Correct pair). Existing rule files keep every
// key listed in `handWritten`; everything else is regenerated. `--check` exits
// 1 when a regeneration would change a non-hand-written key.

import fs from "node:fs";
import path from "node:path";

import { parse, stringify } from "yaml";

import { parseFrontmatter } from "../src/lib/frontmatter.ts";

interface Args {
  skillsDir: string;
  out: string;
  check: boolean;
  writeDrafts: boolean;
  only: string[] | null;
}

const args = ((): Args => {
  const a = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = a.indexOf(flag);
    return i === -1 ? undefined : a[i + 1];
  };
  const skillsDir =
    get("--skills-dir") ??
    process.env.AGENT_SKILLS_DIR ??
    path.resolve("../agent-skills");
  return {
    check: a.includes("--check"),
    only: get("--only")?.split(",") ?? null,
    out: get("--out") ?? path.resolve("data/rules"),
    skillsDir: path.resolve(skillsDir),
    writeDrafts: a.includes("--write-drafts"),
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

// A subset of PCRE that JavaScript accepts as-is. Anything else is dropped
// and noted so the mechanical part is hand-written.
const translateRegex = (pattern: string): string | null => {
  if (/\\K|\(\?[>|]|\+\+|\*\+|\?\+|\\h|\(\?P</.test(pattern)) {
    return null;
  }
  try {
    const re = new RegExp(pattern, "u");
    void re;
    return pattern;
  } catch {
    return null;
  }
};

const firstRgPattern = (
  body: string
): { pattern: string; globs: string[] } | null => {
  const block = body.match(/```bash\n([\s\S]*?)```/);
  if (!block) {
    return null;
  }
  const line = block[1].split("\n").find((l) => l.trim().startsWith("rg "));
  if (!line) {
    return null;
  }
  const quoted = line.match(/'((?:[^'\\]|\\.)*)'/);
  if (!quoted) {
    return null;
  }
  const globs = [...line.matchAll(/-g\s+'([^']+)'/g)].map((m) => `**/${m[1]}`);
  return { globs, pattern: quoted[1] };
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
  "domain",
  "source",
  "related",
  "scope",
  "unit",
  "tier",
  "mechanical",
  "question",
  "thresholds",
  "severity",
  "severityOverrides",
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
    const generated: Record<string, unknown> = {
      categoryId: category,
      domain,
      fix: {
        hint: `TODO: ${firstParagraph(body).slice(0, 200)}`,
        mode: "none",
      },
      handWritten: [],
      id,
      portNotes: [] as string[],
      scope: {
        exclude: ["**/*.test.*", "**/*.spec.*", "**/*.stories.*"],
        include: ["**/*.md", "**/*.mdx", "**/*.tsx", "**/*.jsx"],
      },
      severity: SEVERITY_MAP[tier] ?? "minor",
      source: {
        line: h2Line(source),
        path: relPath,
        repo: "mblode/agent-skills",
        ruleId: sourceId,
        tier,
      },
      status: "draft",
      tier: "jev",
      title: (fm.title ?? sourceId).trim(),
      unit:
        domain === "typography" &&
        /^(size|spacing|hierarchy|font|display)-/.test(sourceId)
          ? ["class-list", "element"]
          : ["paragraph", "heading", "jsx-text", "attr-string"],
    };
    const notes = generated.portNotes as string[];
    if (dialect === "ui-design") {
      const rg = firstRgPattern(body);
      if (rg) {
        const translated = translateRegex(rg.pattern);
        if (translated) {
          generated.mechanical = { flags: "gu", regex: translated };
          generated.tier = "both";
        } else {
          notes.push(
            `rg pattern uses PCRE features JavaScript lacks: ${rg.pattern}`
          );
        }
        if (rg.globs.length > 0) {
          (generated.scope as { include: string[] }).include = rg.globs;
        }
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
            examples: fenced(body, /\*\*Anti-pattern \(fails\)|\*\*Incorrect/),
            what: "TODO",
          },
        },
        instructions: `TODO: ${firstParagraph(body).slice(0, 400)}`,
        type: "noul",
      };
    } else {
      generated.question = {
        context: ["docType"],
        criteria: {
          false: { examples: fenced(body, /\*\*Correct/), what: "TODO" },
          true: { examples: fenced(body, /\*\*Incorrect/), what: "TODO" },
        },
        instructions: `TODO: ${firstParagraph(body).slice(0, 400)}`,
        type: "noul",
      };
    }
    for (const side of ["true", "false"] as const) {
      const c = (
        generated.question as {
          criteria: Record<string, { examples: string[] }>;
        }
      ).criteria[side];
      if (c.examples.length === 0) {
        c.examples = ["TODO"];
      }
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
      merged.handWritten = [...handWritten];
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
        stringify(Object.fromEntries(traced.map((k) => [k, obj[k]])), {
          lineWidth: 100,
        });
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
    available += 1;
    if (!args.check && args.writeDrafts) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, outText);
      written += 1;
    }
  }
}

if (problems.length > 0) {
  process.stderr.write(`${problems.join("\n")}\n`);
}
process.stdout.write(
  `${args.check ? `${changed} rule file${changed === 1 ? "" : "s"} drifted from the source` : `wrote ${written} rule file${written === 1 ? "" : "s"}`}; ${available} draft${available === 1 ? "" : "s"} available (pass --write-drafts to generate); ${unmapped} source rules have no category mapping\n`
);
if (args.check && changed > 0) {
  process.exit(1);
}
