---
title: "taste-lint: taste as a linter"
hidden: true
---

# taste-lint: taste as a linter

Authoritative plan for this repository. The session plan file it was reviewed from lives outside the checkout and is not available to CI or other sessions; this copy wins where they differ.

## Outcome

Problem: the copywriting and typography rules in `mblode/agent-skills` and `mblode/taste-training` are prose, so they are applied only when a person or an agent remembers to read them. Intended behaviour: `taste-lint lint <paths>` runs every rule over Markdown, MDX, TSX and rendered pages; a regex or a real value decides where one can, and TypeSafe Jev returns a calibrated probability where a judgement is needed. Findings carry a severity (how bad if real) and a band (how sure) and never move one to express the other.

Acceptance criteria:

1. `npm run verify:full` passes: lint, types, 40 tests with no network, build, packed-artifact smoke test, `rules check`, fixture dry run.
2. `taste-lint lint --dry-run` on taste-training (stimuli excluded) reports units, requests and estimated cost without a key. Observed: 1,404 units, 92 requests, about $0.0015.
3. `taste-lint lint --url http://127.0.0.1:8765/ --selector main --dry-run` against a served page produces `element` units with computed styles and fires the rendered-value rules. Observed on the fixture page: body below 15px and uppercase without tracking, plus one hierarchy request.
4. Every Jev-backed rule ships `review-only`; `taste-lint tune --write` promotes a rule to `active` only when its act-band precision lower bound clears the floor on the dev split. Enforced by `src/__tests__/house.test.ts`.
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

Keep `docs/plans/taste-lint-taste-linter.notes.md` with two headings, Deviations and How the run ended.

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

2026-09-19, round 3. The ten ui-design drafts whose detection was a shell loop or filter (`while read`, `-A` windows, `| rg -v`, `(?i:...)`) are hand-written YAML under `data/rules/interaction/` and `data/rules/craft/`: `mechanical.regex` plus `mechanical.absent` over a `source` unit, `handWritten: [mechanical, fix, status]`, review-only. `interaction-no-error-state` and `interaction-no-empty-state` fire on the source's real condition (a fetch hook with no error branch; an emptiness check with no action nearby) instead of the candidate listing: on taste-training the first drops from 18 files to 0, the second reads 5. Two rendered drafts remain. The Every pack is one rule per published check, 19 of 21, ids `copywriting-<key>`, question text quoted from `run-ai-checker.mjs`, phrase candidates from `cw-ai-check` where it has them; the three earlier hand-inferred duplicates were renamed to their keys. `port-rules --check` compares the source block order-insensitively (hand-written files list `repo` first) and `--write` no longer regenerates a promoted draft. State after: 118 rules load, 66 tests pass, 0 drifted. Taste-training dry run with `content/judgements/**,content/exercises/**,components/demos/**` excluded: 8246 units, 576 act, 1118 review, 24 unknown, 1121 requests, about $0.13. Highest counts are the review-only shadcn class rules (`craft-arbitrary-value-class` 559, `craft-raw-colour-class` 293) and `typography-body-below-15px` (276); those are the first candidates for a scope exclude or a tune once a key is available. `main` created from this branch head and the draft pull request opened against it.

2026-09-19, round 4. Schema cut: a rule file no longer carries `tier`, `domain`, `question.type`, `fix.mode`, `related`, `severityOverrides`, `source.tier` or `preconditions.element`; `scope` is optional (include derived from the unit kinds; every rule excludes tests, stories and changelogs) and only `source` rules name it; severity is `major` or `minor`. The loader derives the runtime fields, so plan, bands, reports, eval and tune did not change. Proof: 118 rules load, `port-rules --check` 0 drifted, the taste-training dry run identical before and after (8246 units, 576 act, 1118 review, 24 unknown, 1121 requests). The 100 YAML files lost about 900 lines; the validators about 50. The `--fail-on critical` step left `verify:full` (it proved nothing once no rule was critical).

