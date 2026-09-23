---
"taste-lint": minor
---

Catch the slop current models write now that the purple gradients are gone. New review-only rules: `craft-eyebrow-overuse`, `copywriting-fact-padding`, `copywriting-dead-link`, `craft-decorative-ordinals`, `copywriting-external-arrow-internal-link`, `copywriting-slogan-headings` and `copywriting-em-dash-in-ui` (spaced em dashes only; unspaced ones are accepted). `craft-faux-product-chrome` now catches traffic-light dots in any colour, `craft-decoration-no-role` catches blurred blobs and rings hung off the box, `copywriting-tee-up` catches "Here's a quick way to" and "That's the whole pitch", and `copywriting-vague-error` reads a bare "Try again".

`lint --brief <file>` gives the judge what the product does. The new `copywriting-invented-capability` rule flags copy that claims a setting, policy, integration or comparison the brief never states, and `copywriting-fabricated-specificity` no longer flags the brief's own facts. `copywriting-antithesis-contrast` catches "A folder, not a portal." slogans.

`copywriting-idea-repetition` is now judged only against earlier sentences in the same file that share its words, so a first mention is never flagged. Prose rules read JSX text as well as Markdown, and skip units under five words, so button labels, greetings and price fragments are no longer judged as prose.

Ten phrase-gated tell rules (`antithesis-frame`, `tee-up`, `participle-tail`, `copula-avoidance`, `canned-phrasing`, `boilerplate-offer`, `excessive-hedging`, `generic-validation`, `meta-commentary`, `repetitive-transitions`) now read JSX text too; they cost nothing until a tell appears. `copywriting-generic-language` asks whether the copy could sit unchanged on a competitor's page, which stops it flagging plain headings and limits. `copywriting-claim-without-evidence` treats "10,000+ teams", "up to 5x" and an unnamed "trusted by" as claims, `copywriting-reader-first` catches "Now with X", and `copywriting-antithesis-frame` catches "not just X, it is Y".
