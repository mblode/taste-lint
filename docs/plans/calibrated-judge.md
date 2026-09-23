---
title: Calibrate the judge against your own labels
hidden: true
---

# Calibrate taste-lint's judge against your own labels

Authoritative plan: `docs/plans/calibrated-judge.md`. Source: Vlad Gavrilov, "Scale your taste: why you should calibrate your LLM judge", VCMC #4, 23/9.

## Outcome

The talk's thesis: a judge that has never been checked against a human settles hard cases with the model's biases, not yours. The fix is to spend about two hours labelling real failures, sharpen the rubric wherever you can't decide on a label, tune the judge until it agrees with you, and only then optimise against it.

taste-lint already has everything downstream of labels: per-rule Jev questions, bands, `tune` with Wilson lower bounds, the `tune ab` McNemar test, the holdout promotion gate, and `eval labels` import. The judge still hasn't been checked against a human:

| Evidence | Where |
| --- | --- |
| 0 of 280 corpus items are `hand`-labelled. They are `manifest-weak` (129), `manifest` (59), `sweep` (4) and `ai` (8). Only copywriting has a holdout split (22). | `data/corpus/*.jsonl` |
| Every labelling path is an AI path: a Codex session or `anthropic/claude-sonnet-4.6`. | `scripts/prepare-labels.mjs`, `scripts/label-samples.mjs` |
| No rule has been tuned. | `data/rules/tuning.json` = `{}` |
| 100 of 114 YAML rules are stuck at `review-only`. | `data/rules/**` |
| The `hand` label source exists but nothing produces it except hand-editing JSON. | `src/scan/samples.ts:163`, `src/eval/corpus.ts:136` |

**Acceptance criteria**

1. A single command walks you through samples in the terminal, records true, false or unsure plus an optional note, and imports the results as `labelSource: "hand"`.
2. Samples are chosen by likely-failure heuristics, not at random.
3. Unsure answers and notes come out as a per-rule list of rubric gaps.
4. `eval` reports how often the judge agrees with your labels, and how often the AI labeller agrees with them, for each rule.
5. At least one `review-only` rule is promoted using hand labels on the holdout split, or the gate explains why it can't be.

## Approach

Three vertical slices. Each one is usable without the next.

### Slice 1: Label it yourself (talk slide 3, "Make the judgements yourself")

- Add `taste-lint eval label <samples.json> [--minutes 120]`. It is an interactive loop in `src/commands/eval.ts` built on `node:readline/promises`, with no new dependency.
  - For each sample it shows the rule `question` (instructions plus the true/false criteria and examples, as built by `src/rules/question.ts`), the target text and the context. Jev's probability stays hidden so the labelling is blind.
  - Keys: `y`, `n`, `u` (unsure), `s` (skip), `q` (quit). After each answer it takes an optional one-line note.
  - It writes to the samples file after every answer, so quitting keeps your progress. It stops when the timebox runs out.
- It reuses the existing sample file format. Unsure answers are stored as `label: null`, and there are new optional `note` and `unsure` fields.
  - `labelsToCorpus` (`src/scan/samples.ts`) already writes `hand` when there is no `annotation`. Carry `note` through to the corpus item.
- It assigns each sample to dev or holdout by hashing its source path, matching the file-family rule already enforced by `src/eval/coverage.ts`, so the promotion gate doesn't reject the split for leaking.

### Slice 2: Find likely failures first, then turn errors into rubric fixes (slide 3, steps 01 to 03)

- `lint --samples` gains `--prioritize` (on when it feeds `eval label`). It ranks sample units by the cheap signals the repo already produces:
  - The mechanical check and Jev disagree (tier `both` with split outcomes).
  - Jev's probability sits inside a rule's review band, where the judge is least sure.
  - A `taste-lint-ignore` comment already suppresses the finding (`src/reduce/suppress.ts`). This is the talk's "clinician edited the output", the user's own negative feedback.
- Add `taste-lint eval gaps`. It groups hand-labelled items by rule and prints the unsure count, the notes, and the disagreements with Jev as a checklist for editing each rule's `question.criteria` examples and `instructions` ("Can't pick a label? Back to 02 and refine the rubric.").
  - It prints to stdout only and never auto-edits YAML. You still edit the rubric.

### Slice 3: Optimise the judge until it agrees, then let it scale (slides 4 and 5)

- `runEval` (`src/eval/metrics.ts:304`) reports two agreement numbers per rule, both with Wilson intervals from `src/lib/stats.ts`:
  - **judge vs hand**
  - **AI labeller vs hand**, computed on items that have both labels
  - When AI-labeller agreement clears a floor for a rule, AI labels for that rule may feed `tune`. Below the floor, `tune` refuses them for that rule. This turns the existing warning at `metrics.ts:388` into a gate.
- `tune` and `promotion` prefer `hand` labels. Once a rule's criteria have been edited, rerun `tune ab` to prove the new wording agrees with you more (McNemar already exists). Then `tune` writes thresholds to `tuning.json`.
- Promoting a rule from `review-only` to `active` stays manual and gated by `promotionEvidence` (`src/eval/promotion.ts:14`) on hand-labelled holdout.

### Slice 4: The optimiser loop (talk slide "Optimise the judge", steps 04 to 06)

