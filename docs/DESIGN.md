# Design

## Contracts

### Rule

One YAML file per rule at `data/rules/<domain>/<id>.yaml`. `id` equals the filename. Fields and their meaning live in `src/types.ts` (`Rule`) and are validated fail-closed by `src/rules/validate.ts`; an invalid rule aborts before any request is made.

- `tier: mechanical` decides in code and never calls Jev.
- `tier: jev` sends one question per matching unit.
- `tier: both` uses the mechanical part as a candidate filter; only units it fires on are sent to Jev, and the mechanical hit never surfaces alone.
- `thresholds.act` and `thresholds.review` are per rule. Findings at or above `act` fail the run, between the two print as review notes, below are silent.
- `severity` is independent of probability.
- `source` points at the exact file and line the rule was harvested from. `handWritten` lists the keys `scripts/port-rules.ts` must not overwrite.
- `data/rules/tuning.json` overlays `thresholds.act` and `status` per rule and is written only by `tune --write`.

### Unit

`src/types.ts` (`Unit`). One extracted piece of text or one class list, with `file`, 1-based `line`/`column`, byte offsets, `inCode`, `context` (heading above, doc type, element, role) and, for class lists, resolved typography plus text-bearing neighbours. `id` is a stable hash used for cache keys and SARIF fingerprints.

### Jev request

`src/map/jev.ts` speaks `POST /v1/systemone` with `{ model, state, questions }`. State is a labelled string built from the unit and only the context keys the batched questions asked for. Questions use the noul primitive with `criteria.true` and `criteria.false` as `{ what, examples }` objects, which is the structured form the API accepts. The response is validated fail-closed; bodies are never logged.

### Finding

`src/types.ts` (`Finding`): rule id, category, domain, severity, band, probability, unit provenance, message, evidence, fix hint.

## Non-goals for v1

- No Vercel AI Gateway transport (one-file addition later).
- No `choice` or `score` rules; the schema reserves the field.
- No Tailwind `@theme` parsing; unknown tokens are `unresolved`, never guessed.
- No composite taste score; the scorecard is counts by category and domain.
