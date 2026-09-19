# Design

## Contracts

### Rule

One YAML file per rule at `data/rules/<domain>/<id>.yaml`. `id` equals the filename. Fields and their meaning live in `src/types.ts` (`Rule`) and are validated fail-closed by `src/rules/validate.ts`; an invalid rule aborts before any request is made. A rule writes only what cannot be derived: the loader fills in `domain` (from the category), `tier` (from which of `mechanical` and `question` are present) and, for every unit kind but `source`, `scope.include` (from the unit kinds: paragraph and heading come from Markdown, jsx-text and class lists from TSX and JSX, attribute strings from both). Every rule skips tests, stories and changelogs; `scope.exclude` adds to that list.

- A mechanical section alone decides in code and never calls Jev (`tier: mechanical`).
- A question alone sends one question per matching unit (`tier: jev`).
- Both together make the mechanical part a candidate filter (`tier: both`); only units it fires on are sent to Jev, and the mechanical hit never surfaces alone.
- A rule is YAML data (`data/rules/<domain>/<id>.yaml`: regex, phrases, `absent`, a Jev question) or a code object (`src/rules/code/*.ts`: the same fields with `check(unit)` in place of `mechanical`). Anything that counts, compares or measures is a code rule; the loader returns both kinds in one list.
- `mechanical.absent` pairs with `regex`: the rule fires only when `regex` matches and `absent` matches nowhere in the unit (a file with a `<form>` and no focus call). It is how rg's `--files-without-match` pipelines port.
- `thresholds.act` and `thresholds.review` are per rule. Findings at or above `act` fail the run, between the two print as review notes, below are silent.
- `severity` (`major` or `minor`) says how bad a finding is if real; it is independent of probability.
- `source` points at the exact file and line the rule was harvested from. `handWritten` lists the keys `scripts/port-rules.ts` must not overwrite.
- `data/rules/tuning.json` overlays `thresholds.act` and `status` per rule and is written only by `tune --write`.

### Unit

`src/types.ts` (`Unit`). One extracted piece of text, one class list, or (kind `source`) one whole TSX, JSX or CSS file for mechanical rules that pattern-match raw markup; a `source` rule is always `tier: mechanical` because Jev never sees a file. Each has `file`, 1-based `line`/`column`, UTF-16 source offsets, `fixRanges` (the prose inside that slice a fix may rewrite: JSX text pieces, string literal insides, Markdown text nodes; absent when nothing can be rewritten safely), `inCode`, `context` (heading above, doc type, element, role) and, for class lists, resolved typography plus text-bearing neighbours. `id` is a stable hash used for cache keys and SARIF fingerprints.

### Jev request

`src/map/jev.ts` speaks `POST /v1/systemone` with `{ model, state, questions }`. State is a labelled string built from the unit and only the context keys the batched questions asked for. Questions use the noul primitive with `criteria.true` and `criteria.false` as `{ what, examples }` objects, which is the structured form the API accepts. The response is validated fail-closed; bodies are never logged.

### Finding

`src/types.ts` (`Finding`): rule id, category, domain, severity, band, probability, unit provenance, message, evidence, fix hint.

## Glossary

One name per concept. Substituting a synonym splits the concept across the code.

- **Unit**: one extracted piece of text or one class list (`src/types.ts` `Unit`). A corpus row is an **item** until `unitFromItem` turns it into a unit.
- **Unresolved**: a value the extractor could not resolve (a Tailwind theme token, a missing class list). Lives on `ResolvedTypography.unresolved` and in `UnresolvedError`.
- **Unknown**: the finding-level outcome when a rule cannot decide for a unit, usually because a value was unresolved or a precondition was unmet. Reported, never counted as pass or fail.
- **Band**: how sure a finding is: `act`, `review` or `silent`. The eval reports the share of labelled items in the review band as the review rate.
- **Severity**: how bad a finding is if real: `major` or `minor`. Set by the rule, independent of the band.
- **Mechanical / Jev / both**: the rule tiers. `both` means the mechanical part filters candidates and Jev decides.

## fix

Every rule carries `fix.hint`, printed under the finding for a person or an agent; nothing in this package calls a text model. `fix.function` names a function in `src/reduce/fixes.ts` that `--fix` applies to each of the unit's `fixRanges`, never to quotes, braces, expressions or inline code around them; a unit without ranges is reported and left for a hand fix. Each fix function matches exactly what its rule's `mechanical.regex` flags.

## Non-goals for v1

- No `choice` or `score` rules; the schema reserves the field.
- No Tailwind `@theme` parsing; unknown tokens are `unresolved`, never guessed.
- No composite taste score; the scorecard is counts by category and domain.
