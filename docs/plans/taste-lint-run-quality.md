---
title: Make taste-lint runs trustworthy and usable
hidden: true
---

# Make taste-lint runs trustworthy and usable

Authoritative implementation plan. Based on checkout `72392b1`, the September 20, 2026 blode-co audit, and local Node 24 probes. Implementation executed in this checkout. The execution record below supersedes the planning-time verification limits.

## Outcome

A developer can point taste-lint at a repository, understand what will be checked and charged, follow a long run, recover from an interruption, and distinguish blocking findings from uncertain suggestions. An invalid target must never look like a clean scan. Reports, exit codes, and evaluation must agree about what happened.

Architecture mode: **Deepen**, with enforcement planned inside each delivery slice. Start from the information the tool must preserve, rather than reorganizing directories or adding features independently.

## Evidence and limits

- The original run inspected 6,474 non-structural units against 118 rules. The final report contains 537 act findings, 9,353 review findings, and zero unknowns. These are counts after category merging, not independent rule verdict counts.
- 492 of the act findings were under `docs/`. Agent directories contributed 2,123 review findings. Scanning the whole repository was authorized; this is evidence that scope needs visibility, not that documentation should be silently excluded.
- `copywriting-generic-framing` accounts for 3,521 displayed review findings and `copywriting-unnatural-polish` for 3,491: together 75% of displayed review notes. This establishes concentration, not a measured false-positive rate.
- Dry run estimated 5,123 requests and $0.6891675. Initial execution recorded 5,121 successful requests and two terminal provider errors. The final rerun used one successful request plus 66,473 cached **answers**, costing $0.000128604; total reported cost was $0.657275304. Why two failed requests required only one new request is not established by these totals. Do not describe answer counts as request counts.
- `src/map/jev.ts` already retries transport errors, 429 and 5xx, with a timeout and bounded Retry-After handling. Do not add a second retry loop in batch orchestration.
- Local probes reproduce: a missing target exits 0 with zero units; `--fail-on major` can exit 0 while the human report says FAIL; `--output=json` validation errors and Commander parse errors do not follow the JSON error contract; malformed config field types can be accepted.
- Hot spots in the last 15 commits include `src/lint.ts` (6 appearances), `src/map/plan.ts` (5), `src/types.ts` (5), and rule validation/loading. The proposal deepens this existing pipeline rather than creating another one.
- Evidence artifacts: `results/blode-co-audit.json`, `results/blode-co-audit-final.json`, and `results/blode-co-audit.md`. They are ignored local artifacts; the baseline above is preserved here for another checkout. Re-running against changed blode-co content is not an exact baseline comparison.

## First principles and ownership

Taste-lint has three different decisions: whether a rule applies, what evidence it produces, and what policy does with that evidence. Presentation is a fourth concern. Keeping these separate prevents a shorter report from changing the lint verdict, or a skipped rule from becoming a negative training label.

Keep the existing single package and `runLint` entry point. No services, database, plugin framework, dependency injection container, or new workspace packages are needed.

| Responsibility | Existing owner to deepen | Contract and enforcement |
| --- | --- | --- |
| Resolve input | `lib/config.ts`, `lib/glob.ts` | Validate config and explicit targets before extraction or remote work. CLI subprocess tests prove invalid inputs cannot produce a clean result. |
| Extract evidence | `extract/` | Own source positions, document context, resolved values, and safe fix ranges. Existing parser/fix tests remain authoritative. |
| Decide applicability and prepare work | `map/plan.ts`, `map/judge.ts`, `map/batch.ts` | One prepared judgement supplies both preview and execution. Preserve applicable, skipped, unknown, negative, and pending distinctions. Judge tests prove conservation of eligible rule-unit pairs. |
| Execute remote work | `map/batch.ts`, `map/cache.ts`, `map/jev.ts` | Batch owns scheduling and result fan-out; cache owns reuse; the provider adapter alone owns HTTP retry and wire validation. Fake-provider tests prove bounded work and recovery. |
| Apply policy | `reduce/bands.ts`, `lint.ts` | Rule evidence becomes bands, suppressions, and one failure decision. Policy uses severity and configured fail threshold; no renderer recomputes it. |
| Present results | `report/` and command adapters | Group and truncate only a view. Full evidence remains available, totals name what they count, and JSON remains parseable. Renderer and CLI tests compare the same result. |

