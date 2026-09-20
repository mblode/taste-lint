# All-skills rule coverage audit

## Scope and method

Inventory: all 27 directories containing `SKILL.md` in sibling `../agent-skills`, including nested `rules`, `rules-arch`, `rules-ax`, references, guidelines, direction documents, probes, scripts, and evaluation assets. The companion [inventory](agent-skills-inventory.json) records all 538 files, their hashes, section headings for Markdown, and links to shipped rules by source path. It contains the source checkout revision and whether that checkout was dirty.

This is an inventory and skill-level porting assessment, with selected candidate checks examined in detail. It is not a claim that every paragraph has been converted into an independently validated rule specification. Evaluation fixtures and procedural instructions are not automatically product lint rules. Existing skill instructions were inspected as source material, not executed.

Coverage comes from the current built `loadRules('data/rules')`, including code rules, not just YAML files. There are 122 shipped rules, 89 citing agent-skills. Of 488 entrypoint/guidance/rule Markdown files, 246 are individual rule files. Exactly 75 of those rule files are cited and 171 are uncited. Citation is provenance, not proof of complete semantic coverage; uncited rules may overlap checks sourced elsewhere.

## What the earlier scan missed

| Rule collection | Source rule files | Cited source files | Uncited source files |
| --- | --: | --: | --: |
| typography-audit/rules | 78 | 13 | 65 |
| docs-writing/rules | 51 | 12 | 39 |
| dx-audit/rules | 38 | 0 | 38 |
| ui-design/rules | 52 | 50 | 2 |
| ax-audit/rules-arch and rules-ax | 27 | 0 | 27 |
| Total | 246 | 75 | 171 |

`port-rules.ts` registers only typography-audit, ui-design, and docs-writing. Its “126 drafts available” output is a generator result from those three collections, not the size of the whole backlog. The scanner also does not discover inline product rules, motion standards, README checks, or the guidelines beside UI rules.

UI's 50/52 citation coverage does not mean UI guidance is almost fully implemented: its skill contains 117 guidance files, including design guidelines and direction material. Conversely, the six motion rules are code rules even though there is no `data/rules/motion` folder.

## Every skill assessed

“Existing” below counts shipped rules citing this skill, not semantic matches. “Now” means the current unit model can support a bounded check, subject to implementation and false-positive tests. “Extend” requires additional evidence. “Integrate” means reuse an existing validator or test system. “Workflow” means the source principally governs agent behavior rather than artifacts that taste-lint currently scans.

