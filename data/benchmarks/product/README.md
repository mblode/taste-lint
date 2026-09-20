# Product evidence benchmark

52 variants in 26 paired families. Each family has a weak example and an acceptable counterpart. This small diagnostic set tests discrimination, not population accuracy or full visual taste.

- `course.jsonl`: ten variants from five explicitly mapped Taste Training judgments. Labels come from the course's correct answer, for one relevant rule per exercise. Source paths and exercise IDs are preserved. Run `npm run build && node scripts/seed-product-benchmark.mjs` to regenerate from the sibling checkout. Both variants of a source file stay in one split.
- `exceptions.jsonl`: twenty synthetic variants, individually AI-labeled in Codex before Jev predictions. Cases cover adjacent recovery, no-action-needed states, harmless acknowledgment, credential security, unrelated catches and non-UI utilities. The session did not expose an exact model identifier; provenance records that limitation instead of inventing one.
- `task-context.jsonl`: eighteen development variants covering nested recovery, editable search, optional choices, disabled menu placeholders, explanatory prose, task toolbars and mutually exclusive conditional branches. Labels preceded predictions; the conditional-branch case subsequently drove a code fix, so this set is regression evidence.
- `regressions.jsonl`: four development variants added after inspecting project scan output. Status badges and best-effort background integrations are not error explanations or user-facing async regions. These are regressions, not independent validation.

The rubric hash in each AI-labeled row identifies its labeling criterion. No human labels are claimed. Course examples had already been inspected during development; their holdout designation prevents split mixing but does not make them unseen research evidence. After the first evaluation, the exception set is also a fixed regression set. Do not tune repeatedly on these cases and claim new holdout accuracy.

```sh
taste-lint eval coverage --corpus data/benchmarks/product
taste-lint eval --check --corpus data/benchmarks/product --only copywriting-vague-error,copywriting-empty-state-no-action,copywriting-bare-confirm-label,copywriting-claim-without-evidence,interaction-no-error-state
```

Use a configured Vercel AI Gateway key for uncached evaluation. A family passes only if every weak variant reaches the review threshold and every acceptable variant stays below it. A skipped, missing or failed answer makes the family unresolved. Act-threshold metrics remain separate. The deterministic transition-all check is covered by code tests, not this semantic benchmark.

No rule is promoted by this benchmark. Promotion still requires independent, complete, sufficiently large and balanced evidence. Source examples cannot validate motion feel, rendered hierarchy or recovery behavior in a running browser.

`--check` exits 1 on any disagreement at the review threshold and 2 when selected rules have missing, skipped or failed evaluations. It rejects `--dry-run`. Use `--only` to select the benchmarked rules. This is a regression gate, not the calibration or promotion gate.
