---
name: taste-lint
description: >-
  Runs the taste-lint taste linter (copywriting, typography, interaction and motion rules answered by TypeSafe Jev probabilities plus mechanical checks) and reads its findings, bands and scorecard. Use when asked to "run taste-lint", "lint the copy", "check the typography in these components", "is this finding a blocker", or to measure how a rewrite moved the scorecard. For rewriting the words use docs-writing or ui-design; for a full type system review use typography-audit.
---

# taste-lint

Is: the operator's guide to `taste-lint`, an npm CLI that turns copywriting, typography, interaction and motion rules from `mblode/agent-skills` and `mblode/taste-training` into checks over Markdown, MDX, TSX and rendered pages. Mechanical where a regex or a real value decides; a calibrated probability from TypeSafe Jev where a judgement is needed.

Is not: the rules themselves (they ship inside the package and trace back to the skill or lesson they came from), a copy rewriter (`docs-writing`, `ui-design`), or a replacement for the `typography-audit` and `ui-design` audits.

## Commands

`taste-lint schema` prints every command, flag and default as JSON; `--help` is the human form. The ones the workflow turns on:

| Command | Use |
| --- | --- |
| `taste-lint lint --profile product --dry-run` | Every mechanical check, no key, no calls. Act findings already fail here. Always first. |
| `taste-lint lint --profile product` | The run with Jev review notes. Needs the user’s `AI_GATEWAY_API_KEY` (Vercel AI Gateway). Results land in `results/lint-<timestamp>.json`; answers are cached under `results/cache`, so a rerun over unchanged files costs nothing. |
| `taste-lint lint --since origin/main --output sarif` | Only findings on changed lines, for code review tools. |
| `taste-lint lint <paths> --output json` | For scripts: findings, scorecard and usage on stdout, and an error as a `{ error, code, message }` envelope instead of text. `--output sarif` for code scanning. |
| `taste-lint lint --url <url>` | Computed styles through style-capture and a local Chromium; `--capture file.json` lints a saved capture. |
| `taste-lint eval` and `taste-lint tune` | Precision, recall and calibration per rule on the labelled corpus; `tune --write` is the only thing that promotes a rule. |

Node 24. Jev input costs $0.042 per million tokens and output is free; the summary line prints the actual cost after every run.

## Reading a finding

Every finding carries two independent facts. **Severity** (`major`, `minor`) says how bad it is if real and comes from the rule. **Band** says how sure the tool is: `act` (a mechanical hit, or Jev at or above the rule's act threshold; fails the run), `review` (between the review and act thresholds, or any hit from a `review-only` rule; printed with a `?`, never fails the run), and silent. A `[MAJOR?]` is a major if it is real and the run did not fail on it; say both halves and never lower the severity to express the doubt, which the band already carries.

`unknown` is a third outcome, not a pass: a rule could not decide because a value was unresolved (a Tailwind theme token, a missing class list) or a precondition was unmet. `--verbose` lists them.

## Workflow

Done means: the touched files re-linted with no act-band findings left that you have not either fixed or explained, and a summary that quotes units, act, review, unknown and cost from the last run plus the scorecard delta by category.

Linting reads files and writes only under `results/`, and a whole repository costs cents, so run `--dry-run` and the lint without asking. `--fix` rewrites the prose ranges of act-band findings in the working tree (curly quotes, ellipses, multiplication signs, unit spaces) and nothing else; run it, then show the diff.

1. `--dry-run`; quote the request count and cost.
2. Run the lint. Fix `act` findings in the copy or the classes, not by editing the rule.
3. Re-run only the files you touched; cached answers make the rest free.
4. A wrong finding is corpus evidence: add the unit to the corpus with the correct label rather than lowering a threshold by hand; `tune` decides thresholds.

## Gotchas

- Projects that curl quotes at build time (remark-smartypants in `next.config.*`) are detected; the straight-quote rule then skips Markdown and still checks JSX. Force it either way with `"smartQuotesAtBuild"` in `taste-lint.config.json`.
- Deliberately bad copy (course stimuli, `Incorrect` examples, sample text) is corpus, not a lint target. Exclude it with `--exclude` or the config file, or suppress one unit with `taste-lint-ignore: <rule-id>` on the line above; `ui-audit-ignore:<id>` from `ui-design` is honoured for ported rules.
- Most of the pack is `review-only` (ported patterns until someone has watched them on a real codebase, Jev rules until `tune --write` promotes them). The report counts those notes by rule and lists them only with `--verbose`. Read the act band first; treat the notes as a reading list, not a backlog.
- Class-list rules see only static Tailwind classes. Theme tokens, template expressions and computed values are `unknown` until you run `--url`.
- Never paste a raw provider response or error body into an issue or a summary; the tool records categories and token counts only, and so should you.

## Docs

https://blode.co/taste-lint/docs

## Related skills

From `mblode/agent-skills`: `docs-writing` and `ui-design` own the wording of a fix; `typography-audit` is the type review this tool's typography pack is harvested from; `ui-design` and `ui-animation` supply the interaction, craft and motion checks.

Maintenance only: `evals/evals.json` holds the behavioural scenarios and routing prompts for anyone changing this skill. It never loads during a user task.
