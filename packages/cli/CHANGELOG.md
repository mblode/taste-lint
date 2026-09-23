# taste-lint

## 0.3.0

### Minor Changes

- fbf3e3d: Port the ghostwriter structure tells (participle tails, antithesis, tee-ups) and ui-animation source checks (`transition: all` in CSS, `framer-motion` imports) as blocking rules, with review-only candidates for `will-change`, default indigo and atmosphere gradients. Add a `rules` config key for extra rule directories such as a ghostwriter voice pack, and `auSpelling` and `stripUtm` fixes. Re-cite rules from the retired docs-writing and readme-creator skills to ghostwriter; long sentences now need several joined clauses, Latin abbreviations are review-only, and LICENSE and CHANGELOG files are skipped. Broken local links and images without alt text now block.

## 0.2.0

### Minor Changes

- ff6354d: Make the default run block on real slop and cut the surface area that had run ahead of its evidence.

  - `lint` is the one command. `--profile` (`product`, `writing`, `instructions`, `all`) scopes files and rule domains and never downgrades a rule; `--since <ref>` reports only changed lines; `--samples` exports blind labelling samples. `scan`, its baselines, review decisions, fingerprints, remediation export, page audits, the dependency-cruiser adapter and the architecture, discovery and personal-writing packs are removed.
  - The product profile now runs every product-UI rule, so the 22 mechanical checks (motion, link text, ellipses, quotes, weights) fail `npm run taste` without an API key. Jev rules stay review-only.
  - The text report lists act findings and counts review notes by rule; `--verbose` lists them. Empty scorecard rows are hidden.
  - `init` writes `taste-lint lint --profile <name>`; `eval labels` replaces `scan labels`.
  - The repository lints itself in CI and in the pre-commit hook.
  - `lint` drops `--rules`, `--limit-units` and `--capture`; `rules discover` is removed. `runLint()` takes every option as optional (root defaults to the working directory, targets to `.`), documents each field, and resolves with a `LintRun` whose summary, rule findings, scorecard and scope are always present. The package exports only what scripts and embedders call.

## 0.1.0

### Minor Changes

- c4908dd: Add page audits with project intent, attributed evidence and Jev review across UI, typography, copywriting, interaction, motion and SEO. Connect rendered typography and document checks to saved scans, group improvements by region, and require fresh before/after verification records before treating repairs as resolved. Ship an agent workflow and capture helper.

  Preserve audit context when exporting evaluation samples, validate capture fields and timestamps at the input boundary, and support JSON output for guide, export and verification commands. Repair handoffs identify real page evidence and optional source locations; successful repeated verification clears earlier incomplete exit codes.

### Patch Changes

- c4908dd: Point CLI help, setup instructions, SARIF reports, and the agent skill to https://blode.co/taste-lint/docs.
- c4908dd: Expose positional arguments, required options, value types, allowed choices and negated defaults through `taste-lint schema`. Derive choices from the CLI parser so agents can discover and use valid commands without scraping help text. Document the rendering-browser requirements for measured page audits.
- c4908dd: Add a README documentation button pointing to https://blode.co/taste-lint/docs.
- c4908dd: Use the site name instead of SVG logos in the docs header.
- c4908dd: Add the author, projects, GitHub, and npm links to the landing page footer.
- c4908dd: Add human and agent install tabs to the hero, with AGENTS.md setup in the agent command.
- c4908dd: Place the install command copy button inside the snippet box.
- c4908dd: Explain Jev by TypeSafe AI in the landing page pitch and search metadata, highlighting contextual checks and probabilities.
- c4908dd: Use Glide colours and Blode UI on the landing page, remove the placeholder logo, and shorten the copy.
- c4908dd: Add the Taste Lint landing page and canonical docs under blode.co/taste-lint, with Turborepo builds for the CLI and web app.
- c4908dd: Clarify search metadata, add the canonical social URL and docs discovery headers, and correct the software schema.

## 0.0.11

