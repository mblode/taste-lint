# slop-cop: taste as a linter

Authoritative plan for this repository. The session plan file it was reviewed from lives outside the checkout and is not available to CI or other sessions; this copy wins where they differ.

## Outcome

Problem: the copywriting and typography rules in `mblode/agent-skills` and `mblode/taste-training` are prose, so they are applied only when a person or an agent remembers to read them. Intended behaviour: `slop-cop lint <paths>` runs every rule over Markdown, MDX, TSX and rendered pages; a regex or a real value decides where one can, and TypeSafe Jev returns a calibrated probability where a judgement is needed. Findings carry a severity (how bad if real) and a band (how sure) and never move one to express the other.

Acceptance criteria:

1. `npm run verify:full` passes: lint, types, 40 tests with no network, build, packed-artifact smoke test, `rules check`, fixture dry run.
2. `slop-cop lint --dry-run` on taste-training (stimuli excluded) reports units, requests and estimated cost without a key. Observed: 1,404 units, 92 requests, about $0.0015.
3. `slop-cop lint --url http://127.0.0.1:8765/ --selector main --dry-run` against a served page produces `element` units with computed styles and fires the rendered-value rules. Observed on the fixture page: body below 15px and uppercase without tracking, plus one hierarchy request.
4. Every Jev-backed rule ships `review-only`; `slop-cop tune --write` promotes a rule to `active` only when its act-band precision lower bound clears the floor on the dev split. Enforced by `src/__tests__/house.test.ts`.
5. Every rule names the agent-skills or taste-training file and line it came from, and `npm run port-rules -- --check` fails when that source drifts.

## Approach

One npm package, Node 24 ESM, mirroring `mblode/agent-evals` conventions (tsdown, vitest, oxlint via ultracite, lefthook, changesets). The pipeline is `extract` (units) then `plan` (which rules apply, mechanical candidates) then `batch` (one Jev request per unit, cache, limiter) then `reduce` (bands, dedupe, suppression, scorecard) then `report` (tty, JSON, SARIF). Module contracts are in `docs/DESIGN.md`; folder roles are in `AGENTS.md`.

Files that carry the contracts: `src/types.ts` (Rule, Unit, Finding, wire format), `src/rules/validate.ts` (fail-closed rule validation, registry checks), `src/map/jev.ts` (the only place that speaks to the provider), `src/reduce/mechanical.ts` (every number lives here; Jev only sees text), `data/rules/<domain>/<id>.yaml` (38 rules), `data/rules/tuning.json` (threshold and status overlay written by `tune --write`).

## Decisions

| Decision | Evidence | Status |
| --- | --- | --- |
| Home is a new package, not an agent-evals command | agent-evals `docs/DESIGN.md:35`, `docs/PLAN.md:3` and `README.md:68` say it is not a judge; its types are keyed to skills | verified |
| No `@typesafe-ai/sdk` dependency | 0.6.0 pre-1.0; retry, rate limit, cache and error scrubbing are needed anyway; `src/map/jev.ts` is the one-file swap point | verified |
| Jev-backed rules start `review-only` | zero strong corpus labels for typography rules and 4 to 28 for copy rules (`data/corpus/*.jsonl`); the plan required at least 10 labelled items before `active` | verified, enforced |
| Rendered mode parses the style-capture CLI text block | the CLI has `--mode` only, no JSON flag; `css_capture` is one `selector{...}` block per element in document order | verified live against a local page |
| `fix.mode: llm` is a hint, not an executor | nothing in `src/` spawns a model; the hint prints under the finding for an agent to act on | deviation from the session plan, recorded |
| Punctuation and long-sentence rules skip `agent-instructions` doc types | agent-skills dry run: 1,643 straight-quote findings in SKILL.md files, which are not rendered copy | verified |
| Tests never reach the network | `src/__tests__/setup.ts` replaces `globalThis.fetch`; proven to fail a test that calls it | enforced |

Unverified: Jev's answer quality on these questions. No `TYPESAFE_API_KEY` was available during construction, so no live request has been made. Every `eval`, `tune` and live `lint` claim in the session plan is untested.

## Boundaries

Not in this repository: the wording of a fix (`copywriting` skill), the 78-rule typography review (`typography-audit`), UI audits (`ui-design`). Not in v1: `choice` and `score` primitives, Tailwind `@theme` parsing, a composite taste score, Vercel AI Gateway transport, an LLM fix executor. The port script generates drafts only with `--write-drafts`; the shipped pack is curated.

## Verification

| Criterion | Command | Expected |
| --- | --- | --- |
| 1 | `npm run verify:full` | exit 0; `Tests 40 passed`; `Packed artifact passed`; `PASS: 38 active rules` |
| 2 | `node dist/cli.js lint apps/web --root ../taste-training --dry-run --exclude "**/content/judgements/**,**/content/exercises/**,**/components/demos/**"` | `No calls were made`; a request count and cost line |
| 3 | serve `src/__tests__/fixtures` equivalent page, then `node dist/cli.js lint --url http://127.0.0.1:8765/ --selector main --dry-run` | `rendered:` findings for body-below-15px and uppercase-without-tracking |
| 4 | edit one Jev rule to `status: active`, run `npx vitest run src/__tests__/house.test.ts` | the review-only test fails naming the rule; revert passes |
| 5 | `npm run port-rules -- --skills-dir ../agent-skills --check` | `0 rule files drifted from the source` |
| Live (needs key) | `TYPESAFE_API_KEY=... node dist/cli.js lint apps/web --root ../taste-training --limit-units 50 --output json` then rerun | second run reports `cached` equal to the first run's request count and zero requests |
| Live (needs key) | `TYPESAFE_API_KEY=... node dist/cli.js eval --include-weak` then `tune` (no `--write`) | a calibration table per rule; tune proposes thresholds or demotions |

