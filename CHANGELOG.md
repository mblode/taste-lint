# taste-lint

## 0.0.2

### Patch Changes

- df5be3b: `taste-lint schema` prints the command surface as JSON, and `--output json` turns an error into a JSON envelope on stdout. A Release workflow publishes over npm OIDC from `main`.
- 63f4f0c: Support AI-labeled scan samples and evaluation corpora with explicit model and prompt provenance. Add a blind AI-labeling script and identify AI-reference metrics in evaluation reports.
- 63f4f0c: Add repository and document analysis with review-only README, instruction, skill, package, architecture, writing, typography, and motion checks. Support TS/JS/config sources and explicit architecture policies. Add skill discovery across rule folders, references, and sibling source collections.

  Read scan inputs once, prepare shared requests once, and propagate recorder failures independently of provider failures. New document profiles scope personal writing and instruction checks without loading private profiles automatically. Accept explicit facts, voice guidance, and drafting instructions through `--writing-context` for personal-writing comparisons.

- 63f4f0c: Make lint runs report one consistent failure policy, validate scan inputs and configuration, and preserve full per-rule evidence alongside compatible grouped JSON output. Bound human reports, expose coverage and progress, share identical requests, write the cache atomically, and recover partial runs with a concrete retry command. Keep skipped checks out of evaluation negatives and add TypeSafe contract tests plus a provisional review-rule corpus.
- 328d663: Changesets CLI v3, which the Release workflow's changesets/action@v2 requires.
- 63f4f0c: Make direct Codex labeling the default documented workflow, with a local task preparation script and preserved AI provenance.
- df5be3b: First published release: the rule pack, mechanical and Jev-backed lint over Markdown, MDX, TSX and rendered pages, eval and tune, and both Jev transports.
- 63f4f0c: Add goal-specific scans with scope previews, stable content fingerprints, compatible baselines, reasoned review decisions, changed-code SARIF reporting, and remediation exports. Add blind calibration sample export with validated human-label import and a dependency-cruiser JSON adapter.

  Give repetition judgments bounded Markdown section context while preserving cached answers across separate context requests. Treat quotes and sentence length as advisory in writing scans, and recognize README and personal prose for those checks.

- 63f4f0c: Make npm installation and a user-supplied Vercel AI Gateway key the default onboarding path. Prefer the gateway environment key over the legacy TypeSafe key, and include setup instructions in help and missing-key errors.
- 63f4f0c: Respect Git-ignored artifacts during file discovery and skip excluded paths before inspecting them. This prevents build caches and dangling links in staging directories from overwhelming or aborting repository scans.
- 63f4f0c: Include complete rule rubrics and context in blind samples. Add offline corpus coverage and structured evaluation output, and require complete independent holdout evidence before tuning activates a semantic rule.
- 63f4f0c: Link the published npm package, changelog, MIT license, Agent Skills and Taste Training from the README. Document npm onboarding with a user-supplied Vercel AI Gateway key and explain advisory-rule limits and provider data flow.
- 63f4f0c: Add four review-only documentation rules from agent-skills: requirements language, conditions before instructions, searchable headings, and actionable error explanations. Pattern filters limit model evaluation to likely candidates, and documentation scope excludes UI and marketing copy.
- 3a97e08: Rename the package, CLI, configuration, suppression directives and repository to taste-lint.
- 63f4f0c: Reject successful scan verdicts for parse failures and empty selections. Prevent tuning writes after provider failures, keep action thresholds above review thresholds, and pair A/B results by sample identity.
- df5be3b: Rule pack: ten ui-design checks hand-ported as regex plus absent rules over source units, tighter error-state and empty-state rules, and the Every AI-tell pack as one rule per published check (19 of 21). `port-rules --check` ignores key order in hand-written source blocks and `--write` leaves promoted drafts alone.
- df5be3b: Rule files carry only what cannot be derived: `tier`, `domain`, `question.type`, `fix.mode`, `related`, `severityOverrides`, `source.tier` and `preconditions.element` are gone, `scope` is optional for every unit kind but `source` (include follows the unit kinds, tests and stories are always excluded), and severity is `major` or `minor`. The runtime `Rule` still exposes tier, domain and a resolved scope.
- b461fcb: Initial release: rule schema and loader, Markdown/MDX, TSX and style-capture extractors, mechanical and Jev-backed lint with bands, tty/JSON/SARIF reporters, eval and tune.
