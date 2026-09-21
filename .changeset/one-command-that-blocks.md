---
"taste-lint": minor
---

Make the default run block on real slop and cut the surface area that had run ahead of its evidence.

- `lint` is the one command. `--profile` (`product`, `writing`, `instructions`, `all`) scopes files and rule domains and never downgrades a rule; `--since <ref>` reports only changed lines; `--samples` exports blind labelling samples. `scan`, its baselines, review decisions, fingerprints, remediation export, page audits, the dependency-cruiser adapter and the architecture, discovery and personal-writing packs are removed.
- The product profile now runs every product-UI rule, so the 22 mechanical checks (motion, link text, ellipses, quotes, weights) fail `npm run taste` without an API key. Jev rules stay review-only.
- The text report lists act findings and counts review notes by rule; `--verbose` lists them. Empty scorecard rows are hidden.
- `init` writes `taste-lint lint --profile <name>`; `eval labels` replaces `scan labels`.
- The repository lints itself in CI and in the pre-commit hook.
