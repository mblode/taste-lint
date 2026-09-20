---
title: Taste-lint review and tidy
hidden: true
---

# Taste-lint review and tidy

Rating after this pass: **7/10**. This is an engineering judgment, not a measured accuracy score.

The architecture has useful boundaries: extraction produces units, the shared judge owns evaluation, deterministic checks own measurement, and reporting preserves rule-level evidence. Provider responses are validated, errors are sanitized, cache entries are isolated by question/state/model, and semantic rules remain advisory until tuned. The CLI has useful machine-readable output and packaged-artifact checks.

The largest remaining product constraint is semantic evidence. The 395-sample Blode-co reference is a stratified diagnostic sample from one repository, with many short labels and technical snippets. Its agreement rate cannot establish repository-wide precision or broad rule readiness. The latest Codex labels contain only 26 positive examples across the sampled rules. More representative positive and negative examples per rule, separate held-out repositories, and explicit document-purpose coverage would improve confidence more than adding more rules.

## Confirmed findings and applied fixes

- **Major: parse failures could produce a successful scan.** `src/lint.ts:153` and `src/lint.ts:237`. Broken JSX generated parse-error units, while completion depended only on provider errors. Empty lint selections also exited successfully. Fix applied: propagate parse failures, Markdown fallback parsing, and empty selections into incomplete status and exit 2. Keep the empty-scope message and make the incomplete message cover parser failures. Regression checks exercise both lint and scan with malformed JSX and lint with excluded inputs.
- **Major: tuning could publish decisions after provider failures.** `src/eval/tune.ts:147`. Failed requests reduced the scored set but did not prevent `--write`, and the command returned success. Fix applied: return exit 2 with no decisions before entering the write path. A regression verifies existing tuning remains byte-for-byte unchanged.
- **Major: A/B correctness vectors were not paired by identity.** `src/eval/tune.ts:248` and `src/eval/tune.ts:255`. A variant's missing context or different preconditions can remove different samples; positional vectors then either throw or compare unrelated samples. Fix applied: intersect by sample ID before calculating either variant's metrics, disclose exclusions, and decline a paired test after provider failures or with zero joint observations. Regression checks exercise a contextual variant and failed requests.
- **Major for custom rules: tuning could choose an invalid threshold.** `src/eval/tune.ts:70`. The candidate grid started at 0.5 regardless of the review threshold, while the rule loader requires act > review. Fix applied: restrict candidates to thresholds above that rule's review threshold; a regression covers review=0.8.
- **Tidy: remove repeated neighbour lookup scans.** `src/extract/tsx.ts:497`. Attaching each element's neighbours used a full `units.find` search. Fix applied: build one source-offset map and perform direct lookups. This removes quadratic work in this attachment pass; no overall speedup claim was benchmarked.

## Remaining priorities

1. Expand evaluation coverage by rule and document purpose; report positive-class precision and recall rather than relying on aggregate agreement dominated by negatives. Preserve the AI labeling workflow and model provenance.
2. Export the full question rubric, including positive/negative examples, with blind samples. `src/scan/samples.ts` currently exports the instructions string while `src/rules/question.ts` sends structured criteria to Jev. Existing labels remain tied to their exported instructions; richer samples should form a new dataset version.
3. Keep architecture checks explicit about their limits. Native dependency checks do not resolve a complete TypeScript project graph; the dependency-cruiser adapter is the existing boundary for that work.
4. Consolidate repeated parsing only after profiling a representative large repository. TSX extraction and source-fact analysis currently parse the same source separately; a shared parse result is a plausible simplification, but changing parser ownership deserves dedicated validation.

## Scope and evidence

- Reviewed the working tree at HEAD `72392b1`, including tracked changes and new files; preserved all prior edits. The user explicitly expanded review and tidy to the whole repository.
- Repository-wide subsystem review: CLI/public API, config and file discovery, Markdown/TSX/rendered extraction, repository facts, rule loading and representative rule implementations, provider/cache/batching, findings/fixes/suppressions, scan baselines/decisions/graph import, labeling/evaluation/tuning, reports, package configuration, CI, and release workflow.
- This was a risk-focused subsystem review, not an exhaustive proof of every rule or dependency. No live provider calls, browser capture, publishing, or new labels were needed for this review.
- Skills applied sequentially: pr-reviewer for evidence-based findings, then tidy for fixes. Read severity, context-error, security, and performance references. Severity rubric: "incorrect state transitions or data handling" is major. Context rubric: "The code is right and the context is wrong" motivates checking sibling contracts. Security rubric: "Validate and sanitize input" applies at provider and artifact boundaries. Performance rubric distinguishes real repeated work from speculative optimization.
- No additional scoped AGENTS.md, CLAUDE.md, or REVIEW.md was found in this repository inventory. Root AGENTS.md governed the work.
- Baseline at the prior revision: 155 tests passing, 161 active rules, 79 source ports with zero drift. Six new regression cases cover the fixes above.
- Production dependency audit: `npm audit --omit=dev --json` returned zero known vulnerabilities. This is an advisory-database check, not proof of security.
- Final verification: `npm run verify:full` passed lint/format, build, types, 161 tests across 24 files, packed-artifact smoke checks, and 161 active-rule validation. `npm run port-rules -- --skills-dir ../agent-skills --check` passed: 79 checked, zero drift.
- Changes remain local and uncommitted. No PR or messages were posted.

## Evidence hardening follow-up

Updated assessment: **8.5/10**, an engineering judgment rather than a measured accuracy score. The concrete review defects are fixed, and semantic promotion now has an enforceable independent-evidence boundary. Broad semantic reliability is still unproven, so a 10/10 claim would exceed the evidence.

Implemented:

- Version 2 blind samples carry the complete rule rubric, examples, requested context and neighbours. Context-sensitive duplicates remain distinct. Version 1 imports remain compatible.
- Offline `eval coverage` reports class balance, document and repository coverage, and source/text leakage. Evaluation supports structured JSON and identifies undefined recall when no positives exist.
- Tuning selects on dev data and validates the fixed threshold on holdout. Missing, one-sided, overlapping, incomplete or insufficient holdout evidence keeps the rule review-only. Provider failures prevent writes.
- Focused evidence regressions run in the pre-commit hook; CI already runs the complete suite. No allowlist or warning downgrade was needed for the code invariant.

Verification: `npm run verify:full` passed with 166 tests across 25 files, build, types, format/lint, packed-artifact smoke checks and 161 active rules. Source-port verification checked 79 rules with zero drift. Temporarily forcing the promotion gate to accept everything made two regression tests fail; restoring it made all nine focused tests pass. The mutation was reverted.

Actual reference coverage: the 393-item Codex Blode-co corpus has both classes for 15 rules, with both classes in holdout for six, and no source/text overlap. The packaged non-weak corpus has 143 items, both classes for four rules, and six source files shared across splits. The new gate rejects affected promotion evidence rather than silently accepting it. These existing reference sets were not rewritten to manufacture a passing holdout.

A cache-only evaluation scored all 393 Codex examples with 218 cached answers, zero live requests and zero errors. Results remain in `results/blode-co-codex-evaluation.json`; coverage reports are adjacent. Aggregate agreement is diagnostic because sampling is stratified and references are AI-authored.

Remaining acceptance criterion for broad semantic readiness: collect fresh, independently split examples across repositories and document purposes, with meaningful positive and negative coverage for each rule intended for promotion. Keep AI provenance and test each fixed rule/threshold against untouched evidence. Existing examples that informed rule edits belong in development evidence. Do not expand blocking semantic rules merely to increase the active count.
