---
title: blode-co review-rule evaluation
hidden: true
---

# blode-co review-rule evaluation

2026-09-20. Diagnostic evaluation of 80 blind agent-labeled rule-unit pairs, using cached probabilities from the original audit. No new model calls. These labels are provisional and are not human ground truth.

## Method

Forty samples per rule, round-robin across available document-type and probability strata (<0.4, 0.4-0.75, >=0.75), ordered by cache-key hash within each stratum, with duplicate text removed per rule. The labeler saw the rule, text and document type, but no per-item probability or stratum. Labels were saved before predictions were joined. Dev/holdout membership uses the existing splitFor function on the source document path, keeping each document in one split. These balanced diagnostic samples do not estimate corpus-wide prevalence or precision.

Raw labels and rationales: `data/corpus/blode-co-review.jsonl`. Cached probabilities and machine-readable metrics: `docs/evaluations/blode-co-review.json`. No threshold or prompt was tuned on these labels.

## Results at the current review threshold (0.4)

| Rule | Split | n | TP / FP / FN / TN | Precision (95% Wilson) | Recall (95% Wilson) |
| --- | --- | --- | --- | --- | --- |
| copywriting-generic-framing | dev | 33 | 2 / 19 / 0 / 12 | 10% (3%-29%) | 100% (34%-100%) |
| copywriting-generic-framing | holdout | 7 | 0 / 5 / 0 / 2 | 0% (0%-43%) | n/a (0%-100%) |
| copywriting-unnatural-polish | dev | 30 | 0 / 21 / 0 / 9 | 0% (0%-15%) | n/a (0%-100%) |
| copywriting-unnatural-polish | holdout | 10 | 0 / 7 / 0 / 3 | 0% (0%-35%) | n/a (0%-100%) |

## Decision

Keep both rules review-only and retain both thresholds. The sample contains only two positive generic-framing labels and no positive unnatural-polish labels, so it cannot establish recall or justify promoting, suppressing, or retuning either rule. Human adjudication and a larger positive sample are needed before changing behavior based on precision.

The only applicability change makes unnatural-polish skip explicitly classified reference and UI documents, as its current question already instructs. The sampled document types do not include reference or UI, so this does not claim an observed improvement on these 80 examples. Tests cover both exclusions and applicable prose.

Examples of questionable notes should be inspected at their source locations: short instructions such as “Explain the concept plainly,” field labels such as “Endpoint,” and concrete operational details are not affirmative evidence of a generic opening or suppressed personal texture. Blog MDX currently defaults to lesson; no new document type is introduced without a measured benefit.

## Long-sentence investigation

The current rule counts over 25 words per punctuation-delimited sentence. Quotations can legitimately exceed that limit, list items can be long, inline code contributes extracted text, and abbreviations can split a sentence early. Those are domain-policy and tokenization questions, not evidence for raising the threshold. A quote-boundary regression case records the current policy; abbreviation and inline-code limitations remain documented, and no sentence threshold change is shipped.

## Comparison limits

The original whole-repo run and final replay both contain 6,474 units. The replay reproduces 537 grouped act findings and 9,353 grouped review findings, while preserving 17,091 unsuppressed rule findings. It completes without credentials, with zero new requests and zero reported cost. Sampling used unique source text per rule, so symlink aliases did not receive extra sample weight.

The controlled replay against an untouched `72392b1` build also confirms byte-equivalent parsed grouped findings and identical legacy scorecards. Complete rule evidence exposes 558 failing rule findings behind 537 grouped act findings; this is additional visibility, not newly detected content.
