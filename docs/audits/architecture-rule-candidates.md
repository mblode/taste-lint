---
title: Codebase architecture rule candidates
hidden: true
---

# Codebase architecture rule candidates

Historical candidate audit, written before implementation. See [current implementation status](skill-pack-status.md) for shipped checks and remaining work.

This supplements [the all-skills assessment](agent-skills-rule-coverage.md). No shipped taste-lint rule currently cites codebase-architecture. Its standards deserve an explicit architecture pack, with repository conventions as inputs rather than a mandatory house architecture.

Sources inspected: sibling `agent-skills/skills/codebase-architecture/SKILL.md` and references `api-design.md`, `guardrail-tooling.md`, `distributed-correctness.md`, and `contagion-markers.md`. These are candidate specifications, not implemented checks or externally verified vendor guidance.

## Deterministic repository checks

| Candidate | Required evidence | Exceptions and implementation boundary |
| --- | --- | --- |
| Cross-module import bypasses the declared public interface | Resolved import graph and configured module entry points | Internal relative imports remain legal; allow multiple public entries |
| Dependency violates a declared layer boundary | Resolved graph and configured allowed dependencies | Do not invent handler/service/DAO layers for an unrelated project |
| Package uses an undeclared dependency | Workspace manifests and resolved runtime imports | Respect type-only dependencies and workspace/toolchain conventions |
| Dependency cycle violates the configured cycle policy | Complete graph including aliases | Type-only edges and accepted cycles follow project policy |
| Config points at a missing file | Statically resolved config references and repository tree | Generated files and optional references need explicit treatment |
| Environment read has no declared contract | Statically known env keys and configured schema/example source | Built-in runtime variables, dynamic keys, and deployment-injected values |
| Registry omits an eligible implementation | Actual implementation set and explicit registry contract | Plugins discovered dynamically require their own enumeration |
| Generated file lacks its regeneration instructions | Declared generated paths and generator conventions | Different generators use different supported banner formats |
| Generated artifact differs from its source | Controlled generator run and clean comparison | Offline schema snapshots may provide reduced, explicitly labeled coverage |
| Deprecated dependency or API reappears in active code | Explicit deprecation/replacement registry and imports | Exclude historical docs and sanctioned legacy paths |
| Legacy marker omits the replacement | Configured legacy paths, marker, and linked migration guidance | Do not infer legacy status from file age |
| Enforcement command cannot enforce its claimed policy | CI command, tool config, installed version, and failing fixture | Some commands intentionally report rather than gate |

Reuse existing import rules, dependency-cruiser, Knip, package-boundary tools, and tests when they already own the check. taste-lint should provide contextual diagnostics and coverage, not another implementation of their parsers or graph algorithms. Confirm version-sensitive tool behavior against the installed version before implementing adapters.

## Contextual contract checks

| Candidate | Required evidence | Why a grep is insufficient |
| --- | --- | --- |
| Transport details leak into a domain service | Declared domain boundary, types, and callers | HTTP status constants can be legitimate in transport adapters |
| Public error shapes disagree | Exported API contracts and response paths | Different APIs may intentionally have different contracts |
| Provider data used without validating required fields | Data flow from external input to consumers | Validation may happen in a shared client or generated decoder |
| Internal validation duplicates an established boundary | Proven validation/type guarantees across every caller | Another caller or changed trust boundary may need the check |
| Request context missing on one entry path | HTTP/job/CLI entry points and context initialization | Initialization can be delegated to middleware |
| Broad catch misclassifies a local failure as a remote failure | Operations inside the try block and downstream error mapping | Some catches intentionally represent a complete operation |
| Log-and-rethrow duplicates error reporting | Logging ownership and the reached outer handler | Independent audit records are not duplicate diagnostic logs |
| Deprecated and replacement paths appear equally supported | Consumers, compatibility promises, and migration policy | Temporary dual paths can be necessary for migration |

Start review-only unless the failure is fully established from declared contracts. Unknown callers, dynamic routing, or unresolved imports must be recorded as missing evidence.

The broad-catch candidate has a concrete local example in taste-lint: `src/map/batch.ts` records successful provider responses inside the catch boundary that classifies unknown exceptions as `provider_error`. That is an appropriate regression fixture for a future semantic check, not a reason to flag every large try block.

## Distributed correctness checks

These require schema, transaction, or runtime evidence and belong in an opt-in pack:

- Retried create uses a different identity and can double-apply the effect.
- Idempotency lookup and record are not protected by an atomic barrier.
- Database mutation and external notification lack a demonstrated durable delivery mechanism.
- An interrupted workflow has no reachable recovery driver.
- Webhook signature verification uses reserialized bytes instead of received bytes.
- A caller credential is replaced with broader service authority without an explicit contract permitting it.
- Arithmetic mixes currencies or violates the declared amount representation.

Each needs a failing scenario, a supported safe alternative, and an unresolved outcome. Absence of an `outbox`, `idempotency`, or `signature` token proves none of these failures. Use controlled retry, duplicate-delivery, concurrency, and interruption tests where static evidence cannot decide.

## Do not promote preferences into universal rules

The source includes house choices: branded identifiers, uppercase enum values, one pagination envelope, AsyncLocalStorage, committed generated output, and particular layer shapes. Enforce them only when the target repository adopts them. A project using explicit context parameters or cursor pagination is not intrinsically defective.

Likewise, file length does not establish bad architecture, one-use helpers are not necessarily waste, and duplicate-looking code can have different owners or lifecycles. Deep-module design and domain naming need change/caller evidence; a generic “make this simpler” question would recreate noisy review.

The source's advice to persist provider requests/responses conflicts with taste-lint's explicit prohibition on storing raw provider bodies. Preserve the local prohibition. An adapter should record sanitized diagnostics and metadata rather than importing that logging prescription.

## Implementation order and acceptance

1. Share repository facts with README and AGENTS.md checks: manifests, paths, configured environment contracts, generated/legacy declarations.
2. Add graph-tool adapters and normalize their evidence without duplicate reports. Include alias-resolution and type-only-edge fixtures.
3. Add narrow semantic checks, starting with the broad-catch classification failure and public error contracts. Require caller context and explicit boundary ownership.
4. Add distributed checks only when transaction/schema/runtime evidence is available. Keep unsupported paths unknown.

The current linter does not collect ordinary TS/JS/config files or preserve a repository import graph. Most of this pack therefore needs repository analysis before new YAML rules. Architecture also needs explicit categories; these failures should not be hidden under typography or generic-decoration.

Acceptance for each shipped rule: source provenance, declared applicability, fail/pass/unknown fixtures, overlap ownership, and a correction tied to the violated contract. No model call should be used to count imports, compare schemas, or establish a transaction's atomicity.