| Skill | Existing | Useful candidates or overlap | Disposition and required evidence |
| --- | --: | --- | --- |
| [agent-ready](../../../agent-skills/skills/agent-ready/SKILL.md) | 0 | Broken machine-readable discovery links, Markdown twins returning HTML, incorrect content types, inaccessible API schemas | Extend with HTTP response and site-map evidence; only require surfaces the product actually offers. Merge error-envelope checks with DX. |
| [agent-skills-creator](../../../agent-skills/skills/agent-skills-creator/SKILL.md) | 0 | Invalid frontmatter, dangling references, inconsistent rule counts, descriptions without routing signals, unsupported host instructions | Integrate the existing validator for structure; optional scoped semantic review for instruction quality. Do not reimplement its numeric limits. |
| [agents-md](../../../agent-skills/skills/agents-md/SKILL.md) | 0 | Stale commands and paths, generic template advice, gotchas without corrective action, inconsistent shared instructions | Now for bounded prose candidates; extend with manifest/path resolution and instruction ancestry. Actual command execution needs a separate controlled probe. |
| [autoship](../../../agent-skills/skills/autoship/SKILL.md) | 0 | Release action/config mismatches, missing package artifacts, release claims without registry evidence | Integrate package/release checks. Most guidance is a release workflow; version-dependent checks need installed-version evidence. |
| [ax-audit](../../../agent-skills/skills/ax-audit/SKILL.md) | 0 | Approval bypass, thin approval payload, abort signals not reaching tools, unstructured results, missing completion, undeclared access scope | Extend with TS call graphs and execution traces. All 27 source rule files need triage. Observational rules must remain unknown on static evidence alone. |
| [chat-history](../../../agent-skills/skills/chat-history/SKILL.md) | 0 | Historical evidence presented as current state; unsupported claims of search coverage | Workflow. Provenance validation belongs in a report/history adapter, not default source lint. |
| [codebase-architecture](../../../agent-skills/skills/codebase-architecture/SKILL.md) | 0 | Unenforced boundaries, stale generated contracts, CI commands that cannot fail, inconsistent error contracts | Integrate existing graph/dead-code tools; extend with repository config and call graph evidence. Do not impose the skill's preferred stack globally. |
| [docs-writing](../../../agent-skills/skills/docs-writing/SKILL.md) | 13 | Heading introductions, structured procedures, undefined terms, formatting of UI names versus code, broken internal navigation, example placeholders | Now for locally decidable prose; extend with section boundaries, formatting spans, fenced code, and document graph. 39 rule files have no direct citation. |
| [dx-audit](../../../agent-skills/skills/dx-audit/SKILL.md) | 0 | CLI stdout purity, exit codes, noninteractive behavior, option order, error recovery, public type consistency, config precedence | Extend with JS/TS/config inputs and exported API facts; controlled CLI probes for behavior. All 38 rule files are uncited. Needs a DX taxonomy instead of misleading copywriting categories. |
| [eli5](../../../agent-skills/skills/eli5/SKILL.md) | 0 | Minimizers, promotional language, unsupported analogy, altered identifiers | Mostly overlaps filler/promotional/machine-prose rules. Add aliases or provenance, not duplicate findings. Identifier fidelity needs original and rewritten text. |
| [multi-tenant-architecture](../../../agent-skills/skills/multi-tenant-architecture/SKILL.md) | 0 | Trusting inbound tenant headers, unscoped queries/cache keys, activation before domain verification, authorization only in routing | Extend with security/data-flow evidence and explicit tenant contracts. Specialized opt-in pack; never claim isolation from a keyword's absence. |
| [planning](../../../agent-skills/skills/planning/SKILL.md) | 0 | Non-falsifiable acceptance criteria, “run tests” without scenarios, stale affected paths, unresolved assumptions presented as facts | Extend with a plan document profile and repository references. Local vague-verification candidates can use Jev after the plan scope is identified. |
| [pr-babysitter](../../../agent-skills/skills/pr-babysitter/SKILL.md) | 0 | Stale-head approvals, truncated review threads, ignored human replies, misleading readiness | Workflow requiring GitHub state. Keep out of source lint; a future PR adapter can validate evidence freshness. |
| [pr-creator](../../../agent-skills/skills/pr-creator/SKILL.md) | 0 | Artifact-narrating openers, a body that merely repeats filenames, missing behavioral explanation | Now for explicitly scoped PR text; overlaps meta-commentary. Needs a PR document profile to avoid firing on ordinary docs or mandatory templates. |
| [pr-reviewer](../../../agent-skills/skills/pr-reviewer/SKILL.md) | 0 | Swallowed errors, invented APIs, type bypasses, stale comments, abstractions without consumers | Integrate standard lint/type checks first. Contextual candidates need declarations, call sites, dependency versions, and diff scope. Empty catches alone are insufficient. |
| [presentation-creator](../../../agent-skills/skills/presentation-creator/SKILL.md) | 0 | Missing quote attribution, slide density, headline casing/punctuation, copy duplicating speaker notes | Extend with slide/notes boundaries and presented-versus-async profile. Counts are code rules; do not apply live-talk density limits to investor read-ahead decks. |
| [product-design](../../../agent-skills/skills/product-design/SKILL.md) | 4 | Navigation versus action, destructive scope, truthful undo, gesture alternative, loading labels, adjustable time limits | Extend with component relationships and action/flow contracts. Several state and accessibility checks overlap UI rules; assign one canonical owner. |
| [readme-creator](../../../agent-skills/skills/readme-creator/SKILL.md) | 0 | Manifest/install mismatch, scaffold residue, non-runnable quickstarts, registry-relative images, missing license target | Extend with README profile, manifest and Markdown AST. Registry-specific rules require a known publication target. Consumer-focused wording can be judged locally. |
| [save-md](../../../agent-skills/skills/save-md/SKILL.md) | 0 | Missing source provenance, empty extraction, truncated source represented as complete | Extend with explicit saved-source profile and original artifact. File-shape checks are possible; fidelity cannot be inferred from the output alone. |
| [scaffold-cli](../../../agent-skills/skills/scaffold-cli/SKILL.md) | 0 | Bin/exports point to absent files, duplicate shebang, broken packed imports, hook scope, stdout data contract | Integrate pack smoke tests; share canonical checks with DX and autoship. Version and toolchain preferences are opt-in. |
| [scaffold-nextjs](../../../agent-skills/skills/scaffold-nextjs/SKILL.md) | 0 | Cache config conflicts, obsolete flags, alias mismatches, host-specific output mismatch, missing launch metadata | Extend with package version, config, and host facts. Share metadata checks with SEO and dependency checks with architecture. No global house-stack enforcement. |
| [seo](../../../agent-skills/skills/seo/SKILL.md) | 0 | Sitemap/status mismatch, contradictory canonicals, incorrect hreflang pairs, unsupported structured data, generated timestamps masquerading as content updates | Extend with route metadata and HTTP evidence. Ranking, demand, and citation claims remain outside deterministic source lint. |
| [tidy](../../../agent-skills/skills/tidy/SKILL.md) | 0 | Duplicate ownership and unnecessary surface area; removing guards without system evidence | Workflow plus overlap with architecture and PR review. Avoid a duplicate “simplify this” rule that lacks a concrete failing contract. |
| [typography-audit](../../../agent-skills/skills/typography-audit/SKILL.md) | 13 | Fallback stacks, font-face descriptors, synthesis, kerning/ligatures, justification, paragraph spacing, line measure, font axes | Now for resolved local values; extend with CSS declaration blocks, font metadata, cascade, and layout. 65 rule files are uncited; brand choices often need explicit design intent. |
| [ui-animation](../../../agent-skills/skills/ui-animation/SKILL.md) | 6 | Layout-property animation, persistent will-change, offscreen looping, SVG transform origin, scroll hijacking, gesture cancellation, unsolicited sound | Now for narrow class/source candidates; extend with parsed CSS/JS and event/runtime evidence. Keep reduced-motion/easing checks under existing IDs. |
| [ui-design](../../../agent-skills/skills/ui-design/SKILL.md) | 53 | Long-content safety and layout shift remain uncited; guidelines add button, table, asset, contrast, and responsive candidates | Extend browser evidence for overflow and layout shift. Inventory guidelines individually, and merge guideline/audit duplicates before adding rules. |
| [ui-verification](../../../agent-skills/skills/ui-verification/SKILL.md) | 0 | Focus traversal, target boxes, failure recovery, theme/locale behavior, network and layout measurements | Integrate probes as evidence providers for existing rules, not duplicate rule IDs. Preserve viewport/theme/route, unknowns, and harness failures. |