Use the existing glossary in `docs/DESIGN.md`: **unit**, **unknown**, **band**, and **severity** retain their meanings. Add only the distinctions currently missing: **skipped** means inapplicable; **negative** means evaluated without a violation; **request** is a logical provider evaluation; **attempt** is an HTTP try; **cached answer** is a reused rule answer. Do not count skipped work as a passing check or unknown.

### Ranked architectural opportunities

1. **Loss of evidence before reporting.** `reduce/dedupe.ts` merges different rules in the same category into one head plus `also` IDs. `lint.ts` then builds the scorecard from that merged list. Secondary rule probabilities, hints, and counts are no longer available to consumers. Keep exact duplicate removal separate from display grouping. This gives report and scorecard changes one owner and prevents UI compression from altering evidence. High leverage; in-process tests through `runLint` and renderers.
2. **One decision duplicated across callers.** `lint.ts` computes the failure threshold, while `report/tty.ts` independently fails on any act finding. Introduce one result summary consumed by CLI exit, JSON, and text. This is the first migrated slice because it is small and has a demonstrated end-to-end contradiction. High leverage; no external dependency.
3. **Preparation and execution are coupled.** `runLint` invokes `judge` for preview and invokes it again for live execution. `judge` is already the shared lint/eval seam, so deepen it in place with an immutable prepared judgement and an execution operation. Keep `judge` as the compatibility facade for `eval/metrics.ts`; do not export the new internals from `index.ts`. High leverage; fake Evaluate already exists as a real testing seam.
4. **Missing applicability outcomes.** `map/plan.ts` drops inapplicable checks; `eval/metrics.ts` reconstructs missing probabilities and can treat an unscheduled labeled check as zero. `reduce/scorecard.ts` assigns all units to every category denominator. Carry compact per-rule coverage and skipped reasons through the shared judgement so eval and lint do not reconstruct intent. Medium leverage; necessary before claiming precision or coverage improvements.
5. **Execution progress leaks presentation.** The shared stage emits `.`, `x`, and `c` characters and lint/eval write them to stderr. Replace marks with typed counters/events; command adapters choose how often and where to render. Medium leverage; the existing lint and eval callers justify the seam.

Deletion budget: remove the second planning pass, duplicate failure calculation, character-based progress protocol, category merging from the evidence path, and the duplicate `defaultResultsDir` implementation in `lint.ts`. Preserve its current export as a re-export if needed. Do not add a parallel report or execution framework. Any new helper must replace responsibility in an existing owner; no public exports are needed except an additive summary type if consumers require it.

## Targeted DX findings

Scope: targeted; surfaces: lint command, reached configuration/error paths, reports and recovery; prefixes: `cli-`, `err-`, `config-`; excludes: unrelated commands, package export redesign, install audit, UI.

1. **[CRITICAL] `err-fail-fast-validation`**: `lib/glob.ts` catches stat failures and silently returns; `lib/config.ts` validates only the outer object. Missing targets can pass, and invalid exclusion types can be spread as characters. Resolve and validate at the input boundary.
2. **[CRITICAL] `err-stable-error-codes`**: `cli.ts` collapses expected validation failures to `UNEXPECTED`; its raw argument check misses `--output=json`, while Commander errors bypass the catch path. Use one structured error contract for command parse, config, and input errors.
3. **[HIGH] `cli-exit-codes`**: `report/tty.ts` prints FAIL for all act findings even when `lint.ts` correctly returns success under `--fail-on major`. Consume one policy result everywhere.
4. **[HIGH] `cli-responsive-and-progress`**: batch progress gives no completed/total count or retry state. Thousands of marks cannot answer whether a run is progressing. Render counters from structured execution events.
5. **[HIGH] `cli-pipes-tty-and-json`**: progress marks are emitted even without a terminal, and the error variants above break the promised JSON stream. Keep stdout data-only; make non-TTY progress bounded and opt-in.

Config schema discoverability (`config-validate-and-discover`, MEDIUM) is included with input validation, not another independent workstream. Successful JSON output is currently parseable and ANSI-free in the piped probe; retain that behavior.

## Delivery slices

### 1. Make one run tell one truth

