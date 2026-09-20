---
title: Writing and instruction rule candidates
hidden: true
---

# Writing and instruction rule candidates

Historical candidate audit, written before implementation. See [current implementation status](skill-pack-status.md) for shipped checks and remaining work.

## Source boundary

This supplements [the all-skills audit](agent-skills-rule-coverage.md). That inventory covered sibling `agent-skills` only. README, agents-md, and agent-skills-creator were included there at skill level. The installed copywriting skill is absent from that checkout, and `../ghostwriter` is a separate repository. Neither belongs in its 27-skill or 246-rule-file counts.

Sources inspected:

- `../agent-skills/skills/readme-creator/references/quality-checklist.md`: 36 numbered checks plus project-specific checks. These mix verifiable defects and house preferences.
- `../agent-skills/skills/agents-md/references/quick-checklist.md`: command/path currency, corrective gotchas, instruction scope, and conflicts.
- `../agent-skills/skills/agent-skills-creator/references/authoring-tips.md`: routing, completion, constraints, progressive disclosure, and evidence-backed instruction quality. Mechanical format rules are owned by its validator.
- `/Users/mblode/.agents/skills/copywriting/SKILL.md` and references `ui-states.md`, `ai-patterns.md`, and `sweeps.md`: installed source, not attributed to a nonexistent sibling-repo path.
- `../ghostwriter/skills/ghostwriter/SKILL.md` and `references/strategy.md`: personal voice, machine-pattern editing, and communication strategy.
- Ghostwriter's trainer profile template and corpus contract, and its evaluator instructions: useful evaluation and provenance contracts, not a source of public persona rules.

No private profile, soul file, or personal corpus was read. These are port candidates, not newly implemented or calibrated rules.

## README pack

| Candidate | Evidence needed | Guard against |
| --- | --- | --- |
| Install package differs from manifest | README fenced command plus selected published package manifest | Workspace root name may intentionally differ from published package |
| Example imports an unexported path | Code block, package exports, and target version | Examples importing an explicitly documented companion dependency |
| Quickstart contains unresolved placeholders or elisions | Fenced example and section purpose | Deliberate user-specific values, tutorial fragments, illustrative examples |
| Default scaffold README remains | Known scaffold text plus project facts | A project that actually documents the scaffold itself |
| Markdown trapped inside raw HTML | Markdown AST and actual renderer behavior | Valid HTML and intentionally literal Markdown examples |
| Broken local image or license reference | Link/image node and repository path resolution | Generated artifacts that exist only at package build time |
| Consumer instructions replaced by maintainer setup | Whole README and project distribution model | Self-hosting or cloning when that is how consumers use the product |

Registry image behavior, headings, badge styles, length preferences, and capability-section counts belong in an optional house README preset. They should not become universal correctness failures. Syntax checks and a controlled smoke test establish different things; do not call an example runnable just because it parses.

## Copywriting pack

| Candidate | Evidence needed | Existing overlap |
| --- | --- | --- |
| Destructive CTA obscures action/object | Button plus dialog copy and action semantics | Extend outcome-naming and confirm-label rules |
| Canonical verb changes the promised operation | Product verb glossary plus action contract | New context requirement; do not infer behavior from the label alone |
| Success message fails to name what completed | Success-state context plus displayed text | Broader than the existing “successfully” phrase check |
| Loading message does not name ongoing work | Loading-state role plus operation context | Distinct from loading-state implementation checks |
| Permission request gives no user benefit | Permission prompt plus surrounding explanation | New contextual copy candidate |
| Copy depends on seeing position, shape, or color | Text plus control relationships | Merge with existing accessibility/color-only checks when they describe the same defect |
| Announced honesty, empty engagement hook, or decorative participle tail | Text and local context | Compare existing canned-phrasing, generic-framing, and meta-commentary questions before creating IDs |

Preserve literal technical uses, quotations, and brand-voice exceptions. The source explicitly lets an established voice override its vocabulary list. A stronger default word ban would contradict the source.

