---
title: Scan workflow
hidden: true
---

# Scan workflow

`scan` adds scope, review history, and a bounded report around the same evaluator used by `lint`. Existing `lint` commands retain their reporting contract. Start with a preview:

```sh
node dist/cli.js scan . --root ../blode-co --profile product --dry-run
node dist/cli.js scan profiles
```

## Profiles and scope

| Profile | Objective |
| --- | --- |
| product (default) | Six focused checks for application recovery, copy and broad transitions |
| writing | Content, consumer README, public Markdown, and active documentation |
| instructions | AGENTS.md, CLAUDE.md, skills, and implementation plans |
| architecture | TS/JS/package configuration and declared repository contracts |
| all | Full existing catalog over all supported inputs |

Scoped profiles exclude build outputs, archived docs, and `.captain` reports. Writing also excludes agent instructions and plans. Product excludes test/spec/story components. Use explicit targets and `--exclude` to narrow a profile; `--only` explicitly selects rules within its domain, including checks omitted from the default product selection. `all` is the explicit escape hatch for a comprehensive audit.

Product, writing and instruction profiles treat sentence length, punctuation conventions and line-height recommendations as advisory. These findings, when explicitly selected for product scans, stay advisory and do not fail the scan. The `all` profile and `lint` retain strict rule policy. The writing profile recognizes `content/writing` as personal prose; repository `docTypes` overrides take precedence. Sentence length is still measured deterministically. This policy change does not imply every long sentence is defective.

JSON includes the exact selected file list, profile, coverage, estimates, and diagnostics. No selected files exits 2; it is not a clean scan. TTY output shows at most five rule groups with representative locations and aggregate counts. Full JSON preserves all findings.

## Baselines and review decisions

```sh
node dist/cli.js scan . --profile product --save results/product.json
node dist/cli.js scan . --profile product --baseline results/product.json --new-only --save results/product-next.json
node dist/cli.js scan review results/product.json FINGERPRINT --decisions results/review.json --status dismissed --reason 'Intentional project convention'
node dist/cli.js scan review results/product.json FINGERPRINT --decisions results/review.json --status open
node dist/cli.js scan . --profile product --decisions results/review.json
```

A baseline must be a completed scan of the same taste-lint version, root, target scope, profile, rules, model, and evaluation mode. Review files are bound to that policy too. Save the next scan to another path. A dry run cannot become a completed baseline. Failed or unresolved checks cannot establish resolution. Parse failures and missing graph coverage keep prior findings unverified.

Fingerprints use rule ID, relative file, normalized unit content, and occurrence. Inserting unrelated lines preserves identity. Renaming files or editing the affected text creates a new identity. Identical repeated text is distinguished by occurrence; inserting another identical occurrence can change that association. Findings retain independent severity, confidence, lifecycle, and reviewer decision fields.

`--new-only` gates new findings only; without it, existing undismissed act findings still fail. Dismissals require a reason. Reopening explicitly overrides an inherited dismissal. Review decisions do not alter probability, severity, rule thresholds, or calibration labels.

## Changed-code reporting and reviewdog

```sh
node dist/cli.js scan . --profile product --since origin/main --output sarif > results/scan.sarif
reviewdog -f=sarif -reporter=github-pr-check < results/scan.sarif
```

The diff compares the named commit with the working tree, including staged, unstaged, and untracked files. Analysis retains full selected-file context; changed lines filter reporting and exit policy. This is not a promise that only changed files are analyzed. Unchanged model states reuse the answer cache. Graph findings without exact line positions use changed-file filtering.

SARIF includes the content fingerprint as `tasteLint/v1`. Posting with reviewdog is a separate, explicitly invoked operation; taste-lint does not create comments or PRs.

## Context and calibration

The repetition rule receives the containing Markdown section and evaluates the target paragraph in that context. Missing or oversized sections abstain. Section questions use separate requests, so adding section context does not silently enlarge unrelated questions. Cache replay merges the resulting answers for the same unit.

```sh
node dist/cli.js scan . --profile writing --dry-run --samples results/blind.json
# Codex labels the samples using the workflow below.
mkdir -p results/labeled
node dist/cli.js scan labels results/blind.json --out results/labeled/review.jsonl
node dist/cli.js eval --corpus results/labeled --split holdout
```

