---
"taste-lint": minor
---

Calibrate the judge against your own labels. `eval label` walks a `lint --samples` file in the terminal and records your call, an unsure answer or a note, saving after each answer and stopping at a timebox (default 120 minutes). Samples now list likely failures first: units you already ignored, then units where the mechanical check fired but Jev said no, then Jev's review band. `eval gaps` groups unsure answers and notes by rule so you can sharpen the rubric, `eval agreement` measures whether an AI labeller agrees with you per rule, `eval --disagreements` lists each item where the judge and the label disagree, and `eval`, `tune` and `tune ab` take `--source hand` to measure and tune against your labels only.

`eval` now fails with the provider's auth error when the key is rejected, instead of printing metrics for a judge that never ran. `copywriting-generic-framing` and `copywriting-unnatural-polish` no longer flag labels, identifiers, URLs, headings or plain instructions.