## Ghostwriter pack

| Candidate | Evidence needed | Guard against |
| --- | --- | --- |
| Instruction phrasing leaks into the outgoing draft | Separate task instructions, supplied facts, and draft | User-authored notes are voice evidence and may legitimately be reused |
| Rewrite changes names, times, links, or commitments | Original facts and final draft | Authorized edits and explicit redaction |
| Register disagrees with the selected platform profile | Explicit profile selection and platform | Another platform's register and inferred traits unsupported by the profile |
| Vague ask omits an available concrete deadline | Request intent, supplied deadline, and draft | Inventing a deadline or requiring one when none is needed |
| Praise invents evidence or attribution | Supplied evidence and draft | Subjective appreciation that makes no factual claim |
| Draft adds mechanical antithesis, hollow insight, or repeated tee-ups | Text plus voice exceptions | Genuine comparisons, necessary correction, and a writer's evidenced habits |

This should be an explicit personal-writing mode. Generic style questions can share the copywriting pack, but voice fidelity requires profile/facts inputs the ordinary source linter does not have. Never turn the repository's fictional example persona into defaults, manufacture typos, or infer dislikes from missing examples.

Evaluation should adopt the source's grouped train/held-out split and blind human preference labels. Reuse its evaluator rather than claiming mocked model tests measure voice quality. Private profile content must not be copied into public rules, fixtures, logs, or this audit; any future provider use needs an explicit, visible data boundary.

## AGENTS.md pack

| Candidate | Evidence needed | Guard against |
| --- | --- | --- |
| Command names a nonexistent script | Instruction code span plus applicable manifest | Shell aliases, workspace commands, and generated scripts |
| Referenced repository path does not exist | Instruction link/path and repository root | Globs, intended creation targets, and generated files |
| Gotcha gives a prohibition but no correction | Gotcha paragraph and adjacent context | Self-sufficient safety prohibition |
| Generic boilerplate adds no repository fact | Agent-instruction scope and local repository context | Short reminders tied to a demonstrated recurring failure |
| Parent and child instructions conflict | Actual loading scope and both documents | Intentional, documented local override |

Prefer deterministic command/path checks first. Do not execute arbitrary instructions as part of lint. A sentence-level judgement cannot establish whether an instruction is redundant with the harness or parent files without those inputs.

## Agent skill authoring pack

| Candidate | Evidence needed | Guard against |
| --- | --- | --- |
| Invalid frontmatter or unresolved reference | Skill directory and existing validator output | Reimplementing a second format specification |
| Description does not tell the host when to route | Description plus nearby skill descriptions | Imposing a literal template where the intent is clear |
| Workflow omits its completion condition | Full workflow and promised deliverable | Simple skills that finish with the requested artifact |
| Blanket approval requirement interrupts authorized routine work | Instruction scope and stated authority | Legitimate confirmation for consequential external actions |
| Fixed agent count or review-loop quota is imposed on every task | Workflow scope and stated justification | Explicit bounded orchestration tasks where the count is material |
| Generic “verify carefully” replaces a named check | Completion contract and referenced checks | A check delegated to a linked canonical verifier |

Use the existing skill validator for format and linkage. Semantic checks start review-only. Behavioral regression scenarios are necessary before claiming that deleting instructions preserves outcomes. Do not automatically remove permissions, constraints, or safety requirements based on a prose score.

## Implementation order

1. README and AGENTS.md manifest/path checks, sharing a repository-facts boundary.
2. Skill validation adapter, followed by narrowly scoped instruction-quality questions.
3. Product-state copy checks after extraction preserves state and component context.
4. Shared writing checks after comparing their criteria with existing rule IDs.
5. Ghostwriter mode with explicit facts/profile inputs and separate blind evaluation.

All five areas deserve coverage. Artifact profiles are necessary to keep house README conventions out of API references, personal voice rules out of brand copy, and skill-authoring requirements out of ordinary prose.
