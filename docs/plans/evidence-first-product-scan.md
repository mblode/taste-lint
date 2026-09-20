---
title: Evidence-first product scan
hidden: true
---

# Evidence-first product scan

## Outcome

A default scan should return a short, prioritized set of actionable checks without treating house style as a product defect. A rule needs evidence of the specific problem it names. Candidate matching, semantic judgment, and reporting remain separate stages of the existing pipeline.

## Implementation

1. Give JSX copy the same bounded local section evidence already used by style review. Jev judges empty states, error messages and confirmation labels with nearby controls. Replace the error-state rule's file-wide keyword absence shortcut with a candidate plus a focused Jev judgment. Missing or oversized required evidence stays unknown. Semantic rules stay advisory.
2. Narrow the default product policy to six checks: error recovery, unclear error messages, empty-state next steps, ambiguous confirmation, unsupported marketing claims, and transition-all. Explicit --only and --profile all retain access to the broader catalog. Do not claim this selection is calibrated or comprehensive.
3. Rank scan report groups by action band, severity and confidence before occurrence count, showing five by default. Preserve every finding, unknown and failure in JSON and exit policy. Grouping by rule is a review convenience, not proof of a shared root cause.
4. Evaluate paired weak/strong examples with both review and act metrics. Group splits by source family and report pairs as successful only when the weak version is flagged and every acceptable counterpart remains below review. Unanswered counterparts remain unresolved. Seed focused, rule-specific course examples and intentional-exception cases; never infer every rule's label from a broad category.

## Verification

- Extraction/pipeline tests: nearby action survives in state; missing and oversized evidence abstains; provider failure cannot create a mechanical positive; an unrelated catch cannot suppress the error-state candidate.
- Scan tests: explicit selections and full catalog remain available; default excludes appearance preferences; failure counts and JSON survive display limits; major sparse findings precede frequent minor ones.
- Eval tests: a model flagging both sides fails the pair; unresolved pairs never pass; split siblings cannot leak; review metrics differ from act metrics when appropriate.
- Live Jev: run course pairs and independent synthetic exception families with provenance, then scan donebear and blode-co and check cached repeat behavior. Report disagreements without claiming population accuracy.
- Run npm run verify:full and source-port drift check on Node 24.

## Boundaries and recovery

No browser automation platform, screenshot model, automatic fixes, new dependency, or new scoring model. Source evidence cannot establish full rendered quality. Existing rendered extraction remains available. Reverting this change restores the previous default; scan signatures reject baselines from changed policies. This plan does not authorize claiming calibration from a small diagnostic benchmark.

## Completion

All four implementation slices are complete. Verification and measured limits are recorded in [the review](../reviews/evidence-first-product-scan.md). Full verification passed with 213 tests. The final live regression benchmark passed 17 paired families; both project scans completed and repeat scans made zero AI requests. This is diagnostic evidence, not a calibrated taste verdict. A patch changeset records this release.

## Follow-through: task context

The next slice is complete: surrounding task-region evidence, structural exclusion of mutually exclusive branches, evidence-preserving agent exports, and an opt-in regression gate. See [task-context verification](../reviews/task-context.md). Full verification passes 218 tests; live evaluation passes 26 paired families. Donebear's same-policy findings fell from 44 to 15, with five additional unknowns retained explicitly.
