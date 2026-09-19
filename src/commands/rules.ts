import type { Command } from "commander";

import { loadRules, resolveRulesDir } from "../rules/load.js";

export function registerRulesCommand(program: Command): void {
  const rules = program
    .command("rules")
    .description("Inspect and validate the rule files");
  rules
    .command("list")
    .description("List rules with tier, status and category")
    .option("--rules <path>", "Rules directory")
    .option("--allow-draft", "Include draft rules")
    .action((options: { rules?: string; allowDraft?: boolean }) => {
      const list = loadRules(resolveRulesDir(options.rules), {
        allowDraft: options.allowDraft ?? true,
      });
      for (const r of list) {
        process.stdout.write(
          `${r.id.padEnd(44)} ${r.tier.padEnd(10)} ${r.status.padEnd(11)} ${r.severity.padEnd(8)} ${r.categoryId}\n`
        );
      }
      process.stdout.write(`${list.length} rules\n`);
    });
  rules
    .command("check")
    .description("Validate every rule file; exits 1 on the first invalid rule")
    .option("--rules <path>", "Rules directory")
    .option("--allow-draft", "Accept rules with status draft")
    .action((options: { rules?: string; allowDraft?: boolean }) => {
      const dir = resolveRulesDir(options.rules);
      const all = loadRules(dir, { allowDraft: true });
      const drafts = all.filter((r) => r.status === "draft");
      const active = all.length - drafts.length;
      if (drafts.length > 0 && !options.allowDraft) {
        process.stderr.write(
          `FAIL: ${drafts.length} draft rule${drafts.length === 1 ? "" : "s"} (${drafts.map((r) => r.id).join(", ")}). Finish the question or pass --allow-draft.\n`
        );
        process.exitCode = 1;
        return;
      }
      process.stdout.write(
        `PASS: ${active} active rule${active === 1 ? "" : "s"}${drafts.length ? `, ${drafts.length} draft` : ""} in ${dir}\n`
      );
    });
}
