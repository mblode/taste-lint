# Rule drafts

Source rules `scripts/port-rules.ts` could not ship as they stand. The loader never reads this folder; `taste-lint rules check` ignores it.

Each draft says why in `portNotes`: the detection is a shell pipeline or loop, the rg pattern uses syntax JavaScript regexes lack, the check needs a rendered page, or the rule needs a question a person has to write. To promote one, finish the missing part, list the keys you wrote under `handWritten`, move the file to `data/rules/<domain>/`, and run `taste-lint rules check`.

Two drafts remain, both `detect: rendered` in the source: `interaction-layout-shift` (content that moves after paint) and `typography-long-content-safety` (overflow and truncation of real text). A regex over source cannot see either; they wait for the rendered extractor (`taste-lint lint --url`) to carry layout deltas and overflow. Every other draft the script once produced has been hand-ported to a regex-plus-`absent` rule under `data/rules/` or authored as its own rule.

Regenerate with `npm run port-rules -- --skills-dir ../agent-skills --write`. It writes every unshipped source rule as a draft, including the ones already covered by hand-authored rules under other ids, so prune what you do not intend to promote before committing. A draft that has been moved under `data/rules/` is not written again.
