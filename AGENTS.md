# slop-cop

Node 24 TypeScript ESM CLI. A taste linter: copy, typography, interaction and motion rules from `mblode/agent-skills` and `mblode/taste-training`, answered as calibrated probabilities by TypeSafe Jev where a judgement is needed and by a regex or a resolved value where one decides.

## Commands

```bash
npm ci
npm run check && npm run typecheck                 # edit loop
npx vitest run src/__tests__/rules.test.ts --reporter=dot   # one suite, quiet
npm run verify                                     # lint, types, tests, build, packed smoke test
npm run verify:full                                # verify plus rules check; CI runs this and port-rules --check
npm run fix                                        # ultracite autofix; scope it when unrelated changes exist
node dist/cli.js lint <paths> --dry-run            # units, requests, estimated cost; no calls
node dist/cli.js lint <paths> --mechanical-only    # no key needed
node dist/cli.js rules check                       # validate data/rules
node dist/cli.js schema                            # every command, flag and default as JSON
npm run port-rules -- --skills-dir ../agent-skills --check   # every ported rule still matches its source
```

## Setup facts

- Live Jev calls need `TYPESAFE_API_KEY` (api.typesafe.ai) or `AI_GATEWAY_API_KEY` (Vercel AI Gateway); the first wins when both are set. `--dry-run` and `--mechanical-only` need neither. Tests never call a model: vitest replaces `fetch`, and the fetch client is exercised only against a fake.
- `scripts/*.ts` run with `node --experimental-strip-types` (the npm scripts do this). Node 22 runs the build and tests but not `fs.globSync` edge cases the package relies on; use Node 24 for anything you will report.
- `port-rules --check` and the taste-training baseline expect sibling checkouts at `../agent-skills` and `../taste-training`. The baseline command and its expected counts are in the review log of `docs/plans/slop-cop-taste-linter.md`.
- Releases: `npm run changeset` with every user-facing change; on `main` the Release workflow opens a Version Packages PR and publishes over npm OIDC when it merges. The first publish is manual (`npm publish` once, then register the workflow as the package's trusted publisher on npmjs.com); until then the workflow fails with E404.
- Results and the answer cache write to `results/` (ignored). A rerun over unchanged files reports `0 requests`; delete `results/cache` to force live answers.

## Gotchas

- `npm run fix` can change semantics: it unescapes `U+2014` into a literal em dash (which the house test then rejects) and turns `split("")` into a spread over code points. Build such strings with `String.fromCodePoint` and index UTF-16 with a loop.
- `slop-cop rules check` prints `N active rules`; active means not draft. Most of the pack is `review-only` on purpose: pattern ports until someone has watched them on a real codebase, Jev rules until `tune --write` promotes them on labelled data. A `review-only` rule never fails a run.
- `slop-cop lint --dry-run` exits 1 on any act-band mechanical finding, so the fixtures (deliberate straight quotes) fail it by design; their counts are asserted in `src/__tests__/lint.test.ts`.
- `slop-cop eval` without `--include-weak` skips every item whose category maps to more than one rule, which today is every typography rule.
- `port-rules --check` compares only `source` and, when not hand-written, `mechanical`; it does not notice a changed hint or severity. `--write` regenerates every unshipped source rule as a draft under `data/rule-drafts/`; prune before committing.
- A rule that counts, compares or measures is a code rule in `src/rules/code/`, not YAML: Jev cannot count, do arithmetic, compare dates or read hex colours.
- A YAML rule writes only what cannot be derived. The loader fills `tier`, `domain` and `scope.include` (see `docs/DESIGN.md`); writing them is a validation error.

## Adding a rule

1. YAML under `data/rules/<domain>/<id>.yaml` with `id` equal to the filename: `id`, `title`, `categoryId`, `source`, `unit`, then `mechanical` (regex, phrases, `absent`) or `question` or both, `severity`, `fix.hint`, `status`. A `source` rule also names `scope.include`. Look at `data/rules/copywriting/copywriting-canned-phrasing.yaml` (both) and `data/rules/interaction/interaction-no-error-state.yaml` (source).
2. Anything that counts or measures: a `codeRule` in `src/rules/code/typography.ts` or `classes.ts`, with a unit test through `check(id)` from `src/__tests__/helpers.ts`.
3. `node dist/cli.js rules check`, then `npm run verify:full`. A Jev-backed rule ships `review-only`; only `tune --write` promotes it.

## Invariants

- Use `.js` extensions in TypeScript imports. Only the CLI entry gets a shebang.
- Never persist raw provider responses or error bodies. Record `provider_error`, `invalid_response` or `timeout` with the HTTP status only.
- Severity says how bad a finding is if real. The Jev probability says how sure. Never move one to express the other.
- Abstain is not fail: a rule whose precondition or value is unresolved reports `unknown` with a reason.
- No em dashes anywhere: source, rule YAML, docs, SARIF, commit messages. The house test scans for them.

## Contracts

`docs/DESIGN.md`: the rule, unit, request and finding contracts, the pipeline map, the glossary.
