---
title: Product scan noise fixes
hidden: true
---

# Product scan noise fixes

Compared published 0.0.7 with the patched npm artifact on the current Donebear and blode-co checkouts. Both scans use the product profile and Jev. All selected source files were hashed before and after; their contents were unchanged. Reports and source hashes remain in ignored `results/noise-fix/`.

## Detector corrections

- Arbitrary-value checks now distinguish literal design values from CSS tokens, calculations, asset URLs, relative layout values and selector syntax. Fixed numeric sizes and literal colours remain advisory candidates. A bracket alone does not establish a defect, and the hint no longer prescribes changing a deliberate size.
- `transition-none duration-500` no longer produces a slow-transition finding.
- Explicit font-size configuration takes precedence over Tailwind defaults. An unresolved explicit size clears stale measurements, and colour/length type hints are respected. Ambiguous variables remain unknown rather than being assumed to be colours.
- Scan compatibility includes the package version. A changed analyser must not make an old report describe removed warnings as resolved source defects.

## Policy change

Product scans retain punctuation, sentence-length and line-height preferences as visible advisory findings. Writing and instruction profiles share the same style policy. `lint` and the `all` profile retain strict rule policy. This changes exit policy, not detector accuracy.

## Results

| Project | Files | Total before / after | Blocking before / after | Advisory before / after | Unknown before / after |
| --- | --- | --- | --- | --- | --- |
| Donebear | 570 | 856 / 750 | 144 / 15 | 712 / 735 | 159 / 161 |
| blode-co | 77 | 169 / 125 | 5 / 5 | 164 / 120 | 9 / 9 |

Donebear's arbitrary-value findings fell from 264 to 159; blode-co's fell from 128 to 84. One Donebear slow-transition finding was removed for `transition-none`. The remaining 128-finding reduction in Donebear's blocking count is the explicit advisory-policy change. Two additional unknowns concern ambiguous CSS variables; they are not passes. Independent Jev runs changed which unit received one advisory submission-state finding, with its total unchanged. No semantic-accuracy improvement is claimed from that variation.

The cold patched scans made 256 and 24 requests respectively, with zero provider errors. Each warm scan made zero requests. The final repacked artifact reproduced these counts using cached judgments. Remaining findings still need contextual review; these checks do not establish that every warning is a defect.

## Verification

- 200 tests across 29 suites, including preserved positive cases and mixed token/literal cases.
- Full lint, build, typecheck, tests, packed-consumer checks and 168 active-rule validations passed.
- 73 skill ports checked with zero drift.
- Documentation validation passed. A patch changeset records the behavior and policy changes.
