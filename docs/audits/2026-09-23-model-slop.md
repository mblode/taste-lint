---
title: What five models get wrong in UI and copy
hidden: true
---

# What five models get wrong in UI and copy (2026-09-23)

`scripts/generate-slop.mjs` asks GPT-6 Astra, GPT-6 Sol, Claude Opus 5.5, Claude Fable 5.1 and Grok 4.7 for the same six screens and six pieces of copy about Northwind, a made-up sync app. Each prompt carries five facts and nothing else, so any customer, stat, setting or comparison in the output is invented. Outputs go to `results/slop/` (ignored).

Status: all 60 outputs, linted live with every rule. Generation cost is in `results/slop/usage.jsonl`; the live lint of all 60 cost under $0.10.

## The old slop is gone

No purple gradients, no "Trusted by" logo rows, almost no invented stats or testimonials. The rules that target those found nothing.

## What replaced it

| Failure                                                                      | Models                                | Caught by                                                             |
| ---------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------- |
| Raw palette colours instead of tokens                                        | Opus 157, Fable 111, Grok 64, Sol 44  | `craft-raw-colour-class`                                              |
| Hex arbitrary values, text under 12px                                        | Astra 278, Sol 158                    | `craft-arbitrary-value`                                               |
| Traffic-light dots over nothing                                              | Opus, Astra, Sol                      | `craft-faux-product-chrome` (widened to any colour)                   |
| Blurred blobs and rings hung off the box                                     | Sol, Astra, Opus                      | `craft-decoration-no-role` (widened)                                  |
| Spaced em dashes in interface copy (unspaced ones are accepted)              | 9 of 12 across Fable, Opus, Sol, Grok | `copywriting-em-dash-in-ui` (new, review-only)                        |
| `href="#"`                                                                   | Fable 3, Opus 2, Sol 2, Astra 1       | `copywriting-dead-link` (new)                                         |
| Eyebrow label over nearly every heading                                      | Sol, Astra, Opus                      | `craft-eyebrow-overuse` (new)                                         |
| 01 / 02 / 03 on cards that are not steps                                     | Astra, Sol                            | `craft-decorative-ordinals` (new)                                     |
| ↗ on internal links                                                          | Astra                                 | `copywriting-external-arrow-internal-link` (new)                      |
| Emoji in UI                                                                  | Astra 8, Sol 8                        | `copywriting-emoji-in-ui`                                             |
| The same few facts restated (the trial 8 times)                              | Opus                                  | `copywriting-fact-padding` (new)                                      |
| Invented settings, modes and app shell                                       | Grok, Sol                             | Jev only; needs the brief                                             |
| Competitor claims                                                            | Fable                                 | Jev only                                                              |
| Slogan fragments ("Same file. Different flights.", "A folder, not a portal") | Astra, Sol, Opus, Fable, Grok         | `copywriting-slogan-headings` (new)                                   |
| Convergent lines ("Stay in sync. Keep it simple.")                           | Astra and Sol                         | `copywriting-slogan-headings` when in a heading; otherwise not caught |
| Tee-ups ("Here's a quick way to", "That's the whole pitch")                  | Fable, Opus, Grok                     | `copywriting-tee-up` (widened)                                        |
| Straight quotes in UI                                                        | Opus 37, Fable 40                     | `typography-straight-quotes`                                          |

## Each model's signature

- **Astra:** art-directed like an ad campaign. Slogans, hex colours, 9px text.
- **Sol:** the stock SaaS template. Blobs, traffic lights, eyebrows, 01/02/03, an invented app shell.
- **Opus:** every template section, accurate but padded.
- **Fable:** the most restrained. Its tells are em dashes, `href="#"` and one competitor claim.
- **Grok:** literal. It copies facts verbatim and invents settings that contradict them ("Relay only").

## Error copy

Mostly clean across all five. Fable used an em dash. Opus offered Try again for a full disk. Astra and Sol end every message with a reflexive "try again" and do not name the locked file.

## How well the judge reads this copy

An audit of every Jev copy finding on the 60 outputs:

- Every UI finding came through a keyword prefilter ("Simple", "Everything you need"). Judge-only rules never read the other 21 UI files, so mood lines, filler FAQs and slogans in TSX went unjudged.
- The judge never sees the brief, so `copywriting-fabricated-specificity` flagged the brief's own facts (0 of 18 correct) and missed the real inventions: settings, policies and competitor claims.
- `copywriting-idea-repetition` was right about 1 time in 5. It flagged first mentions, headings against their body, and parallel error entries.
- `copywriting-generic-language` (9 of 42 correct) and `copywriting-prompt-restatement` (0 of 10) judged greetings, sign-offs and buttons as prose.

Rubric fixes, rerun live on the same outputs:

