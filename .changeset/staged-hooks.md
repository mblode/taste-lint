---
"taste-lint": minor
---

Pre-commit support. `lint --staged` lints the files staged in Git, reading the staged content, so it works from husky, lefthook or a plain Git hook. `--no-error-on-unmatched-pattern` lets lint-staged and lefthook's `{staged_files}` pass every staged path: excluded, missing and unsupported files are skipped and an empty selection passes. `init --hook lefthook|husky|lint-staged` writes the hook, merging into existing configuration. A run that selects no files now exits 2 under `--dry-run` too, as it already did without it.