Extend `LintResult` with an additive summary containing unsuppressed act/review/unknown totals, `failing` count, and effective `failOn`. Derive the exit code once in the pipeline: preserve 0 for success, 1 for threshold failures, and 2 for incomplete execution. Preserve existing usage-error exit behavior for this slice; stable error codes distinguish those failures.

Update `report/tty.ts` and `report/json.ts` to consume this summary. PASS under `--fail-on major` may still show minor act findings, but must say they are below the configured failure threshold. Incomplete execution must never appear as PASS. The summary describes the current grouped finding contract until slice 3 adds full evidence.

Fix test environment isolation in `__tests__/setup.ts` or the affected fixture: explicitly clear and restore both provider key variables; provider-specific tests stub their own environment. Keep the existing network-blocking fetch.

Acceptance: a subprocess fixture with only minor act findings prints PASS and exits 0 at `major`, prints FAIL and exits 1 at `minor`; incomplete fake-provider runs exit 2; JSON and text counts agree. The focused suites pass both with absent keys and with dummy inherited keys. No live network calls.

### 2. Make scan scope explicit and invalid input impossible to mistake for success

Validate user configuration in `lib/config.ts`: supported keys, arrays of strings, document-type entries, component collections, boolean fields, and theme value shapes. Keep user configuration distinct from the resolved `Config` containing internal `root`. Supply a JSON schema with parity tests against runtime validation, following the existing rule-schema pattern without adding a schema dependency.

In `lib/glob.ts`, reject nonexistent or unreadable explicit targets with the offending path. Distinguish existing empty directories, unsupported explicit files, and all-excluded scans; existing empty scope may succeed only with a conspicuous zero-scope diagnostic, never an unqualified clean-bill-of-health message. Preserve exclusions and existing path semantics; do not silently exclude docs, archives, or agent files.

Unify expected errors under stable codes such as `INVALID_CONFIG`, `TARGET_NOT_FOUND`, and `INVALID_ARGUMENT`, with structured field/path details. Configure Commander error handling so both `--output json` and `--output=json` produce one envelope on stdout, including unknown-option errors. Keep credential values and provider bodies out of messages.

Add scan coverage to dry-run and final manifest: files, units, counts by document type, and excluded/empty scope diagnostics. The default remains the paths requested by the caller. Show users how to choose `apps/web` or exclude archives with existing flags before inventing presets.

Acceptance: malformed nested config, missing target, invalid enum, and unknown flag fail before provider invocation; JSON errors parse in both flag forms; a temporary mixed docs/app/agent fixture reports its scope accurately. Validate config before capture/network work as well as filesystem scans.

### 3. Preserve evidence and make large reports readable

Split exact deduplication from category grouping in `reduce/dedupe.ts`. Retain complete rule findings before presentation grouping. For compatibility, keep the current JSON v1 `findings` and `scorecard` meanings; add an explicit full `ruleFindings` collection and coverage/count fields. Do not silently redefine v1 totals. Add a versioned v2 contract only if a later release removes the compatibility fields.

Text output starts with summary, scope, and top rules, followed by at most 20 act examples and 10 review examples, sorted deterministically. Always print exact omitted counts and the complete saved report path. `--verbose` exposes the full list. Keep JSON/SARIF complete; review-only findings remain distinguishable from blockers. An example limit must not change exit status or the stored result.

Move grouping to presentation and calculate raw per-rule counts from unmerged evidence. Preserve separate labels for displayed findings and rule findings. Do not deduplicate different source locations just because their text matches.

Acceptance: synthetic input with 10,000 findings yields a bounded default text report; verbose and structured artifacts retain all findings. Two same-category rules on one unit preserve both probabilities and hints. Suppression never hides an unsuppressed rule. A renderer-only change has zero verdict delta.

### 4. Prepare once, execute predictably, recover from cached work

Deepen `map/judge.ts` with prepare and execute operations backed by the existing `planRequests`, `prepareRequests`, and `runRequests`. Dry-run estimates and live scheduling consume the same prepared work. Keep `judge` usable by eval and preserve `jobFilter`. Use in-memory plans first; no serialized job scheduler.

Carry applicability and evaluated outcomes through this seam. Count eligible unique units per category and eligible rule-unit pairs separately. Eval must skip inapplicable labeled checks with a recorded reason rather than scoring them as negative. Mechanical negatives are represented in coverage without serializing a giant negative-finding array.

