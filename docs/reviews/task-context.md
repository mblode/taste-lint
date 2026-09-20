---
title: Task-context verification
hidden: true
---

# Task-context verification

## User value

The next bottleneck was evidence quality: the same six-rule default incorrectly flagged a nested Clear filters button, optional No project choices, search pickers, and a sign-in error with a nested recovery link. Smaller reports alone did not fix these errors.

Copy extraction now supplies a surrounding JSX task region with nested controls, descriptions and action props. The extractor looks through at most four ancestors for common task containers; its fallback stays local. Empty presentation chrome includes its parent because task actions often live in the toolbar. Card boundaries keep an adjacent card's unrelated action out of the evidence. Oversized regions abstain under the existing context budget.

A new diagnostic caught a more serious failure: the model borrowed a recovery button from the opposite ternary branch. The extractor now replaces that mutually exclusive branch with an explicit omission marker while retaining the target's condition and reachable controls. This is a code fact, not a semantic inference. Other conditional visibility and imported components remain unresolved by this local extractor.

No dependency or provider was added. Code prepares evidence; Jev interprets whether the task leaves a person without a next step. Style judgments retain their smaller existing context. Cache keys already include the state, so changed evidence refreshes automatically.

## Agent workflow

Saved findings retain their contextual evidence. Scan exports carry it and the repository root, with verification instructions requiring the affected UI state to work after a fix. Disappearance of a fingerprint alone is not sufficient: edits can change identity while leaving the problem intact.

`eval --check` makes regression evaluation enforceable. It returns 1 for a reference disagreement and 2 for missing evaluations. Dry-run checks are rejected. The test suite proves a false-positive evaluator fails and a missing-context evaluator is incomplete. Ordinary eval remains an analysis command; this strict opt-in gate is separate from promotion.

## Measured results

| Project | Prior findings | Current findings | Failing | Advisory | Unknown | Warm requests |
| --- | --- | --- | --- | --- | --- | --- |
| Donebear | 44 | 15 | 4 | 11 | 29 | 0 |
| blode-co | 1 | 1 | 1 | 0 | 2 | 0 |

These scans use the same six selected rules, unlike the earlier broad-to-focused comparison. Donebear's unknowns increased from 24 to 29 because larger evidence sometimes exceeds the safe budget. Four failing transition-all checks remained; blode-co retained its one transition-all check. Neither project was edited. Fewer findings do not establish the accuracy of every removal or remaining advisory.

The live semantic regression gate passes 52 variants in 26 paired families at the unchanged 0.35 review threshold. Each family requires detecting the weak version while preserving the acceptable counterpart. The first expanded run failed the conditional-branch case; the structural correction made the gate pass. These development cases are disclosed regression evidence, not a fresh independent holdout. AI provenance and benchmark limitations remain in data/benchmarks/product/README.md.

## Verification

- npm run verify:full: passed with 218 tests across 31 suites, lint, types, build, packed consumer checks and 168 non-draft rules.
- Live evaluation: no provider errors; strict regression gate exit 0.
- Both real projects completed with no provider errors; repeat runs required zero model requests.
- Private reports: results/task-context/benchmark-verified.json, donebear-verified.json, blode-co-verified.json and their warm counterparts.

Remaining limits include imported UI, distant page actions, runtime permissions and conditional visibility beyond direct ternary ancestry. Unknown is preserved when required context is absent or too large. Browser verification is still needed to establish the actual user outcome.
