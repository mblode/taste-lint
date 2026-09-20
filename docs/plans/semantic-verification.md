---
title: Semantic verification plan
hidden: true
---

# Make the default scan worth acting on

Authoritative plan: `docs/plans/semantic-verification.md`. Reviewed against `eff70b2`, taste-lint 0.0.6, on 2026-09-20. Replaces the imported-button-first plan.

## Outcome

Improve existing findings before adding capabilities. A useful finding identifies a supported problem and a concrete correction. Valid syntax or a stylistic preference alone does not establish a defect.

Keep `init`, `scan`, BYO Vercel AI Gateway key, Jev for semantic decisions, and code for parsing and measurement. Keep the test projects unchanged. No new command, model primitive, dependency, report version, or general framework.

“10x” is the ambition, not a measured result. Demonstrate fewer unsupported findings while retaining known defects. A smaller report alone does not meet that goal.

## Review findings

| Verified evidence | Decision |
| --- | --- |
| The latest saved Blode product scan has 199 findings: 128 arbitrary-value and 30 near-duplicate-scale findings, across 77 files. | These rules produce 79% of the report. Measure their usefulness first; volume does not establish false positives. |
| `craft-near-duplicate-scale.yaml` matches arbitrary pixels without comparing a theme. Its source skill requires a defined step within 1px. | Fix this proven detection gap in code. A better prompt cannot replace the missing comparison. |
| The report treats `max-w-[900px]` as near-scale evidence; the regex extracts its `w-[900px]` suffix. | Match parsed classes and the actual utility family. |
| `classes.ts` reports every arbitrary value mechanically. | This is currently a strict style preference. Test a useful semantic contract before converting it to Jev. |
| The latest scan has no missing-disable findings. Blode's buttons use `@/` imports. | Defer the previous feature: its payoff is unproven and its relative-only resolver misses the motivating project. |

Historical report: `/tmp/blode-co-taste-improved-final.json`. Reproduce a baseline if unavailable or the source changed; do not reuse historical counts as a fresh benchmark.

## 1. Establish the comparison

Capture complete 0.0.6 scans of unchanged snapshots of `../blode-co`, `../donebear`, and `../iconsmith-internal`. Record revision plus dirty-file hashes, selected files, model, rule policy, cold requests/cost/time, and warm-cache behavior. Use temporary snapshots where necessary; never reset the original projects.

Build about 60 distinct diagnostic cases across the projects: reported candidates, unreported candidates, known defects, intentional exceptions, and unresolved evidence. Focus on the two target rules. Reuse the sample format and Codex labeling workflow in `docs/SCANS.md`. Label locally in the Codex session with AI provenance; no human-labeling dependency.

- Freeze the intended rubric first: a supported design-system problem, not merely brackets. Compare old and proposed behavior against the same rubric. Old syntax-only labels do not establish usefulness.
- `makeSamples` currently exports semantic rules only. Use a small development-only adapter into the existing format for the mechanical baseline and candidate negatives; do not create another evaluation product.
- Separate development and fresh holdout cases by source file; remove duplicates. Hide predictions and prior labels during annotation. Previously inspected examples are development cases. Keep null judgments visible.

## 2. Fix the scale-check defect

Replace the YAML implementation with a code rule, preserving `craft-near-duplicate-scale`, source attribution, and advisory status. Remove the duplicate YAML registration. Extend `src/rules/code/classes.ts` and existing Tailwind analysis.

A candidate must be a parsed arbitrary pixel class, in a supported family, within 1px of an established theme step. Exact matches qualify. Exclude optical nudges of 2px or less, relative units, functions, comments, and strings that are not classes. Preserve variants and full utility names. Evidence names the matching token and measured difference.

Theme resolution is a real limit: `src/extract/tailwind.ts` handles typography defaults and explicit `config.tailwind.theme` overrides, not a complete project theme. Start with a supported family and provable scale values. Add static theme reading only for an actual regression case. Never execute project configuration or assume an unverified default scale. Unsupported families, expressions, and overrides yield specific unknowns when comparison is required.

Follow `../agent-skills/skills/ui-design/rules/slop-near-duplicate-scale.md`, including asset constraints and intentional recurring values. Recurrence can justify registering a token rather than changing a size. Do not recommend a replacement when the required context is missing.

This slice can ship independently. Replacing an unsupported claim with unknown corrects coverage reporting; it does not prove improved semantic accuracy.

## 3. Prove one useful Jev decision

