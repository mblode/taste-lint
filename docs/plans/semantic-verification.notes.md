---
title: Semantic verification notes
hidden: true
---

# Semantic verification implementation notes

## Deviations

- The existing resolver does not load project Tailwind themes. The implementation supports explicit pixel font tokens from `tailwind.theme`; other scale families and unresolved values abstain. It adds no filesystem reads, CSS interpreter, dependency, command, or onboarding step.
- The replacement preserves the rule ID and advisory status, but reports a measured near-scale relationship rather than claiming design intent. Its correction hint requires contextual review and preserves deliberate recurring sizes.
- The real-project diagnostic set contains 60 reviewed cases: 39 negatives, 21 abstentions, and no supported positives with the supplied theme evidence. Files separate 49 development cases from 11 held-out cases; none of those holdout cases establishes recall. Labels came from this Codex session with AI provenance, not a human.
- The development adapter needed a version-2 rubric wrapper. The exported corpus contains 39 boolean labels; the original annotation file retains all 21 abstentions. The corpus is diagnostic evidence, not a balanced promotion set.
- A separate live Jev probe used 12 hand-authored cases, six positive and six negative. Positive probabilities were 0.85 to 0.92; negatives were 0.07 to 0.27. This shows the question can separate supplied examples, not that the proposed collector provides sufficient real-project evidence. The optional semantic replacement is therefore not shipped; `craft-arbitrary-value-class` is unchanged.
- The environment credential failed with HTTP 401. The key originally supplied by the user succeeded. Failed attempts are retained separately and excluded from the successful baseline measurements. No key is stored in repository artifacts.
- Project snapshots initially lived under ignored `results/`, but Vitest still discovered their tests. That verification attempt was stopped and the snapshots moved outside the repository. Snapshot hashes were checked before resuming. This is a verification-environment correction, not a package change.

## How the run ended

Completed the scale correction. The optional semantic replacement did not meet the real-project evidence gate and remains deferred, as the plan specifies. All required checks passed. Publication proceeds through the Changesets release workflow.

### Verification

- Node 24: `npm run verify:full` passed, including lint, build, types, 196 tests across 28 files, packed-consumer checks, and 168 active rules.
- `npm run port-rules -- --skills-dir ../agent-skills --check`: 73 YAML source ports checked, zero drift. The migrated rule is now registered in code.
- `npx changeset status`: one patch release queued for taste-lint.
- Fresh adversarial review found two edge cases, both corrected and covered: retain proven font matches beside unsupported families, and include decimal values exactly at the 1px boundary. Follow-up review confirmed both fixes.
- Original source-file hashes and Git status were checked after the scans. Blode and Donebear are unchanged. Two original Iconsmith files changed during the run (`apps/web/components/studio.tsx` and `docs/foundry-log.md`); both comparisons used the preserved snapshot, which did not change. This work performed no writeback to those source checkouts.

### Evidence locations

Local artifacts are under `results/semantic-verification/`, which is ignored and excluded from the package:

- `snapshots.json`: source revisions, dirty state, snapshot paths, and per-file SHA-256 hashes.
- `baseline/`: cold and warm reports, commands, timings, sanitized request records, and caches from the packed 0.0.6 CLI.
- `reference-labels.json`: the 60 individually reviewed AI annotations, source context, and split provenance.
- `corpus/reference.jsonl` and `reference-coverage.json`: importable boolean labels and coverage diagnostics.
- `jev-probe.mjs` and `jev-probe.json`: frozen question, synthetic input evidence, and live outcomes.
- `baseline-verify.log`: 189 passing tests, packed smoke test, and 168 active rules before implementation.

Snapshot and label source excerpts remain local rather than entering the public package.

### Packed CLI comparison

| Project | Files | Findings before / after | Near-scale findings before / after | Near-scale unknowns after | Total unknowns before / after |
| --- | --- | --- | --- | --- | --- |
| blode-co | 77 | 199 / 169 | 30 / 0 | 9 | 0 / 9 |
| donebear | 570 | 928 / 856 | 72 / 0 | 101 | 58 / 159 |
| iconsmith-internal | 35 | 81 / 70 | 10 / 0 | 16 | 2 / 18 |

These are honest coverage changes, not evidence that all removed warnings were false positives. The old rule emitted one finding per source file; the replacement checks parsed class lists, so finding and unknown counts have different units. None of the snapshots declares explicit pixel font tokens, so the replacement produces no positive comparisons there. Known positive behavior is covered by declared-theme regression fixtures. One additional Iconsmith finding varied between independent Jev runs; it is not attributed to this correction.

| Project | Cold requests before / after | Input tokens before / after | Estimated cost per cold scan | Cold seconds before / after | Warm seconds before / after |
| --- | --- | --- | --- | --- | --- |
| blode-co | 24 / 24 | 23105 / 23105 | $0.000970 | 12.174 / 2.478 | 0.584 / 0.599 |
| donebear | 256 / 256 | 239336 / 239336 | $0.010052 | 18.768 / 22.012 | 3.026 / 3.065 |
| iconsmith-internal | 18 / 18 | 16184 / 16184 | $0.000680 | 2.304 / 2.363 | 0.741 / 0.765 |

Every cold and warm run completed with zero provider errors. Every warm run made zero requests. Costs use the existing input-token estimator, not billing receipts. Timings are single observations with provider/retry variability, not a speedup benchmark. The final after scans used the repacked artifact following both review fixes.

Source revisions: Blode `3b21e0dd31bdb412ae512fe6bb596f5e9fe2e4bb`, Donebear `7eccf60b754ef7e76ff254898aa251d135a06d23`, Iconsmith `479e2211a1d2b5b5580012b1fbbcdbaf2957a476`. Snapshot manifests retain dirty-file contents by hash; neither dirty checkout is described as a clean revision.

### Comparison limits

The 60-case diagnostic set is not a population precision estimate. Against the intended usefulness rubric, the unchanged arbitrary-value rule still produces nine positive predictions on negatively labeled cases. The near-scale subset has zero confirmed positives, so it cannot establish recall. The correction is supported by parsed-class and numeric regression tests, not a claim of tenfold accuracy.

The Jev probe uses hand-authored examples rather than a fresh real-project holdout. Its 12 requests consumed 6,406 input tokens. Shipping a semantic gate now would require evidence the current collector does not provide. No question, threshold, default profile, or reporting limit was changed to make counts look better.
