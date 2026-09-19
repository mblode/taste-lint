# slop-cop

Taste as a linter. slop-cop turns the design, copy, typography and motion rules from [agent-skills](https://github.com/mblode/agent-skills) and [taste-training](https://github.com/mblode/taste-training) into checks that run on every file: mechanical where a regex or a real value decides, and a calibrated probability from [TypeSafe Jev](https://typesafe.ai) where a judgement is needed.

Rule packs, by domain folder under `data/rules/`: typography and copywriting (agent-skills `typography-audit`, `docs-writing`, `ui-design/guidelines/copywriting.md`, and Every's writing checks), interaction and craft (the static checks of `ui-design/rules`, ported as whole-file patterns, plus the shadcn/lint class hygiene rules), motion (the `ui-animation` flag-on-sight table) and product (the two deterministic `product-design` rules). Ported and hand-authored pattern rules ship `review-only` until a person has watched them on a real codebase; Jev-backed rules ship `review-only` until `slop-cop tune` promotes them on labelled data. `data/rule-drafts/` holds the source rules that still need a hand-written question or a rendered check; the loader never reads it.

The Every pack carries 19 of the 21 checks in Every's published AI-tell checker (`scripts/run-ai-checker.mjs` in the source bundle of the explainer that accompanies Every's article [Written in 0.7 Seconds](https://every.to/), Mike Taylor, September 2026), one rule per check with the question quoted from the source, plus Dan Shipper's three checks the article paraphrases (unexplained action, missing reasoning link, mechanism over outcome). Where the MIT-licensed `cw-ai-check` skill in `EveryInc/compound-writing` gives a phrase list, the rule is `both`: the phrases pick candidates and Jev decides. Two checks are not ported: `uniform_cadence` compares sentence lengths, which is arithmetic Jev cannot do and a counting function not worth adding for one rule, and `formatting_overuse` looks at headings and bullets that a paragraph unit never sees. The two authorship verdicts (`is_ai_generated`, `overall_ai_tells`) are excluded on purpose: slop-cop reports defects, not authorship.

```bash
npx slop-cop lint src content --dry-run        # units, requests, estimated cost
TYPESAFE_API_KEY=... npx slop-cop lint src content
npx slop-cop lint --url https://example.com    # computed styles via style-capture; runs npx style-capture, needs network and a Playwright Chromium
npx slop-cop eval                              # precision, recall, calibration per rule
```

Findings carry a severity (how bad if real) and a band (how sure): `act` fails the run, `review` is a note, below that is silent. Every rule traces to the line of the skill or lesson it came from.

Requires Node 24. Set `TYPESAFE_API_KEY` for Jev-backed rules; `--mechanical-only` needs no key.