For `craft-arbitrary-value-class`, test: does the supplied context establish an unnecessary one-off value where an identified existing token serves the same purpose? Code supplies candidates and token facts; Jev judges usage and exceptions. Jev must not calculate distances, infer an unseen theme, or generate replacements.

Use the existing `codeRule({ check, question })` contract. First prove the question on positive/negative development pairs: unnecessary one-off value versus deliberate layout, readable measure, asset constraint, or accessibility treatment.

Only then wire the bounded evidence into the existing pipeline:

- `buildState` does not currently send class lists or theme facts. Add the minimum needed context through `Unit`, state, samples, and corpus replay. Missing or oversized required context yields unknown before the call. Budget the final assembled state within existing caps.
- Batch questions sharing evidence. Isolate enriched jobs using the existing section-job precedent so unrelated judgments retain their context and cache behavior.
- Changed evidence invalidates the affected answer; unchanged evidence reuses it. Verify baseline compatibility when evidence preparation changes, not only when the question changes.
- Keep the rule advisory, severity separate from probability, and bounded source references in existing finding fields.

If this experiment cannot distinguish defects from intentional cases, finish with the verified scale correction. Do not ship a vague taste classifier, hide the rule, or raise thresholds to manufacture a smaller report. Any default-policy change needs a separate comparison from detector accuracy.

## Acceptance

| Scenario | Required result |
| --- | --- |
| Known scale: exact match, 1px difference, larger difference | First two qualify; last does not. Evidence identifies the actual token. |
| Missing theme or unsupported override/family | Specific unknown; no fabricated comparison. |
| `max-w-[900px]`, `max-w-[65ch]`, functions, comments, optical nudges | No finding based only on brackets or a matching suffix. |
| Intentional usage versus known unnecessary near-token usage | Live Jev judgments distinguish held-out pairs; mocks alone cannot prove this. |
| Changed context versus unchanged rerun | Affected judgment recomputes; unchanged warm run makes no new calls. |
| Overflow, invalid response, provider failure | Unknown/incomplete behavior survives CLI, report, samples, and evaluation. |

Extend `classes.test.ts`, `tailwind.test.ts`, `execution.test.ts`, and relevant scan/evaluation tests. Add a packed-consumer regression in `scripts/test-package.mjs`. Any added reads must obey root confinement and existing ignore/exclusion policy; `Repository.read` alone does not enforce ignores.

Compare the packaged CLI against the baseline on identical project snapshots. Record true/false positives, missed positives, unknowns, and coverage separately for the two rules, plus whole-scan requests, cost, and elapsed time. The semantic slice passes only with fewer unsupported findings and no new misses among held-out positive cases. Too few positives or negatives means insufficient evidence. Report AI-reference agreement, not human accuracy or population precision.

Run on Node 24:

```bash
npm run verify:full
npm run port-rules -- --skills-dir ../agent-skills --check
npx changeset status
```

Record comparisons and verification in `docs/plans/semantic-verification.notes.md`, under `Deviations` and `How the run ended`. Add a patch changeset and document supported theme limits. No promotion to active without the existing independent calibration gate.

## Boundaries and recovery

Defer component-import resolution, new rules, browser probes, automated fixes, dashboards, Choice support, and scoring systems. Existing scan grouping, remediation export, and evaluation tools are sufficient. Keep onboarding unchanged.

If imported-component evidence becomes the next measured bottleneck, revisit actual `@/` aliases, binding/export resolution, ignore-aware reads, bounded state, and isolated caching. The relative-only proposal is no longer an implementation commitment.

No report migration is planned. Changed policy must reject incompatible baselines rather than describe removed warnings as fixed source defects. Cache entries can coexist. Reverting restores previous behavior without editing source projects.

Finish after the scale correction and, only if validated, the narrow Jev improvement. Stop expansion if success requires executing project configuration, interpreting arbitrary CSS, or constructing a repository graph. Record the unsupported case. Publishing is separate when requested.

## TypeSafe grounding

Read the installed TypeSafe skill before implementation. The reviewed [state guidance](https://docs.typesafe.ai/concepts/state) calls for relevant evidence; [Noul guidance](https://docs.typesafe.ai/primitives/noul) defines focused yes/no probabilities; the [building guide](https://docs.typesafe.ai/concepts/how-to-build-with-system-one) recommends batching independent judgments and composing them in code. Retain the existing Gateway transport. Typed output and high probability do not prove that a rule is useful.
