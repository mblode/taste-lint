# Rule drafts

Source rules `scripts/port-rules.ts` could not ship as they stand. The loader never reads this folder; `slop-cop rules check` ignores it.

Each draft says why in `portNotes`: the detection is a shell pipeline or loop, the rg pattern uses syntax JavaScript regexes lack, the check needs a rendered page, or the rule needs a question a person has to write. To promote one, finish the missing part, list the keys you wrote under `handWritten`, move the file to `data/rules/<domain>/`, and run `slop-cop rules check`.

Regenerate with `npm run port-rules -- --skills-dir ../agent-skills --write`.
