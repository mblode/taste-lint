# taste-lint

npm workspace and Turborepo: a Node 24 TypeScript ESM CLI in `packages/cli` and a Next.js landing page in `apps/web`. CLI source and rules live in root `src/` and `data/`. A taste linter: copy, typography, interaction and motion rules from `mblode/agent-skills` and `mblode/taste-training`. A regex or a measured value decides where one can; TypeSafe Jev answers with a probability where a judgement is needed.

## Commands

```bash
npm ci
npm run build:cli                                  # only the published CLI
npm run check && npm run typecheck                 # edit loop
npx vitest run src/__tests__/rules.test.ts --reporter=dot   # one suite, quiet
npm run taste                                      # lint this repo with its own rules; CI runs it
npm run verify                                     # lint, types, tests, build, packed smoke test
npm run verify:full                                # verify:cli plus verify:web; CI runs the two as parallel jobs, plus port-rules --check
npm run verify:cli                                 # check, CLI build, types, tests, packed smoke test, rules check, taste
npm run verify:web                                 # Next build, web types, web tests
npm run fix                                        # ultracite autofix; scope it when unrelated changes exist
node dist/cli.js lint --profile product --dry-run  # units, requests, estimated cost; no calls
node dist/cli.js rules check                       # validate data/rules
node dist/cli.js schema                            # every command, flag and default as JSON
npm run port-rules -- --skills-dir ../agent-skills --check   # every ported rule still matches its source
```

## Setup facts

- `lint` is the one user-facing command. `--profile` scopes files and rule domains (`product`, `writing`, `instructions`, `code`, `all`) and never changes a rule’s status. `--since <ref>` reports only changed lines.
- Mechanical rules run without a key. Uncached Jev work needs `AI_GATEWAY_API_KEY` (legacy `TYPESAFE_API_KEY` still works). `--dry-run` plans without calls. Tests inject fake evaluators and never call a model.
- `scripts/*.ts` run with `node --experimental-strip-types`. Use Node 24 for anything you will report.
- `port-rules --check` expects a sibling checkout at `../agent-skills`.
- Releases: `npm run changeset` with every user-facing change. On `main` the Release workflow opens a Version Packages PR and publishes over npm OIDC when it merges.
- Results and the answer cache write to `results/` (ignored). A rerun over unchanged files reports `0 requests`; delete `results/cache` to force live answers.
- Public docs are the MDX files in `docs/`, published at https://blode.co/taste-lint/docs. There are no hidden copies.

## Gotchas

- `npm run fix` can change semantics: it unescapes `U+2014` into a literal em dash (which the house test rejects) and turns `split("")` into a spread over code points.
- `rules check` prints `N active rules`; active means not draft. Most of the pack is `review-only` on purpose. A `review-only` rule never fails a run, and the tty report only counts its findings unless `--verbose`.
- `lint --dry-run` exits 1 on any act-band mechanical finding, so the fixtures (deliberate straight quotes) fail it by design. Their counts are asserted in `src/__tests__/lint.test.ts`.
- `eval` without `--include-weak` skips every item whose category maps to more than one rule.
- `port-rules --check` compares only `source` and, when not hand-written, `mechanical`. `--write` regenerates every unshipped source rule as a draft under `data/rule-drafts/`; prune before committing.
- A rule that counts, compares or measures is a code rule in `src/rules/code/`, not YAML. Jev cannot count, do arithmetic, compare dates or read hex colours.
- A YAML rule writes only what cannot be derived. The loader fills `tier`, `domain` and `scope.include`; writing them is a validation error.

## Adding a rule

1. YAML under `data/rules/<domain>/<id>.yaml` with `id` equal to the filename: `id`, `title`, `categoryId`, `source`, `unit`, then `mechanical` (regex, phrases, `absent`) or `question` or both, `severity`, `fix.hint`, `status`. A `source` rule also names `scope.include`. See `data/rules/copywriting/copywriting-canned-phrasing.yaml` (both) and `data/rules/interaction/interaction-no-error-state.yaml` (source).
2. Anything that counts or measures: a `codeRule` in `src/rules/code/typography.ts` or `classes.ts`, with a unit test through `check(id)` from `src/__tests__/helpers.ts`.
3. `node dist/cli.js rules check`, then `npm run verify:full`. A Jev-backed rule ships `review-only`; only `tune --write` promotes it.

## Promoting a rule

Rule count is not the metric. Precision on real repositories is. Work the loop in this order and repeat; do not skip ahead:

1. Get it working: `eval` runs live with `Jev: N requests` and no errors. A rejected key fails the run; the working key is in `.env.local`.
2. Find failure modes: `eval --only <rule> --split dev --disagreements`. Group the rows by cause (the judge never asked, the rubric reads plain text as a violation, the label is wrong) before touching anything.
3. Fix the judge's failure modes with AI: an agent rewrites the question from dev disagreements, confirmed with `tune ab` and then a holdout `eval`. Every edit is general policy, never a patch for one row. Never edit from holdout disagreements.
4. Only then optimise cost (gates, preconditions, batching), then speed.
5. Only then ask Matthew to label the residue: rows the AI loop could not settle, suspect labels, and rules with no positives. Export them with `lint --samples`, label with `eval label`, turn unsure answers into rubric edits with `eval gaps`, and trust an agent labeller for a rule only after `eval agreement` clears the floor.

A wrong finding is corpus evidence: add the unit with the correct label instead of lowering a threshold by hand.

## Invariants

- Use `.js` extensions in TypeScript imports. Only the CLI entry gets a shebang.
- Never persist raw provider responses or error bodies. Record `provider_error`, `invalid_response` or `timeout` with the HTTP status only.
- Severity says how bad a finding is if real. The Jev probability says how sure. Never move one to express the other.
- Abstain is not fail: a rule whose precondition or value is unresolved reports `unknown` with a reason.
- No em dashes anywhere: source, rule YAML, docs, SARIF, commit messages. The house test scans for them.
- The repo passes its own lint. `npm run taste` runs in CI and in the pre-commit hook; fix the copy, not the rule.

## Contracts

`docs/design.mdx` (https://blode.co/taste-lint/docs/design): the rule, unit, request and finding contracts, the pipeline map, the glossary. `docs/typesafe.mdx`: the Jev integration. Use the installed `.agents/skills/typesafe-ai/SKILL.md` when working on Jev, and read the live TypeSafe docs before changing questions, state or confidence handling.

CI layout: a new CLI check goes in `verify:cli`, a new web check in `verify:web`, never straight into `verify:full`, or CI skips it. The web build is CPU-bound and sets the run's length; timings and the next levers are in `docs/audits/ci-speed.md`.