- 04: `eval --source hand --split dev` runs Jev on your labels only.
- 05: `eval --disagreements` lists every item where the judge and your label disagree at the review threshold, with the text, the label source and split, and your note. A coding agent reads that list and edits the rule's `question`. `tune ab --source hand` confirms each wording with McNemar.
- 06: you read what's left and fix wrong labels in the corpus JSONL, or the rubric.
- An edit must be a general policy, not a patch for one row. The optimiser never sees holdout, and `tune --write` promotes only on holdout.

## Status (2026-09-23)

Built: `eval label`, `eval gaps`, `eval agreement`, `eval --disagreements`, `--source` on `eval`, `tune` and `tune ab`, prioritised sample order, and `note` on corpus items. Tests are in `src/__tests__/hand-labels.test.ts`.

Changed from the draft:

- **Split.** `splitFor` already hashed the source path, so no new code was needed.
- **AI-vs-hand agreement.** It compares two labelled sample files by sample ID. The corpus can't hold both, because the hand and AI exports share IDs and `loadCorpus` rejects duplicates.
- **Tune and AI labels.** `tune` does not refuse AI labels automatically. Pass `--source hand` instead. An automatic gate would need agreement persisted per rule, which isn't justified before the first labelling session.

Not built:

- k = 3 repeated judge runs per row. The answer cache makes repeats identical. Add them only if Jev's probabilities prove unstable across runs.
- An automated optimiser such as GEPA. A coding agent working from `--disagreements` covers step 05.

## Loop order (Matthew, 2026-09-23)

This supersedes the hand-first order above. Human labelling is the last step, not the first:

1. Get it working. 2. Find failure modes. 3. Fix the judge's failure modes with AI tuning. 4. Only then optimise cost. 5. Only then speed. 6. Only then bring a human in to label. 7. Repeat.

The labelling tooling above stays; it is step 6.

### Pass 1 results

- **Get it working.** The first live `eval` sent 0 requests and got 23 errors: the shell's `AI_GATEWAY_API_KEY` is stale (HTTP 401), and the working key is in `.env.local`. The report still printed full metrics, so a judge that never ran read as a judge that never fires. `eval` now fails with the provider's auth error; `tune` and `tune ab` already exit 2 without writing or giving a verdict. A full live eval costs $0.0005.
- **Failure modes (dev, review threshold).** `generic-framing` 25 of 40 disagree and `unnatural-polish` 28 of 40, all false flags on labels, identifiers, URLs, headings and one-line instructions. Jev read "no concrete context" or "no person behind it" as a violation. `machine-prose` 7 of 12 and `reader-first` 7 of 28 are misses at exactly p = 0: the phrase gate on these `both`-tier rules never asked Jev.
- **AI fix.** Both over-firing questions now say what cannot be a violation. `tune ab` on dev: `unnatural-polish` 6 fixed, 0 broken (p = 0.041); `generic-framing` 8 fixed, 2 broken at act (p = 0.114), but both positives are still flagged at review. Holdout disagreements fell from 12 of 17 to 0 of 17. A scratch probe of 6 known-slop paragraphs relabelled as positives still flags all of them at review, with fewer at act.
- **Gate (open, a cost decision).** With `mechanical` removed from the five gated copywriting rules, `machine-prose` review-threshold disagreements fall from 7 to 2, and the other four don't change. That took 53 extra requests over the corpus. The phrase lists are hand-written, so removing the gate is Matthew's call.
- **Residue for step 6.** `unnatural-polish` has no positive labels, and `generic-framing` has 2, so recall and the act threshold can't be tuned. Some `reader-first` manifest labels look wrong (for example, "Two people edit the same file. One version wins." is labelled a violation), and some fixture rows have scaffolding such as "Pricing page, first screen" glued into the text.

## Decisions

- **Keep Jev as the judge.** The talk recommends a cheap judge such as Jev, and taste-lint already uses it. The work is calibration, not switching models.
- **Build a terminal labeller, not a voice agent or web UI.** It is the smallest thing that "walks rows with you and asks for your call". A Claude Code session can still drive it.
- **Don't retire the AI labelling scripts.** Slice 3 measures whether to trust them rule by rule instead.
- **Assumption (unverified):** you will do the first two-hour labelling session, starting with copywriting because it is the only domain with a holdout. The quality of the result depends on this.

## Boundaries

- No new rules, no model change, no web or landing-page work, no post-training. The talk's "post-train open models" is out of scope. Monitoring live traffic has no analogue here beyond `--since`.

## Verification

- Unit tests in `src/__tests__/` with an injected stdin stream and a fake evaluator, so no model calls:
  - The label loop writes `hand` items with notes.
  - `q` in the middle of a session keeps earlier answers.
  - The timebox stops the loop.
  - The split assignment is deterministic and never leaks across source families.
  - The prioritizer puts a disagreeing or in-band unit ahead of a confident one.
  - `eval gaps` groups unsure answers and notes by rule.
  - `tune` refuses AI labels for a rule below the agreement floor.
- End to end:
  - `npm run build && node dist/cli.js lint --profile writing --samples s.json --prioritize`, then `eval label s.json --minutes 5`, then `eval labels s.json`. Check that `data/corpus` gains `hand` lines.
  - `eval --rules copywriting-canned-phrasing` prints judge-vs-hand and AI-vs-hand agreement.
- Gate: `npm run verify:full` is green.

## Recovery

The only writes are appends to corpus JSONL and changes to `tuning.json`, both in git. To roll back, revert the commit.
