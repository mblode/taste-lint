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
- `src/rules/`: fail-closed rule loader and validator, taxonomy copied from taste-training `content/categories.ts`, question builder for the Jev wire format.
- `src/extract/`: units from Markdown/MDX (mdast), TSX (oxc-parser), Tailwind class lists, and style-capture output (the CLI text block or `CaptureResult` JSON). Every unit carries file, line, column and byte offsets.
- `src/map/`: plan (which rules apply to which unit), one Jev request per unit with every matching question, sha256 cache under `results/cache`, token bucket limiter, fetch client.
- `src/reduce/`: bands (act, review, silent), dedupe, scorecard, deterministic fixes.
- `src/report/`: tty, JSON, SARIF.
- `src/eval/`: corpus loader, precision/recall/Wilson, calibration table, threshold tuning, McNemar A/B.
- `data/rules/<domain>/<id>.yaml`: shipped rules. `data/rules/tuning.json`: threshold overlay written only by `tune --write`. `data/corpus/*.jsonl`: labelled units.
- `scripts/port-rules.ts`: regenerates draft rules from a sibling agent-skills checkout. `scripts/seed-corpus.ts`: seeds the corpus from taste-training manifests.

Read `docs/DESIGN.md` for contracts.

## Invariants

- Use `.js` extensions in TypeScript imports. Only the CLI entry gets a shebang.
- No model calls in tests or CI. Inject `evaluate` through `ctx`; the fetch client is exercised only against a fake server.
- Never persist raw provider responses or error bodies. Record `provider_error`, `invalid_response` or `timeout` with the HTTP status only.
- Results and cache write to ignored `results/`.
- Severity says how bad a finding is if real. The Jev probability says how sure. Never move one to express the other.
- Abstain is not fail: a rule whose precondition or value is unresolved reports `unknown` with a reason.
- Jev cannot count, do arithmetic, compare dates or read hex colours. Those checks are mechanical; Jev only sees text.
- No em dashes anywhere, including rule YAML, generated SARIF and commit messages.
