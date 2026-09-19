<div align="center">

# [taste-lint](https://github.com/mblode/taste-lint)

**Taste rules from agent-skills and taste-training, run as a linter on every file**

Point it at Markdown, MDX, TSX or a rendered page and get findings with a severity and a probability.

</div>

## Install

```bash
npm install -g taste-lint
```

Requires Node 24. Jev-backed rules need `TYPESAFE_API_KEY` (api.typesafe.ai) or `AI_GATEWAY_API_KEY` (Vercel AI Gateway); mechanical rules need neither.

## Quickstart

```bash
# Every rule the pack ships, validated
taste-lint rules check

# Lint a file; Jev answers each question in one request per unit
AI_GATEWAY_API_KEY=... taste-lint lint notes.md
```

```text
PASS: 118 active rules in data/rules

notes.md
[MINOR] typography-straight-quotes (p=1.00) notes.md:3:1
    Straight quotes in rendered copy
    2 matches: "'", "'"
    Fix: Replace with the matching curly mark. Opening after whitespace or at the start, closing otherwise; an apostrophe is always the right single quote.
[MINOR?] copywriting-claim-without-evidence (p=0.95) notes.md:3:1
    Quality claimed, nothing the reader could check
    3 matches: "fast", "powerful", "seamless"; p=0.95
    Fix: Replace the adjective with the mechanism, the number or the standard it stands for. If none exists, cut the sentence.

Units: 3  |  Rules: 118  |  Act: 1  |  Review: 4  |  Unknown: 0
Jev: 2 requests, 0 cached answers, 7238 input tokens, $0.0003
FAIL - 1 finding in the act band
```

## Two answers per finding

- **Severity:** how bad the finding is if real, `major` or `minor`. Set by the rule, never by the model.
- **Band:** how sure the tool is. `act` fails the run (mechanical hits, or Jev at or above the rule's act threshold), `review` prints a note with a `?`, below that is silent.
- **Cost:** every question about one unit travels in one request; Jev output is free and input is $0.042 per million tokens. Answers are cached by question and text, so a second run over unchanged files costs nothing.

## Rule packs

- **Typography:** straight quotes, dashes, ellipses, primes and units from `typography-audit`, plus size, weight, tracking and line-height checks over resolved Tailwind classes or computed styles.
- **Copywriting:** claims without evidence, vague errors, friction CTAs, hedges and register shifts from `docs-writing` and the ui-design copy guideline, and Every's published AI-tell checker: 19 of its 21 questions, one rule each, with phrase candidates from the MIT `cw-ai-check` skill where it has them. Not ported: `uniform_cadence` (sentence-length arithmetic) and `formatting_overuse` (needs headings and bullets a paragraph never sees). The two authorship verdicts are excluded on purpose: taste-lint reports defects, not authorship.
- **Interaction and craft:** the static checks of `ui-design/rules` as whole-file patterns (focus traps, error and empty states, target size, i18n, lazy loading) plus the shadcn/lint class hygiene rules (raw palette colours, arbitrary values, interpolated class strings).
- **Motion and product:** the `ui-animation` flag-on-sight table (ease-in, linear easing, transitions over 300ms, `transition-all`, entrances from scale zero, no reduced-motion variant) and the two deterministic `product-design` rules.

Every rule names the file and line of the skill or lesson it came from, and `taste-lint rules list` prints tier, status and category per rule.

## Rendered mode

```bash
taste-lint lint --url https://example.com/pricing --selector main
```

Runs [style-capture](https://www.npmjs.com/package/style-capture) in headless Chromium and lints computed styles: real pixel sizes, line heights, weights and letter-spacing, so the typography rules judge what the reader sees rather than what the class list implies. `--capture file.json` lints a saved capture.

## API

```typescript
import { runLint } from "taste-lint";

const result = await runLint({ root: process.cwd(), targets: ["content"] });
console.log(result.scorecard.byDomain, result.usage.costUsd);
```

`runLint` takes the same options as the `lint` command and returns findings, unknowns, the scorecard and usage. `taste-lint schema` prints every command, flag and default as JSON, and `--output json` turns an error into a `{ error, code, message }` envelope on stdout.

## Agent skill

```bash
npx skills add mblode/taste-lint
```

Installs the `taste-lint` skill for Claude Code, Codex, Cursor and OpenCode: how to read a finding, the dry-run-first workflow, and the gotchas. Source: [skills/taste-lint/SKILL.md](skills/taste-lint/SKILL.md).

## Options

| Flag | Default | Description |
| --- | --- | --- |
| `--dry-run` |  | Plan and print units, requests and estimated cost without calling Jev |
| `--mechanical-only` |  | Skip every Jev-backed rule; no key needed |
| `--only <ids>` |  | Comma-separated rule ids |
| `--exclude <globs>` |  | Comma-separated globs to skip, added to `taste-lint.config.json` |
| `--fail-on <severity>` | `minor` | Lowest severity that fails the run |
| `--fix` |  | Apply deterministic fixes (curly quotes, ellipsis, multiplication sign, unit spaces) to act-band findings |
| `--output <format>` | `tty` | `tty`, `json` or `sarif` |
| `--url <url>` |  | Lint a rendered page through style-capture |

`taste-lint eval` scores every rule against its labelled corpus (precision, recall, Wilson intervals, a calibration table) and `taste-lint tune` picks act thresholds from the dev split, promoting a rule only when its precision lower bound clears the floor.

## License

MIT