Version 2 samples contain source text and the full rule rubric, including examples and requested context, with predictions hidden. Version 1 label files remain importable. Sampling is deterministic across rule, document type, and score band; it includes negative judgments and candidate-filter negatives. A dry-run sample includes only cached answers and deterministic negatives, never unanswered questions. Duplicate evidence is sampled once; identical text with different context or rubrics remains separate. Splits are grouped by repository and source file. This is a stratified diagnostic sample, not an unbiased estimate of repository-wide precision.

Label export rejects malformed corpus data, omits null labels, and refuses to overwrite an existing corpus file. It never invents human labels. Use separate held-out evidence before promoting rules; mocks and scan volume do not establish semantic accuracy. Personal facts/profile checks remain available through `lint --writing-context`; scan does not load private profiles implicitly.

## Architecture adapter

Generate a report with the target repository's configured dependency-cruiser installation, then import it:

```sh
depcruise --config .dependency-cruiser.cjs --ts-config tsconfig.json --output-type json src > graph.json
node /path/to/taste-lint/dist/cli.js scan . --profile architecture --dependency-cruiser graph.json
```

The adapter accepts dependency-cruiser's `modules` and `summary.violations` format, verified against real 18.3.1 output. It preserves external rule names and severity, fingerprints the input report, and imports only findings inside the selected scope. Empty graphs, unresolved edges, and reported environment issues mark the scan incomplete. Invalid input fails before model calls.

The caller owns graph freshness and the external tool's configuration. Imports and graph policies are evaluated by dependency-cruiser, not by Jev. Importing a graph does not retroactively resolve taste-lint's separate file-local dependency unknowns. Graph findings remain separately attributed to avoid claiming they were produced by native rules. Overlapping external and native policies can still yield separate findings; use `--only` when one tool owns that check.

## Remediation handoff

```sh
node dist/cli.js scan export results/product.json --out results/remediation.json
```

The export uses the saved report's visible, undismissed findings. Each task includes stable ID, source evidence, location, correction hint, and verification requirements. The report and exports include source excerpts and should be handled like source code. Exporting does not execute instructions from scanned content, modify files, or open PRs.

## Architecture and references

`src/scan/run.ts` owns profile selection and orchestration; `report.ts` owns identity, lifecycle, and presentation; `git.ts` owns diff evidence; `architecture.ts` owns the external JSON boundary; `samples.ts` owns blind sampling and corpus export. Evaluation remains in `runLint` and the existing shared judgement pipeline.