## Candidate slices and acceptance criteria

### 1. Broaden discovery before broadening execution

Use the complete source inventory as the candidate ledger. Extend importer discovery beyond its three hard-coded collections, but separate discovery from generation. A discovered standard does not become an active rule. Preserve the source path, section or rule ID, detector requirements, overlap decision, and pending status. Source files with multiple standards need section-level entries.

Acceptance: every skill has an explicit disposition; both AX directories are discovered; existing ports retain IDs and hand-written logic. No automatic activation of generated TODO questions. New DX/security families require explicit taxonomy decisions.

### 2. Typography and motion using evidence already available

Start with narrow candidates from `font-true-styles`, `layout-justified-text`, animation performance, SVG animation, and interface SFX. Confirm what the current class resolver and source units actually expose before writing checks. For example, detecting `font-synthesis: none` on the page body is a specific candidate; declaring all unused font styles missing is not.

Local declarations can produce review candidates, but stylesheet-wide absence is not proof: hyphenation, motion preferences, fallbacks, or SVG settings can be inherited or set elsewhere. Parse blocks where relationships matter. Variable fonts and development-only CSS need explicit exclusions. Measurements and thresholds run in code, not Jev.

Acceptance: each new check has failing, passing, and unresolved cases; comments and string examples do not become code findings; unknown inherited values do not silently pass. Keep uncertainty-sensitive rules review-only.

