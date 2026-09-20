---
title: Jev style review
hidden: true
---

# Jev style review

`craft-arbitrary-value-class` now requires a Jev judgment. Code still extracts literal candidates and excludes token references, CSS expressions and assets expressed as URLs. The semantic question asks whether a value serves reusable visual styling worth reviewing for a named token. It does not claim a defect, identify an existing replacement or ask Jev to calculate a scale difference. The earlier proposal to prove near-token substitution remains a different, unsupported claim.

## Implementation

The existing `section` context carries JSON containing the target opening tag, static text and candidates, its enclosing opening tag, and up to four nearby JSX elements. Existing context budgets reject oversized states before a call. Dynamic class candidates abstain. Candidate filtering happens before requiring context, so excluded syntax remains a deterministic negative rather than a false unknown.

The existing planner isolates contextual jobs. Unrelated questions keep their original state. Cache keys include the contextual state and question; sample export and corpus replay preserve that same evidence. No new command, dependency, provider transport or config is required. Provider failure stays unknown/incomplete, never a mechanical positive.

This follows TypeSafe's [state](https://docs.typesafe.ai/concepts/state), [Noul](https://docs.typesafe.ai/primitives/noul), [building](https://docs.typesafe.ai/concepts/how-to-build-with-system-one) and [citation-checking](https://docs.typesafe.ai/cookbooks/citation_check) guidance: deterministic candidate/evidence preparation, followed by a focused semantic judgment. The existing Gateway adapter remains unchanged.

## Semantic checks

Before asking Jev, this Codex session individually labeled 18 real-project candidate contexts under the new rubric: three positives, 14 negatives and one unresolved reference. Prior mechanical scan outputs were known; the new Jev predictions were hidden. Files separated nine development cases from nine holdout cases. Private source evidence, labels, question hashes and probabilities remain in ignored `results/jev-style/`.

Development testing initially over-flagged two SVG chart labels. The question was clarified to exclude chart-coordinate styling before querying the holdout. The final development probabilities were 0.74 for its positive and 0.09 to 0.22 for its seven negatives. The unresolved reference received 0.64; it stays unresolved in the reference data and is excluded from agreement calculations.

The untouched nine-case holdout contained two positives (0.70 and 0.73) and seven negatives (0.09 to 0.18). All were separated at the unchanged 0.35 review threshold. This is diagnostic agreement with AI labels, not a population accuracy estimate or a promotion corpus.

Eight additional synthetic development fixtures are checked in with AI-label provenance: four positive visual roles and four intentional constraints. Live evaluation retained all four positives at the review threshold and excluded all four negatives. At the separate 0.70 act threshold, the built-in evaluator reports 50% recall, with two positives in the review band. No thresholds changed. The rule remains review-only.

## Packed CLI comparison

Published 0.0.8 and the patched package scanned the same selected files, verified with before/after SHA-256 hashes. Neither project was modified.

| Project | Files | All findings before / after | Style findings before / after | New style unknowns | Blockers before / after |
| --- | --- | --- | --- | --- | --- |
| Donebear | 570 | 750 / 653 | 159 / 62 | 13 | 15 / 15 |
| blode-co | 77 | 125 / 57 | 84 / 16 | 0 | 5 / 5 |

All count changes are in the style rule. Donebear's 13 new unknowns are dynamic class candidates, not passes. Of its 146 answered candidates, 84 fell below the review threshold and 62 remained visible. All 84 blode-co candidates were answered: 68 fell below the threshold and 16 remained visible. These reductions are not proof that every removed warning was false.

| Project | Cold requests before / after | Cold estimated cost before / after | Patched warm requests |
| --- | --- | --- | --- |
| Donebear | 256 / 390 | $0.0101 / $0.0141 | 0 |
| blode-co | 24 / 107 | $0.0010 / $0.0034 | 0 |

Cold baseline request/cost values come from the prior uncached runs; the immediate 0.0.8 comparison reused those cached answers. Patched cold runs used fresh caches. All completed with zero provider errors. Donebear used 394 HTTP attempts for 390 successful logical requests. Costs are estimates from known input usage, not billing receipts.

## Verification

Full verification covers 205 tests in 30 suites, packaged dry-run planning, 168 active rules, sample/corpus state parity, cache isolation and invalidation, and provider failure without fallback. The code-rule status remains review-only. A patch changeset records the behavior change.
