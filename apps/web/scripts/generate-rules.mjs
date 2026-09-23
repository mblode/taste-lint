// Build-time snapshot of the CLI's rule registry for the landing page. It
// loads rules through the same `loadRules` the CLI uses, so the rule list,
// every count and the playground subset come from data/rules and the code
// rules, never from numbers typed into the page. Runs before dev, build,
// typecheck and test; the output is gitignored.
//
// It also snapshots the title and description of every page in the docs
// navigation, read from the MDX frontmatter, for the zone's llms.txt.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { parseFrontmatter } from "../../../src/lib/frontmatter.ts";
import { loadRules, resolveRulesDir } from "../../../src/rules/load.ts";

// Mechanical copy rules the browser playground runs. Each one decides from a
// regex or phrase list alone, so the in-browser result matches the CLI's
// mechanical pass for the same text.
const PLAYGROUND_IDS = [
  "copywriting-toast-successfully",
  "copywriting-claim-without-evidence",
  "copywriting-dead-weight-hedges",
  "copywriting-nominalisations",
  "copywriting-anthropomorphism",
  "copywriting-emoji-in-ui",
  "copywriting-latinisms",
  "typography-ellipsis",
];

const root = path.resolve(import.meta.dirname, "../../..");
const rules = loadRules(resolveRulesDir(path.join(root, "data/rules")));
const byId = new Map(rules.map((rule) => [rule.id, rule]));

const playground = PLAYGROUND_IDS.map((id) => {
  const rule = byId.get(id);
  if (!rule?.mechanical) {
    throw new Error(
      `Playground rule ${id} is missing or has no mechanical check`
    );
  }
  return {
    // A rule with a Jev question only nominates; Jev decides in the CLI.
    decidedBy: rule.question ? "jev" : "mechanical",
    fix: rule.fix.hint,
    id: rule.id,
    mechanical: rule.mechanical,
    title: rule.title,
  };
});

const domains = [...new Set(rules.map((rule) => rule.domain))]
  .toSorted()
  .map((domain) => ({
    domain,
    rules: rules
      .filter((rule) => rule.domain === domain)
      .map((rule) => ({
        id: rule.id,
        status: rule.status,
        title: rule.title,
      })),
  }));

const snapshot = {
  active: rules.filter((rule) => rule.status === "active").length,
  domains,
  playground,
  total: rules.length,
};

const out = path.join(import.meta.dirname, "../lib/rules.generated.json");
writeFileSync(out, `${JSON.stringify(snapshot, null, 2)}\n`);
process.stdout.write(
  `rules.generated.json: ${snapshot.total} rules, ${snapshot.active} active\n`
);

const docsConfig = JSON.parse(
  readFileSync(path.join(root, "docs/docs.json"), "utf-8")
);
const docsPages = docsConfig.navigation.groups.flatMap((group) =>
  group.pages.map((page) => {
    const { fm } = parseFrontmatter(
      readFileSync(path.join(root, "docs", `${page}.mdx`), "utf-8")
    );
    if (!(fm.title && fm.description)) {
      throw new Error(`docs/${page}.mdx needs a title and a description`);
    }
    return {
      description: fm.description,
      path: page === "index" ? "" : `/${page}`,
      title: fm.title,
    };
  })
);
writeFileSync(
  path.join(import.meta.dirname, "../lib/docs-pages.generated.json"),
  `${JSON.stringify(docsPages, null, 2)}\n`
);
