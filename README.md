<div align="center">

# [taste-lint](https://github.com/mblode/taste-lint)

**Taste rules from [Agent Skills](https://github.com/mblode/agent-skills) and [Taste Training](https://blode.co/taste-training), run as a linter**

Point it at Markdown, MDX, TSX or a rendered page and get findings with a severity and a probability.

</div>

[npm](https://www.npmjs.com/package/taste-lint) · [Changelog](CHANGELOG.md) · [MIT license](LICENSE.md)

## Quickstart

Requires Node 24.11 or later. Bring your own [Vercel AI Gateway API key](https://vercel.com/docs/ai-gateway/authentication-and-byok/api-keys): open **AI Gateway → API Keys → Create Key** in your Vercel dashboard.

```bash
npm install -g taste-lint
export AI_GATEWAY_API_KEY="your-vercel-ai-gateway-key"

# Run from your project directory
taste-lint scan .
```

No taste-lint account or configuration file is required. Model usage is billed to your Vercel AI Gateway account. Taste-lint reads the key from your environment and sends selected text and rule context directly to the gateway.

Preview scope and estimated cost with `taste-lint scan . --dry-run`. Try local checks without a key using `taste-lint scan . --mechanical-only`. The default scan focuses on product interfaces; use `--profile writing` for documentation or `--profile instructions` for agent instructions.

Semantic rules remain advisory until calibrated against independent holdout evidence. Mechanical checks can fail a run immediately.

## Where the rules come from

[Agent Skills](https://github.com/mblode/agent-skills) provides reusable instructions for coding agents. [Taste Training](https://blode.co/taste-training) teaches people to spot and fix problems in typography, copy, interaction, and motion. Taste-lint turns applicable guidance into repeatable checks, with source references attached to individual rules.

## Example findings

```text
PASS: 161 active rules in data/rules

notes.md
[MINOR] typography-straight-quotes (p=1.00) notes.md:3:1
    Straight quotes in rendered copy
    2 matches: "'", "'"
    Fix: Replace with the matching curly mark. Opening after whitespace or at the start, closing otherwise; an apostrophe is always the right single quote.
[MINOR?] copywriting-claim-without-evidence (p=0.95) notes.md:3:1
    Quality claimed, nothing the reader could check
    3 matches: "fast", "powerful", "seamless"; p=0.95
    Fix: Replace the adjective with the mechanism, the number or the standard it stands for. If none exists, cut the sentence.

Units: 3  |  Rules: 161  |  Act: 1  |  Review: 4  |  Unknown: 0
Jev: 2 requests, 0 cached answers, 7238 input tokens, $0.0003
FAIL - 1 finding in the act band
```

## Two answers per finding

- **Severity:** how bad the finding is if real, `major` or `minor`. Set by the rule, never by the model.
- **Band:** how sure the tool is. `act` fails the run (mechanical hits, or Jev at or above the rule's act threshold), `review` prints a note with a `?`, below that is silent.
- **Cost:** eligible questions about one unit are batched into requests. Preview estimated cost with `--dry-run`; runs report usage and reuse cached answers. Current rates are listed in the [Vercel AI Gateway model catalog](https://vercel.com/ai-gateway/models).

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

`taste-lint eval` scores every rule against its labelled corpus (precision, recall, Wilson intervals, a calibration table) and `taste-lint tune` picks act thresholds from the dev split, promoting a rule only when the fixed threshold also clears the precision lower bound on an independent holdout. Both label classes, enough evaluated items, complete scoring, and source/text separation are required. `taste-lint eval coverage` reports class balance and split leakage without API calls; add `--output json` to coverage or evaluation for structured results.

## License

[MIT](LICENSE.md) © 2026 Matthew Blode.

## Reading a repository run

The default text report summarizes scope, top rules and up to 30 examples. Use `--verbose` for the full list; every completed or incomplete run also saves a complete JSON report and prints its path. JSON v1 keeps the original grouped `findings`; `ruleFindings` preserves every rule's evidence and `coverage` counts eligible checks. `summary.failing` respects `--fail-on`, and determines the exit code together with run completeness.

```bash
taste-lint lint --root ../my-site apps/web --dry-run
taste-lint lint --root ../my-site apps/web --progress --output json > audit.json
```

Progress goes to stderr. A fully cached run needs no API key. An incomplete report includes a retry command that reuses successful answers. Cost is reported from known usage, excluding any unreported provider billing for failures.

Configuration is optional at `taste-lint.config.json` in the scan root. Its editor schema ships at `node_modules/taste-lint/data/config.schema.json`. Unknown fields and invalid types fail before evaluation. Select the scope explicitly: documentation and agent instructions remain included when you request a whole repository.

```json
{
  "$schema": "./node_modules/taste-lint/data/config.schema.json",
  "exclude": ["docs/archive/**"],
  "docTypes": [
    { "glob": "apps/web/content/writing/**/*.mdx", "type": "explanation" }
  ]
}
```

See [TypeSafe contracts](docs/TYPESAFE.md) and the [review-rule evaluation](docs/evaluations/blode-co-review.md) for the implementation evidence and current calibration limits.

See [skill packs](docs/SKILL-PACKS.md) for repository checks, architecture policy, personal-writing context, and source discovery.

Use `taste-lint scan . --profile product --dry-run` to preview a focused scan. The [scan workflow](docs/SCANS.md) covers profiles, baselines, review decisions, changed-code SARIF, calibration samples, graph-tool reports, and remediation exports.
