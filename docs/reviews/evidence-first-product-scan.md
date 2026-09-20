---
title: Evidence-first product scan verification
hidden: true
---

# Evidence-first product scan verification

## What changed

The default product scan now selects six checks with concrete review outcomes. Broad style preferences remain explicitly selectable. Jev judges error recovery and confirmation labels, while empty-state and error-message questions see nearby JSX. The report prioritizes five rule groups by action band, severity and probability. Full findings and failure policy are retained in machine-readable reports.

The same extractor, planner, evaluator and cache serve scans and corpus replay. No dependency, provider adapter, new command or scoring model was introduced. One benchmark seeding script and one test suite were added to support the new evaluation contract. Existing modules own the behavior instead of another orchestration layer.

This follows TypeSafe's state and Noul guidance: code selects candidates and preserves evidence; focused questions judge meaning. Read https://docs.typesafe.ai/concepts/state and https://docs.typesafe.ai/primitives/noul. Jev is text-only; these changes do not claim visual perception or browser state verification.

## Semantic verification

The focused benchmark contains 34 variants in 17 families: five course families, ten synthetic intentional-exception families, and two development regressions found during real-project review. All 17 families passed the final live evaluation at the unchanged review threshold of 0.35. Each pass means the weak example was flagged and its acceptable counterpart was preserved. No failed or unknown answers occurred in that run.

The initial 15-family benchmark passed. Reviewing project output then exposed status badges being treated as error explanations and a background integration being treated as a user-facing async region. Added development regressions and clarified the questions. The badge regression initially failed because the positive and negative criteria did not carry the exclusion stated in the instructions; aligning both criteria resolved that diagnostic case. A separate extraction fix abstains on dynamic message fragments instead of pretending their literal prefix is the complete message. JSX fragment siblings now preserve nearby actions.

These examples were inspected and some reused during development. They are regression evidence, not an untouched holdout or population accuracy estimate. AI reference provenance and that limitation are recorded in data/benchmarks/product/README.md. No semantic rule was promoted. Existing course corpus split assignments were repaired to group source files; reassignment does not erase prior exposure.

## Real-project checks

Both compiled CLI scans completed without provider errors. Neither target project was edited.

| Project  | Findings | Failing | Advisory | Unknown | Repeat AI requests |
| -------- | -------- | ------- | -------- | ------- | ------------------ |
| Donebear | 44       | 4       | 40       | 24      | 0                  |
| blode-co | 1        | 1       | 0        | 2       | 0                  |

The five remaining failing findings are transition-all occurrences. Unknowns include missing surrounding context for extracted copy objects and dynamic error messages. They are not passes. These counts are not comparable accuracy estimates against the earlier broad scans: most of the reduction comes from intentionally changing the selected rules. Forty Donebear advisories still need individual review; the benchmark does not establish that every one is correct.

The inherited environment key returned a sanitized authentication error on the first attempted evaluation. Retrying with the key explicitly supplied for this task succeeded. No credential was written to repository files or reports.

Private source-bearing reports remain in ignored results/evidence-first/. The final runs are benchmark-verified.json, donebear-verified.json, donebear-warm-verified.json, blode-co-verified.json and blode-co-warm-verified.json.

## Engineering checks

- npm run verify:full: passed; 213 tests in 31 suites, lint, build, typecheck, packed-consumer checks, 168 non-draft rules.
- npm run port-rules -- --skills-dir ../agent-skills --check: 73 shipped ports checked, zero drift.
- npx changeset status: patch pending.
- Regression tests cover missing and oversized context, dynamic text, provider failure, candidate suppression by unrelated catch, explicit rule selection, output prioritization, split-family leakage and paired false positives.

The useful next evidence is independent examples and verified fixes on real interfaces. Adding more default rules before that would recreate the review burden this change addresses.