Replace character progress with completed/planned logical requests, cached answers, failed requests, attempts, elapsed time, and phase. TTY updates are throttled; non-TTY defaults to final diagnostics, with an explicit progress option for periodic plain lines. Make timeout/retry settings observable before exposing more tuning knobs.

Keep HTTP retries in `map/jev.ts`. Batch/cache own reuse: coalesce identical prepared work within a run and fan answers back to every source unit. Recheck the cache immediately before dispatch where needed; use atomic cache-file replacement. Reuse only identical effective question, state, and model semantics, never text alone. A changed state/question/model must miss the cache. Do not change the cache key just to fit a new class hierarchy.

A terminal error produces an incomplete artifact, error categories/counts, and an exact rerun command with the same root, targets, rules, model, and results directory. A rerun reuses completed answers. Expose attempts separately from successful logical requests; reported token cost is known usage, not a billing guarantee for failed attempts. Resolve credentials only if pending live work exists so a fully cached run can finish offline.

Acceptance: fake provider fails transiently then succeeds without an incomplete result; exhausted retry budget yields unknowns and exit 2; auth failures stop queued work; duplicate units share remote work but retain distinct findings; rerun sends only unresolved work; all-cached run needs no key; preview and dispatch totals agree for identical cache state. Preserve lint/eval agreement for applicable, skipped, negative, and unknown outcomes. Benchmark 5,123 synthetic requests with a fake clock; no live stress test.

### 5. Improve rule relevance using evidence, not lower finding counts

Use the new full evidence/coverage to evaluate the two dominant review rules first. Sample 40 units per rule, stratified across probability ranges and document types, including below-threshold examples. Label against each rule's stated defect, independent of the current model answer. Split by source document into dev and holdout so near-identical prose cannot leak across splits. Expand the sample if confidence intervals cannot support a decision; 40 is an initial diagnostic sample, not permission to promote a rule.

Inspect `lib/config.ts` defaults: all `content/**/*.mdx` is currently labeled `lesson`, including personal blog posts. Use explicit existing `docTypes` overrides during evaluation; add a new prose type only if labels demonstrate that existing types cannot express the needed distinction. Move explicit domain exclusions, such as a rule that says it ignores reference docs, into validated preconditions where appropriate. Keep contextual judgments in questions when a deterministic gate cannot decide them.

Compare review precision, recall, abstentions, and request volume by document type. Investigate long-sentence findings on abbreviations, lists, quotations, and code-heavy prose through `rules/code/typography.ts` before making 25 words a weaker threshold. Mechanical detection certainty is not evidence that every instance is a writing defect.

Use the existing `eval`/`tune` workflow for act promotion; it currently tunes act thresholds, not the review threshold. Review-threshold changes need an explicit held-out evaluation in the accompanying change. Keep Jev rules review-only until the existing promotion criterion is satisfied. Do not claim a precision improvement from fewer reported notes or author new labels from model predictions alone.

Acceptance: publish per-rule dev/holdout counts, precision/recall with intervals, and representative errors; deterministic applicability tests prove skipped document types create no request; held-out positive examples remain detectable. If evidence is insufficient, retain review-only status and record the limitation instead of shipping an arbitrary threshold increase.

## Migration, enforcement, and verification

Order: slice 1 establishes the result contract; slice 2 validates inputs; slice 3 preserves evidence; slice 4 reuses that contract through execution/eval; slice 5 measures relevance. Each slice is independently reviewable and includes its tests, docs changes, and changeset. No task tickets or additional agents are required by this plan.

Use current CI's `npm run verify:full` gate and local Node 24. Add behavioral checks to the existing Vitest suites or a small subprocess suite, not architecture tooling. Target failure modes: report/exit disagreement, silently accepted invalid scope, and lost evidence across grouping/execution. Prove each new check fails on the pre-fix behavior and passes after the fix. Keep pre-commit scoped formatting; run the relevant focused contract suite locally before committing, and the same suite through `verify:full` in CI.

Commands for implementation validation:

```sh
env -u TYPESAFE_API_KEY -u AI_GATEWAY_API_KEY npm run verify:full
npm run port-rules -- --skills-dir ../agent-skills --check
node dist/cli.js lint --root ../blode-co . --dry-run --output json
```

