// Build-time snapshot of the CLI's rule registry for the landing page. It
// loads rules through the same `loadRules` the CLI uses, so the rule list,
// every count and the playground subset come from data/rules and the code
// rules, never from numbers typed into the page. Runs before dev, build,
// typecheck and test; the output is gitignored.
import { writeFileSync } from "node:fs";
import path from "node:path";

import { loadRules, resolveRulesDir } from "../../../src/rules/load.ts";
import { CATEGORIES } from "../../../src/rules/taxonomy.ts";

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
const labels = new Map(CATEGORIES.map((c) => [c.id, c.label]));

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
    fix: rule.fix.hint ?? "",
    id: rule.id,
    mechanical: rule.mechanical,
    severity: rule.severity,
    status: rule.status,
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
        category: labels.get(rule.categoryId) ?? rule.categoryId,
        id: rule.id,
        status: rule.status,
        tier: rule.tier,
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