### 3. Document structure, README, and instruction files

Preserve Markdown structure currently lost when extraction normalizes text: emphasis, links/images, section boundaries, fenced examples, lists, and tables. Add explicit README, plan, PR, saved-source, and slide profiles only when each is needed by a concrete rule. Keep them distinct from arbitrary Markdown.

First candidates: `structure-heading-overview` with its reference-entry exception, `format-bold-ui-code-font`, README install/manifest mismatch and scaffold residue, and AGENTS.md dead paths. Existing title-case, filler, meta-commentary, and long-sentence rules remain canonical where applicable.

Acceptance: literal source spans support evidence; reference signatures are accepted without filler introductions; code examples stay out of prose checks; relative paths resolve from the document; commands are not executed merely because they appear in a file.

### 4. DX and agent experience

The current supported file set omits ordinary `.ts`, `.js`, JSON, and YAML. Source-unit questions are prohibited. Therefore most of these 65 source rules cannot honestly be shipped by adding YAML alone. Add appropriate repository/API facts, then selected controlled probes.

Start with manifest/bin/exports consistency, help/version/error output, noninteractive behavior, and machine-readable output contracts. Follow with cancellation propagation, tool output structure, and approval payloads when call-path facts exist. Share overlapping contracts across scaffold-cli, autoship, codebase-architecture, agent-ready, and DX.

Acceptance: packed CLI probes run in a controlled fixture; dependency/tool versions select applicable checks; an unsupported framework yields unknown. AX observational rules cannot fail from grep evidence alone. No live or destructive command execution as part of ordinary lint.

### 5. Browser and HTTP evidence

Reuse ui-verification probe contracts for the two uncited UI rules and for existing heuristic ports. Add optional site evidence for agent-ready and SEO. Reuse current rule IDs where the probe verifies the same failure mode.

Acceptance: each result names route, viewport, theme, trigger, and evidence artifact; skipped or failed probes remain unknown. Missing route/auth is not a clean result. A static grep warning and its runtime confirmation appear as one finding.

## Deduplication and rule quality

Before adding a candidate, compare failure behavior, not just source filenames. These are prominent overlap groups:

- eli5, docs-writing, and existing copywriting rules: minimizers, promotional wording, reader-first explanation.
- UI, product-design, and ui-verification: error/empty/loading states, accessible names, keyboard behavior, preserved input.
- DX, scaffold-cli, autoship, architecture, and agent-ready: machine-readable output, errors, package contracts, safe retries.
- SEO, agent-ready, and multi-tenant architecture: discovery files, route behavior, canonical host ownership.
- agents-md, agent-skills-creator, and planning: instruction scope, references, actionable verification, ungrounded claims.

A port must name the exact failure, applicable artifact, required evidence, exceptions, overlap owner, and executable fixtures. Jev fixtures establish request routing and output behavior when mocked; only labeled evaluation establishes judgement quality. Do not report mocked tests as calibrated accuracy.

Do not turn house preferences, workflow authorization, model behavior coaching, brand direction, or dated vendor defaults into universal failures. Keep version-sensitive source claims pending verification against the installed target before implementation.

## Result and limits

All 27 skills are accounted for. The larger source-rule backlog is 171 uncited files, plus unenumerated standards inside non-rule guidance. This is not a promised count of new checks. The next useful deliverable is several evidence-backed packs and the extraction work each actually needs, not a bulk YAML conversion.

This audit adds documentation and an inventory only. It makes no provider calls, changes no skill source, and activates no additional rules.