For a comparable blode-co rerun, use the same results directory as the baseline. Run a cached comparison before any fresh paid calls. Report scope, model/rule changes, raw versus grouped counts, and actual new request counts. A changed rule or state legitimately invalidates corresponding answers.

Rollback: revert one slice at a time. Preserve JSON v1 fields and existing cache identity through additive changes. If cache serialization must change, use a separate versioned namespace and leave old entries intact. Never delete the shared cache to prove a migration. No remote state migration or content rewrite is part of this work.

## Verified now versus still unproven

- Local build passes on Node 24.15.0.
- Rebuilt local CLI reproduces missing-target success, threshold/report mismatch, and both JSON error variants. Piped success JSON parses and contains no ANSI escapes.
- Focused lint/reduce/provider suites: 13 tests pass with both key variables removed. With the inherited environment, 12 pass and the missing-key test fails. Tests block live fetch; no provider call was needed for planning.
- Source inspection confirms existing retries, two judge invocations, lossy category grouping before scorecards, and missing applicability outcomes. These are not speculative folder-level concerns.
- New architecture contracts, CLI behavior, precision improvements, performance gains, and deliberate check-failure demonstrations remain unproven until implementation. No enforcement is described as installed.
- User decisions outstanding: none needed to start slices 1-4. Rule labels and held-out evaluation are required evidence for slice 5, not assumptions about the desired finding count.

## Deferred

- A repository-wide rename/refoldering, package split, and public SDK cleanup: no evidence that they solve this run's problems.
- More rules, model replacement, provider migration, or global threshold increases: first measure the current dominant rules.
- Hiding archives or agent instructions by default: explicit whole-repository scope was valid; improve visibility and configuration first.
- A job database, background daemon, or new resume command: the current answer cache already enabled recovery. Add only if interruption tests establish a gap it cannot cover.
- Full package/type-resolution audit: outside the targeted command/config review.
- Automatically fixing blode-co: the requested outcome is a taste-lint improvement plan.

## Execution record (2026-09-20)

- Implemented slices 1-4 in the existing single-package pipeline. Added one internal input-error module, three contract test files, the user-config schema and the additive result/progress types. No new dependencies, packages, services or SDK replacement. Removed the second planning pass, character progress protocol, duplicate results-directory implementation and renderer-owned failure decision. Preserved existing exported entry points.
- Grounded the contracts in official TypeSafe docs: `docs/TYPESAFE.md` links the introduction, Noul, system design, confidence and HTTP reference, with tests for 529 backoff and per-attempt telemetry. Gateway behavior remains separately tested, not inferred from TypeSafe's direct API documentation.
- Slice 5 produced 80 provisional blind agent labels and a document-split evaluation in `docs/evaluations/blode-co-review.md`. No threshold or prompt was tuned. The limited positive sample cannot establish recall; both rules remain review-only. The explicit reference/UI exclusion in the unnatural-polish question is now a deterministic precondition.
- The three original regression probes failed before implementation. Final focused coverage also tests grouping tie breaks, hidden major findings, cache-only credential-free execution, skipped evaluation labels, schema parity, JSON parse errors, and a 5,123-request fake-clock workload bounded to eight workers.
- Controlled replay: an untouched build of `72392b1` and the new build inspected the same current blode-co checkout using the same answer cache. Grouped findings and the entire legacy scorecard are identical: 6,474 units, 537 act findings, 9,353 review findings. The new result additionally retains 17,091 unsuppressed rule findings, of which 558 meet the minor failure threshold. The replay makes zero requests, costs $0, and finishes without credentials. Source provenance through directory symlink aliases is preserved; only ancestry cycles are stopped.
- `npm run port-rules -- --skills-dir ../agent-skills --check`: 70 shipped source-linked rules checked, zero drift. Changeset: `.changeset/calm-rules-report.md`.
- Known limitations are explicit: the sampled quality labels are not human gold labels; long-sentence abbreviations and inline-code counting still need a dedicated policy/segmentation change; token cost is known reported usage, not guaranteed billing for failed attempts. No precision, recall or paid-runtime speed improvement is claimed from these changes.

Final verification: `npm run verify:full` passes on Node 24.15.0 with dummy inherited provider keys: formatting, lint, build, typecheck, 91 tests across 17 files, packed-artifact smoke test, and all 118 active rules. `git diff --check` passes. No credentials were written to source, reports, corpus or documentation. Changes remain local and uncommitted.