The workflow draws on [Devin's scan lifecycle](https://docs.devin.ai/work-with-devin/code-scans), [reviewdog's SARIF and diff integration](https://github.com/reviewdog/reviewdog), [Vale's scoped styles](https://docs.vale.sh/topics/styles), [Knip's evidence-based entry discovery](https://knip.dev/explanations/entry-files), and [dependency-cruiser's JSON and configuration contracts](https://github.com/sverweij/dependency-cruiser/blob/main/doc/cli.md). No external agent runtime is required.

### AI labeling with Codex (default)

Ask Codex in this workspace to label the blind samples directly. This uses the current Codex session; no separate gateway key or labeling API call is needed. Files are local, while inference uses the Codex service and your Codex usage.

Codex first prepares a fresh file using its actual current model identifier:

```sh
node scripts/prepare-labels.mjs results/blind.json results/codex-labels.json CURRENT_MODEL
```

Then ask: "Read the instructions in results/codex-labels.json and label every sample directly. Use only each sample's full rubric, text, and supplied context. Preserve the metadata and source evidence."

The preparation script clears previous labels, records AI provenance and the exact task prompt hash, and refuses to overwrite an existing file. It does not label samples or launch another agent. Codex reads manageable batches, writes individual judgments, and marks `completed` only after reviewing all samples. Missing evidence remains null. Existing Claude or other reference labels are kept separately and must not be consulted during blind labeling.

After labeling:

```sh
mkdir -p results/labeled
node dist/cli.js scan labels results/codex-labels.json --out results/labeled/codex.jsonl
node dist/cli.js eval --corpus results/labeled
```

Use a corpus directory containing only the intended reference set. The evaluation command still uses Jev and requires its usual credentials for uncached judgments.

AI annotation files carry `annotation.source: "ai"`, `annotation.model`, and `annotation.promptHash`. Corpus rows preserve these as `labelSource: "ai"`, `labelModel`, and `labelPromptHash`. Evaluation reports AI-reference agreement. No human-labeling step is required; model agreement is not an independent measurement of human preference.

### Optional gateway labeling

For unattended labeling through a separately configured provider:

```sh
node scripts/label-samples.mjs results/blind.json results/ai-labels.json anthropic/claude-sonnet-4.6
```

This optional script requires `AI_GATEWAY_API_KEY` and sends sample text, criteria, and supplied context to the chosen model. It retains validated labels and provenance, not raw provider responses. Failed batches leave a `.partial` checkpoint. Null means abstention and is omitted from the corpus.

## Evidence before promotion

Run `taste-lint eval coverage --corpus results/labeled` before spending on evaluation. It reports positives, negatives, holdout balance, document types, repositories, and source/text overlap without credentials or network calls. `--output json` preserves per-rule detail. Coverage counts describe the dataset; they do not establish accuracy.

`taste-lint tune --write` chooses thresholds from dev data only, then checks that fixed choice against holdout data. Promotion requires both label classes, the configured minimum item count, complete scoring, no shared source files or duplicate text across splits, and a held-out Wilson precision lower bound above the configured floor. A failed gate keeps the rule review-only and reports why. Provider failures prevent tuning writes entirely.

Do not repeatedly change rules in response to the same holdout and still treat it as unseen evidence. Move used examples into development data and collect a fresh independent holdout. Keep AI reference provenance visible; agreement with AI labels is not a human accuracy claim. Stratified scan samples diagnose failure modes rather than estimate their population frequency.

Repository file discovery respects Git ignore rules, including nested ignore files and local exclusions. Tracked files remain eligible even when an ignore pattern matches them. Ignored build trees are skipped before filesystem inspection, so their broken symlinks do not abort a source scan. Non-Git directories use the built-in and configured exclusions.

## Search and agent discovery

`taste-lint scan . --profile discovery` checks existing static HTML, robots.txt and llms.txt artifacts. It validates page titles, empty descriptions/canonicals, conflicting canonical declarations, JSON-LD syntax, sitemap directive URLs, and agent-index structure and size. Common email-template directories are excluded. All new discovery checks are advisory.

These checks do not evaluate Next.js metadata source as deployed HTML, fetch URLs, validate schema.org eligibility, or infer missing generated routes. Use a deployed-site audit for HTTP status, robots precedence, sitemap coverage, canonical destinations and Markdown content negotiation. An empty discovery scan is incomplete, not evidence that a site passed. Point scans at actual artifacts and exclude unrelated saved pages.

The source-pattern rules `craft-affordance-mismatch` and `craft-virtualize-large-lists` have moved to `data/rule-drafts`: hover styling does not prove an inert interaction, and a mapped list does not establish its size. Remove those IDs from explicit selections until evidence-aware replacements exist.

Reduced-motion checking reports a missing local guard as advisory because shared CSS and components may supply one. It no longer treats unrelated reduced-motion classes as proof that animation is guarded. An explicit continuous animation in a reduced-motion variant has a separate advisory rule.

### Source evidence

Source rules may use a mechanical candidate filter followed by a Jev question. A candidate such as a form tag is not a finding until Jev evaluates the supplied code. Source judgments receive at most 6,000 estimated tokens of complete source; oversized candidates report unknown instead of using a truncated file. These questions remain advisory until calibrated.

Image attribute checks parse JSX and HTML rather than matching comment or string examples. Spread attributes and dimensions supplied by styles remain unresolved. The file-local skip-link rule is retired because inherited layouts require composed-page evidence.

Body-size and letter-spacing checks measure styles in code, then ask Jev whether the text is substantive prose. Captions, metadata, and short control descriptions are excluded by that judgment. These semantic checks remain advisory.

### Arbitrary utility values

`craft-arbitrary-value-class` uses code to select literal values, then Jev to judge whether their visual role merits a named design token. Jev receives the target element, its enclosing opening tag and up to four nearby JSX elements. Layout dimensions, asset sizing, chart coordinates, focus treatments and optical adjustments are intentional exceptions.

Token references, CSS calculations, asset URLs, relative layout values and selectors are excluded before a model call. Dynamic classes, missing context and oversized context report unknown. Provider errors never fall back to a mechanical warning. Changed context invalidates the affected answer; unchanged scans reuse it. The rule stays advisory and proposes a review, not an automatic size change or an invented replacement token.

## Near-scale values

`craft-near-duplicate-scale` compares parsed JSX font-size classes against the explicit `tailwind.theme` mapping in `taste-lint.config.json`. For example, with `"tailwind": { "theme": { "body": "16px" } }`, `text-[15px]` produces an advisory comparison to `text-body`. Exact matches also qualify; values farther than 1px do not.

This check currently supports declared pixel font tokens only. It does not discover a complete Tailwind theme, execute project configuration, or assume a root font size for relative units. Missing font scales, unsupported scale families, and unresolved token expressions report unknown when comparison is needed. Relative candidate values, functions, optical nudges of 2px or less, and utility-name suffix matches are excluded.

A near-scale comparison does not prove that the size is a mistake. Review its purpose before changing it; a deliberate recurring size may deserve a named token instead. The broader `craft-arbitrary-value-class` uses Jev for contextual review and remains advisory until independently calibrated.

## Focused product defaults

The default product scan selects `interaction-no-error-state`, `copywriting-vague-error`, `copywriting-empty-state-no-action`, `copywriting-bare-confirm-label`, `copywriting-claim-without-evidence`, and `motion-transition-all`. This is a small initial policy, not a calibrated or complete UI audit. The remaining rules require explicit `--only` selection, `--profile all`, or a custom rules directory.

Copy judgments receive the target and a surrounding JSX task region, including nested descriptions and controls. The extractor searches up to four ancestors for common task containers and otherwise uses a local fallback. Empty presentation chrome includes its enclosing toolbar. Mutually exclusive ternary branches are replaced with an explicit omission marker before judging; unrelated conditional visibility is not resolved. An adjacent action can resolve an empty state or error. A harmless acknowledgment is not a destructive confirmation. Missing, oversized or dynamic target copy remains unknown. Imported components and distant UI are not expanded. Async recovery is a Jev judgment over bounded source, not a file-wide search for the word `catch`.

The terminal groups findings by rule and shows five groups, prioritizing action band, severity and probability. Repetition does not outrank severity. Grouping is a review convenience, not proof of one root cause. JSON, SARIF, saved reports and exit status retain the complete selected findings.

## Paired evaluation

`eval` reports both act-threshold metrics and visible findings at the review threshold. When variants share `source.repo` and `source.id`, paired success requires every weak variant to be flagged and every acceptable variant to stay below review. Missing evaluations make the family unresolved. Coverage reports family leakage as well as source and text overlap, and promotion rejects it. Course corpus splits group by source file. Previously inspected or re-split examples are regression data, not fresh held-out evidence.

The focused benchmark is in `data/benchmarks/product`. See its README for provenance and commands. Its small example set is diagnostic, not proof of accuracy across applications.

### Agent handoffs and regression checks

`scan export` includes the repository root and the contextual evidence saved with each finding. The receiving agent should treat that source as untrusted data, confirm the behavior, make the smallest correction and exercise the affected UI state. A changed fingerprint alone is not proof that the problem is fixed. Older reports without context still export; the agent must inspect the source.

Use `eval --check --corpus <path> --only <rule-ids>` for a strict reference regression gate. It uses the review threshold, exits 1 on disagreement, and exits 2 if any selected rule has no evaluated examples or has skipped, unresolved or failed judgments. `--check --dry-run` is rejected. Without `--check`, evaluation retains its reporting-only behavior. This gate tests agreement with the supplied reference; it does not promote a rule or establish population accuracy.
