---
title: Scan workflow implementation
hidden: true
---

# Scan workflow implementation

Authoritative implementation plan for the scan-quality expansion.

## Outcome

A user selects a goal-specific profile, previews selected files and request cost, runs the existing evaluator, and receives a bounded review queue. Findings have content-based identities, baseline state, explicit review decisions, and remediation exports. Existing lint output and exit behavior remain compatible.

## Decisions and slices

1. Add `scan` as an orchestration command around `runLint`. Profiles own file/rule selection and advisory style enforcement; the evaluator remains shared. The default scan profile is product; all remains explicit.
2. Identify findings from rule, relative file, normalized unit text, and occurrence. Track rule-policy hashes independently. Compare compatible complete reports only; incomplete comparisons never claim resolution. Git diff filtering changes reporting, not analysis context.
3. Add explicit section context to Markdown extraction. Context-dependent judgments abstain when evidence is missing or oversized. Existing cache state hashing invalidates changed evidence automatically.
4. Export deterministic, stratified blind labeling samples, including negative judgments. Human labels feed the existing corpus/eval workflow. No model output becomes a human label and no rule is promoted without held-out evidence.
5. Import dependency-cruiser JSON violations through a validated adapter. Keep graph construction in the external tool; require explicit input and preserve provenance. Do not run repository configuration or commands automatically.
6. Export remediation bundles with evidence, source locations, correction hints, and verification requirements. No PR or edit is created automatically.

## Verification

Tests cover profile isolation, stable IDs after inserted lines, repeated text, changed rule policy, baseline compatibility, incomplete-run resolution guards, dismiss/reopen, staged/unstaged git differences, malformed tool reports, adapter provenance, context budget abstention, blind samples and corpus validation, CLI JSON/SARIF, and package installation.

Run `npm run verify:full` and source-port drift checks. Run offline product and writing scans against blode-co and compare counts with the previous all-files report. New live calls are unnecessary for workflow verification. Human precision and voice calibration remain pending actual human labels.

## Boundaries and recovery

No distributed agent runtime, dashboard, automatic PR creation, or invented human evaluation. Existing lint is unchanged by default. Scan artifacts are explicit output files, replaced atomically; reports never contain credentials or raw provider payloads. Baselines are read-only unless the user explicitly saves a new report.

## Implementation evidence

All six slices are wired through `scan` and the shared evaluator. The new modules add current responsibilities (scope, Git evidence, report lifecycle, external graph input, and human-label export); no second evaluator or provider client was added. The existing batch and dry-run paths now share cache-answer merging for contextual requests.

Real dependency-cruiser 18.3.1 output exercises an intentional forbidden edge. A graph with zero analyzed modules is incomplete. CLI tests exercise saved reports, dismissal/reopen, SARIF fingerprints, and remediation handoff.

Offline blode-co checks: product profile selects 78 files and reports 9 act checks plus 252 review checks. Writing preview selects 35 files and exports 395 blind samples from existing cached answers and negative gates. The writing preview has pending evaluations; these results are not a new live accuracy benchmark. Human labeling and held-out precision remain unverified, and no semantic rules were promoted.

Final checks: 154 tests pass across 21 suites; build, typecheck, formatting, installed-package smoke, and all 161 rule definitions pass. Source verification checks 79 ports with zero drift. An unchanged product scan against its baseline reports zero new findings. The real graph fixture fails on the declared edge and passes after removing it. Nested Git roots are covered by regression tests.