Expected failure behaviour: a missing key with Jev jobs pending exits 1 with `Set TYPESAFE_API_KEY`; an invalid rule aborts before any request; a provider error marks the run `INCOMPLETE` and exits 2 with no response body in `results/`.

## Recovery

No migrations or irreversible writes. `--fix` edits source files in place for deterministic rules only; run it on a clean working tree so `git checkout -- <file>` reverts it. `results/` is disposable; `results/cache` can be deleted at any time and only costs a re-run. `data/rules/tuning.json` is regenerated by `tune --write`; restore it from git to roll back a threshold change.

## STOP conditions

Stop and report instead of continuing if any of these is false when you check it:

- `node --version` starts with `v24` (engines `>=24`; `fs.globSync` and script type stripping need it).
- `POST https://api.typesafe.ai/v1/systemone` still returns `answers.<id>.noul` for a `type: noul` question (`src/map/jev.ts` validates this and throws `invalid_response` otherwise).
- `../agent-skills/skills/typography-audit/rules/punct-smart-quotes.md` still has its H2 on line 7 (or `port-rules --check` says so).
- `npx style-capture --help` still lists only `--mode`; if a JSON flag appears, switch `runStyleCapture` to it and delete `src/extract/style-capture-text.ts`.

## Finish line

One of:

- The capability works on the real path: a live `lint` over taste-training returns Jev findings, `eval --include-weak` prints a calibration table, and `tune --write` promotes at least one rule to `active` on evidence.
- A blocker was removed and the next one isolated: for example the key exists but a rule's question wording yields no discordant pairs, so the corpus needs hand labels (`data/corpus/hand.jsonl`).
- The run stopped because finishing needs scope this plan does not cover: an LLM fix executor, `@theme` parsing, or a Gateway transport.

Keep `docs/plans/slop-cop-taste-linter.notes.md` with two headings, Deviations and How the run ended.

## Deviations already taken

- Plan listed 16 typography and 24 copywriting rules; shipped 15 and 23. Dropped: primes, single space after a period (the extractor collapses whitespace, so the check cannot see it), arbitrary text-value density (file-level, needs cross-unit state), leaked error message (the extractor drops `{expression}` children), unverifiable proof (needs rendered or diff scope), and the `copywriting.md` bullets landed as 6 rules, not 9.
- Plan named `src/eval/calibrate.ts`; calibration lives in `src/lib/stats.ts` beside Wilson and McNemar.
- Plan named `capture.json` as the rendered input; both the JSON shape and the CLI text block are accepted.
- Plan claimed the CI fixture dry run and `changeset status --since origin/main` as green; both failed and were replaced by `verify:full` and `changeset status`.
- Plan said `--strict` controls exit 2; `INCOMPLETE` always exits 2.

## Review log

2026-09-19, pr-reviewer (Standard mode with context-errors) then tidy, over the whole branch (b461fcb..9c02f43, no base branch exists). Confirmed and fixed:

- `--fix` rewrote whole source slices, so attribute delimiters, `{"..."}` braces, string quotes and inline code were curled along with the prose. Units now carry `fixRanges` (the prose only) and `applyFixes` edits nothing else; a unit without ranges is reported and left for a hand fix. Fix regexes mirror their rule regexes.
- Code-span offsets mixed UTF-16 and code-point indexing, so an emoji before inline code unmasked the code. Everything indexes UTF-16 now.
- The corpus loader validated labels against the caller's rule subset before the weak-row skip, so `eval --only`, `tune` and `tune ab` aborted on the shipped corpus. Labels validate against the full catalogue and rows outside the evaluation are dropped.
- A suppressed finding could head a category merge and hide a live one; an auth failure did not stop the remaining requests; failed requests vanished instead of becoming unknowns; tuning.json and rule keys were accepted without validation; `port-rules --check` compared only 2 of 38 shipped rules and exited 0 on a missing skills directory; the packed smoke test parsed stdout that lefthook had written to.
- Smaller: JSX passed through props was never visited, character references double-decoded, a later Tailwind size kept an earlier size's line height, McNemar reported a difference for equal discordant counts, Wilson at n = 0 read as a confident zero, marketing routes classified as `ui`, several dead fields and duplicate helpers.

Deferred at the time, since applied: the agent-evals McNemar expression (fixed there in its own pull request) and a per-kind token estimate (3 characters per token for class-list and element states). `path.matchesGlob` stays unused until it is stable on Node 24.

2026-09-19, rule packs widened on request. A `source` unit kind (one per TSX, JSX or CSS file) lets `ui-design/rules` static checks port as whole-file mechanical rules: 39 shipped review-only, 12 left as drafts under `data/rule-drafts/` (shell pipelines, `(?i:...)` inline modifiers, rendered checks). Hand-authored: six motion rules from the `ui-animation` flag-on-sight table, two `product-design` deterministic rules, four shadcn/lint class rules, six Every writing checks (Jev, review-only). Class-list units now exist for every element with classes; typography functions decline units with no text.

2026-09-19, architecture pass. A rule is now YAML data or a code object of the same shape: the 18 checks that count, compare or measure moved from `data/rules/*.yaml` plus a name registry into `src/rules/code/{typography,classes}.ts` with their metadata attached, and `mechanical.function`, `FUNCTIONS`, the validator cross-check and the house test that mirrored them are gone. `src/map/judge.ts` is the one stage lint and eval share. Behaviour preserved: 95 rules load, 66 tests pass, the taste-training dry run gives the same counts (2233 units, 332 findings, 126 act, 206 review) before and after. Left alone on purpose: extractor and reporter tables, subcommands for the scripts, config rule overrides and an edit-list fixer; none has a second caller today.