Jev live for the first time, through Vercel AI Gateway (`AI_GATEWAY_API_KEY`, transport `gateway` in `src/map/jev.ts`: the AI SDK's evaluation route, model in a header, `boolean` for `noul`, `probability` in the answer). Smoke: 3 units, 2 requests, 7238 input tokens, $0.0003; the rerun answered 30 questions from cache with 0 requests. Taste-training, same excludes as the dry run: 1121 requests, 2,993,768 input tokens, $0.1257, 0 errors; 576 act (all mechanical), 2848 review, 24 unknown (unresolved theme colour classes such as `text-palette-600`). The Jev rules that fire most, all review-only: `copywriting-generic-framing` 590, `copywriting-unnatural-polish` 468, `copywriting-generic-language` 140, `copywriting-missing-reasoning-link` 110; lesson prose trips the Every checks written for essays, so those questions want a docType precondition or a rewrite before anyone promotes them. A dry run straight after reports 0 requests: the cache holds every answer.

Eval over the corpus (14 requests, $0.0005): `copywriting-claim-without-evidence` n=27, precision 100% [68%, 100%], recall 62%; `copywriting-reader-first` n=28, precision 100% [44%, 100%], recall 27%; `copywriting-generic-audience` 4 of 4; `copywriting-machine-prose` 0 positive predictions on 12 items (8 false negatives: the candidate phrase filter or the question is too narrow for the manifest's stimuli); with `--include-weak`, `copywriting-bare-confirm-label`, `cta-names-outcome` and `empty-state-no-action` also predict almost nothing on jsx-text stimuli. `tune` promotes no rule: the precision lower bounds sit under the 0.8 floor at n of 19 to 23 dev items, and every other rule has under 10. `tuning.json` stays empty; the next step that changes this is labelled items, not code.

Docs: `AGENTS.md` rebuilt to the agents-md checklist (commands with a quiet targeted test form, setup facts including both keys and the sibling checkouts, gotchas with the corrective action, invariants, one pointer to `docs/DESIGN.md`; the file inventory moved to a Pipeline section in DESIGN.md). `README.md` rebuilt to the readme-creator spine for a CLI (header, Install, Quickstart with real output, capability sections, Options, License) with `npm install -g taste-lint`; the package is not on npm until you publish 0.1.0 (`npm run changeset:version` then `npm run release`), so that line points at a 404 until then. agent-evals PR #3: the corpus followed the SEO skill consolidation and gained cases for `agent-ready` and `chat-history`; CI was red on the base for the same reason.

2026-09-19, scaffold-cli pass over the existing package. Present already: dual tsdown entries with the banner shebang and `.js` output names, Commander, vitest, ultracite with oxlint and oxfmt, changesets with `baseBranch: main`, CI on Node 24 with `changeset status` on pull requests, the symlinked CLAUDE.md, a skill under `skills/taste-lint/`. Added: `.github/workflows/npm-publish.yml` (changesets/action@v2 with `publish-script`, npm OIDC, Version Packages PR on `main`), the two-job `lefthook.yml` (staged files only; JSON-only commits reach oxfmt, not oxlint, so the changesets bot's commit passes: proven with `npx lefthook run pre-commit --file package.json`), `engines.node >=24.11`, a `schema` command that prints the command surface as JSON, and a JSON error envelope on stdout when `--output json` is set. Checked: `publint` clean; `arethetypeswrong --pack` green for ESM and bundlers with the expected CJS warning (the package is ESM only, like the template); one shebang in `dist/cli.js`; `--version | cat` prints no ANSI; no template placeholders. Not added: `--no-input` (the CLI never prompts) and `@clack/prompts` (nothing to prompt for). Step 8 of the skill is yours: publish once by hand so the package exists, register the workflow as the package's trusted publisher on npmjs.com, then the Release workflow opens Version Packages (0.1.0 from the pending changesets) and publishes when it merges.

2026-09-19, agent-skills-creator audit of `skills/taste-lint`. Baseline: `validate.sh --repo` (public policy) failed `readme-bullet` (the README named the folder, not `SKILL.md`) and `frontmatter-parses`, the second because the embedded Ruby one-liner fails on this sandbox's Ruby 3.3.6 for every skill in agent-skills too; `ruby -ryaml` parses the frontmatter directly and `skills-ref validate` passes, so that gate is environmental. Dimensions before, 1 to 5: trigger coverage 4, boundary 5, structure 4 (evals folder not declared maintenance-only), signal density 3 (a commands table restating `--help`, a rule-authoring gotcha in an operator's guide), gotchas 4, freshness 2 (`copywriting` no longer exists in agent-skills, `results/lint-*.json` is `.jsonl`, no mention of `schema` or the `--output json` envelope), progressive disclosure 5, workflow integrity 3 (no scope of done, no permission grant), cross-skill coherence 2, content patterns 4, constraint calibration 4. Rewrite in the reference's order: stale facts first (siblings now `docs-writing` and `ui-design`, results path, the two agent-facing surfaces), description trimmed to 473 characters with the "is this finding a blocker" moment added, `evals/` declared maintenance-only, the commands table cut to the rows the workflow turns on with `schema` as the full surface, a scope of done and an explicit grant (lint reads files and writes only `results/`, so run it unasked; `--fix` rewrites prose ranges only, then show the diff), the authoring gotcha removed and a review-only reading gotcha added from the taste-training run. Evals: near-miss for the retired `copywriting` now expects `ui-design`; routing sets grown to 8 should-trigger and 6 near-miss prompts. After: `readme-bullet` passes under the public policy (the private policy's catalogue regex matches the README's options table rows, which is a false positive for a non-catalogue repo), `skills-ref validate` passes, dimensions 5/5/5/4/5/5/5/5/5/4/5. Not run: a with-versus-without behavioural comparison; the three scenarios remain specifications.