### Patch Changes

- b6423d8: Preserve applicability, exceptions, required evidence, and verification for all 36 raw-source review checks. Mark regex matches as candidates rather than confirmed defects, keep them out of defect-accuracy metrics and automatic failures, and carry their review procedures into reports and agent handoffs. Detect changes to reviewed skill documents and generate new rule ports as drafts.

  Abstain when semantic checks lack comparison context or exceed the evidence budget, including questions without regex filters. Split batches when combined context would truncate evidence.

## 0.0.10

### Patch Changes

- a419aff: Focus default product scans on six actionable checks. Judge error recovery and confirmation labels with Jev, include nearby JSX evidence in copy checks, and show five prioritized rule groups while preserving complete reports. Add paired-example evaluation and review-threshold metrics, with source-family split checks.

  Include surrounding task controls in copy judgments and omit mutually exclusive conditional branches in code. Preserve contextual evidence in agent handoffs and add eval --check to fail on regression disagreements or incomplete evidence.

## 0.0.9

### Patch Changes

- ff3546c: Use Jev to review literal utility values in their local JSX context instead of warning from syntax alone. Code selects candidates; Jev distinguishes reusable visual styling from layout, asset, accessibility and optical constraints. Keep the rule advisory, preserve contextual evidence in samples and evaluation, and report unknown for dynamic or incomplete evidence. Reuse cached judgments without adding an onboarding step.

## 0.0.8

### Patch Changes

- f3ae8b3: Stop flagging CSS token references, calculations, asset URLs and relative layout expressions as hardcoded arbitrary values. Keep literal values advisory with a contextual review hint. Make punctuation, sentence length and line-height preferences advisory in product scans while preserving strict lint policy. Respect explicit font-size overrides, abstain on unresolved size variables, and avoid reporting slow transitions for transition-none. Bind scan baselines to the taste-lint version so changed analysis cannot imply source fixes.

## 0.0.7

### Patch Changes

- 6b512e2: Compare near-scale font sizes against explicitly declared pixel tokens instead of flagging arbitrary values with a source regex. Parse complete JSX classes, preserve variants, and report unknown when scale evidence is unavailable. Keep the check advisory and avoid automatic size changes.

## 0.0.6

### Patch Changes

- 31d1294: Use Jev to evaluate form, error, viewport, and hover-rule candidates instead of reporting a broad source match as a defect. Parse image attributes to ignore comment and string lookalikes. Allow bounded full-file semantic context and abstain when the source is too large.

  Retire the file-local skip-link rule until composed layout evidence is available. Its ID is no longer selectable.

  Use Jev to distinguish running prose from captions, metadata, and menu descriptions before reporting body-size or letter-spacing candidates. These rules now remain advisory until calibrated.

## 0.0.5

### Patch Changes

- f54009b: Make Jev the single scan workflow. Remove --mechanical-only and the corresponding API option; deterministic checks continue alongside Jev judgments. Preview scans with --dry-run, and reuse cached judgments without new model calls.

  Init now adds one taste script. Re-running init upgrades the exact local-only check:taste script generated by older releases while preserving custom scripts.

## 0.0.4

### Patch Changes

- 39709c8: Add taste-lint init to detect the package manager, install locally, and add local and AI scan scripts. Setup supports a dry run, preserves existing scripts, and can append agent guidance.

## 0.0.3

### Patch Changes

- fb593c8: Shorten the README around installation, a Vercel AI Gateway quickstart, and useful scan options. Credit Jev by TypeSafe AI and move the detailed command reference into the usage guide.
- 95b2b75: Add ten advisory checks for static SEO metadata, JSON-LD syntax, robots sitemap URLs, llms.txt structure and size, and explicit reduced-motion animation. Add a discovery scan profile with HTML and discovery-file support.

  Reduce title-case noise around product names, require actual animation guards, and move speculative hover-affordance and list-virtualization patterns out of default scans. These two rule IDs are no longer available in explicit selections.

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