| Rule               | Before | After | What dropped                                                                                |
| ------------------ | ------ | ----- | ------------------------------------------------------------------------------------------- |
| generic-language   | 42     | 22    | greetings, sign-offs, buttons, bare headings; one stock line ("Thanks for giving it a go.") |
| prompt-restatement | 10     | 5     | the same                                                                                    |
| unexplained-action | 6      | 5     | a numbered step                                                                             |
| idea-repetition    | 190    | 165   | little: the judge still flags first mentions                                                |

## Fixed from principles

Each fix gives the judge the evidence it was missing, instead of more rubric wording. Rerun live on the same 60 outputs with `--brief` set to the generation facts:

| Rule                   | Rubric fix | Principles fix | Why                                                                                                                                                                  |
| ---------------------- | ---------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| idea-repetition        | 165        | 26             | Asked only when an earlier sentence in the file shares content words (`EARLIER:` in the state), so a first mention is never judged                                   |
| generic-language       | 22         | 2              | Prose rules skip units under five words, so labels and price fragments never reach them                                                                              |
| prompt-restatement     | 5          | 1              | The same gate                                                                                                                                                        |
| fabricated-specificity | 18         | 0              | With a brief, the brief’s own facts are not fabricated. All 18 old findings were brief facts                                                                         |
| generic-framing        | 2          | 14             | Prose rules now read JSX text. Most new findings are real slogans                                                                                                    |
| mechanism-over-outcome | 21         | 52             | The same. Nearly all restate “local network first, encrypted relay” with no outcome, which is the rule’s intent                                                      |
| invented-capability    | none       | 42             | New, needs `--brief`. At 0.6 and above (14) it catches competitor claims, “Relay only” and invented pricing policies; below 0.6 it is mostly paraphrase of the brief |
| antithesis-contrast    | none       | 2              | New candidate rule: `, not X` and a sentence opening “Not” are sent to Jev, which separates contrast slogans from plain instructions                                 |

idea-repetition is now right about half the time. Its remaining false positives are price and trial facts repeated where the reader acts on them.

## Second calibration pass (2026-09-24)

Dev split, strong labels only. Precision stayed at 100% for every rule below.

| Rule                   | Recall before | Recall after | Change                                                                                                         |
| ---------------------- | ------------- | ------------ | -------------------------------------------------------------------------------------------------------------- |
| claim-without-evidence | 50%           | 80%          | Rounded boasts ("10,000+ teams", "up to 5x", unnamed "trusted by") count as claims; comparatives join the gate |
| dead-weight-hedges     | 75%           | 100%         | Sweep label corrected                                                                                          |
| register-shift         | 25%           | 100%         | Three sweep labels corrected                                                                                   |
| reader-first           | 13%           | 25%          | "Now with X"                                                                                                   |
| machine-prose          | 0/3           | 0/3          | Gate adds "here is some"; see below                                                                            |

- **Sweep labels.** Four `tt-sweep-sample` items were labelled against the rule definition. They now carry the labels that taste-training's own `sweep-runner.tsx` detectors give them.
- **JSX blind spot.** Ten phrase-gated tell rules read only Markdown, so "not just a tool, it is a way of working" in a hero went unflagged. They now read JSX text as well. On the five models' output and on donebear's marketing site they add 0 requests, because the gate fires only on a tell.
- **generic-language on real copy.** On donebear's marketing site it gave 42 findings, mostly plain headings and plan limits. The question is now a substitution test: could this sit unchanged on a competitor's page? That leaves 6 findings, all in the review band. It still flags "The Future of Work, Reimagined" at 0.72.
- **Cost.** A cold scan of all five models' output with `--brief` is 1,761 requests and about $0.12. `invented-capability` accounts for most of the input tokens, because every unit carries the brief.
- **Build cache.** The CLI build declared no turbo outputs, so a cache hit restored nothing and could ship a deleted rule file in the packed tarball. `packages/cli/turbo.json` now declares `dist` and the staged `data`.

## Not fixed

- **invented-capability precision below 0.6.** It stays review-only. Label its findings with `eval label` and let `tune` set the threshold; do not raise it by hand.
- **A scan without a brief** still cannot judge invented behaviour. The ui-design skill forbids it at generation time (`slop-invented-behaviour`).
- **machine-prose shape misses.** "Here is where it gets interesting" and "stay productive wherever they work" have no phrase to gate on. Removing the gate caught them, but the rule then scored plain headings at 0.86 and duplicated generic-language, so the gate stays.
- **Rows for your labels.** Five dev labels contradict their rule or need page context: reader-first on "$24 per seat, per month. Cancel any time.", a pricing-page composite and "Sync runs every 300 seconds" (a mechanism-over-outcome case); claim-without-evidence on "Trusted by Acme · Borealis…" (named customers count as evidence); generic-framing blode-co-31 at 0.40. Label them with `eval label results/slop-residue.json`.
