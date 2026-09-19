# slop-cop

Node >=24 TypeScript ESM CLI. A taste linter: copy and typography rules from `mblode/agent-skills` and `mblode/taste-training` answered as calibrated probabilities by TypeSafe Jev, with mechanical checks where a regex or real value decides.

## Commands

```bash
npm ci
npm run verify       # lint, types, tests, build, offline packed-artifact smoke test
npm run dev          # tsdown watch
npm run check        # lint/format check
npm run fix          # lint/format autofix; scope when unrelated changes exist
node dist/cli.js lint <paths> --dry-run          # units, requests, estimated cost; no calls
node dist/cli.js lint <paths> --mechanical-only  # no key needed
node dist/cli.js rules check                     # validate data/rules
```

## Architecture

- `src/cli.ts`: Commander entry point. Explicit flags win over environment defaults.
- `src/rules/`: fail-closed rule loader and validator, taxonomy copied from taste-training `content/categories.ts`, question builder for the Jev wire format. `src/rules/code/`: rules that count, compare or measure, written as `Rule` objects with a `check` attached (`typography.ts`, `classes.ts`); `loadRules` returns them beside the YAML rules, under the same tuning overlay.
- `src/extract/`: units from Markdown/MDX (mdast), TSX (oxc-parser), Tailwind class lists, style-capture output (the CLI text block or `CaptureResult` JSON), and one `source` unit per TSX, JSX or CSS file for mechanical rules that pattern-match raw markup. Every unit carries file, line, column, UTF-16 source offsets and, where a fix may rewrite it, the prose ranges inside that slice.
- `src/map/`: plan (which rules apply to which unit), `judge.ts` (the one stage lint and eval share: plan, run checks, answer questions from cache or live, report abstentions), one Jev request per unit with every matching question, sha256 cache under `results/cache`, token bucket limiter, fetch client.
- `src/reduce/`: bands (act, review, silent), dedupe, scorecard, deterministic fixes, and `mechanical.ts` (regex and phrase matching for data rules plus the helpers code rules share).
- `src/report/`: tty, JSON, SARIF.
- `src/eval/`: corpus loader, precision/recall/Wilson, calibration table, threshold tuning, McNemar A/B.
- `data/rules/<domain>/<id>.yaml`: shipped rules. `data/rules/tuning.json`: threshold overlay written only by `tune --write`. `data/corpus/*.jsonl`: labelled units. `data/rule-drafts/`: source rules the port script could not ship (a shell pipeline, PCRE-only syntax, a rendered check, or a question nobody has written); never loaded.
- `scripts/port-rules.ts`: `--write` ships ui-design static checks as whole-file mechanical rules and writes everything else as drafts; `--check` verifies every shipped rule against its source. `scripts/seed-corpus.ts`: seeds the corpus from taste-training manifests.

Read `docs/DESIGN.md` for contracts.

## Verification tiers

| Tier | Command | Runs when |
| --- | --- | --- |
| check | `npm run check && npm run typecheck` | during an edit loop |
| verify | `npm run verify` | before a commit (lint, types, tests, build, packed smoke test) |
| verify:full | `npm run verify:full` | before a push; CI runs exactly this plus `port-rules --check`, and on pull requests `changeset status` once `origin/main` exists |

Commands that pass while proving less than they look:

- `slop-cop rules check` prints `N active rules`; active here means not draft. A Jev-backed rule can be `review-only` and still count, and so can every ported pattern rule: today most of the pack is review-only by design.
- `slop-cop lint --dry-run` exits 1 on any act-band mechanical finding. `verify:full` runs it with `--fail-on critical` so the fixtures, which contain deliberate straight quotes, do not fail the umbrella. No shipped rule is critical, so that step only proves the CLI runs end to end; the fixture finding counts are asserted in `src/__tests__/lint.test.ts`.
- `slop-cop eval` without `--include-weak` skips every item whose category maps to more than one rule, which today is every typography rule.

## Invariants

- Use `.js` extensions in TypeScript imports. Only the CLI entry gets a shebang.
- No model calls in tests or CI. Inject `evaluate` through `ctx`; the fetch client is exercised only against a fake server.
- Never persist raw provider responses or error bodies. Record `provider_error`, `invalid_response` or `timeout` with the HTTP status only.
- Results and cache write to ignored `results/`.
- Severity says how bad a finding is if real. The Jev probability says how sure. Never move one to express the other.
- Abstain is not fail: a rule whose precondition or value is unresolved reports `unknown` with a reason.
- Jev cannot count, do arithmetic, compare dates or read hex colours. Those checks are mechanical; Jev only sees text.
- No em dashes anywhere, including rule YAML, generated SARIF and commit messages.
