---
hidden: true
---

# Page-audit DX review and tidy

Reviewed 2026-09-21 against `3f45d89` and the uncommitted page-audit implementation. Standard PR review and targeted DX audit covered `scan --audit`, `scan guide`, `scan verify`, remediation exports, sample replay, capture parsing and the packaged consumer. The read-only findings were confirmed before switching to Tidy. Concurrent landing-page and workspace changes were preserved; their builds were exercised, but their implementation was outside this review.

## Confirmed findings, now fixed

Locations below identify the corrected boundary.

| Severity | Location | Failure and applied fix |
| --- | --- | --- |
| Major | `src/audit/input.ts:27`, `src/audit/input.ts:332` | Saved reports accepted invalid timestamps. Comparing `NaN` allowed freshness checks to pass. Input and saved-report parsing now share an ISO timestamp validator requiring a timezone. |
| Major | `src/scan/samples.ts:41` | Blind samples dropped audit eligibility context. Replay nominated zero Jev requests and treated the labeled rule as a mechanical negative. Samples now retain their audit context; a scan-to-labels-to-evaluation regression proves the question actually runs with the original brief. |
| Minor | `src/audit/verify.ts:179` | A successful retry inherited exit 2 from an earlier unknown verification. Verification now derives its exit code from the current checks and remaining failing findings. |
| Minor | `src/extract/capture.ts:46`, `src/audit/prepare.ts:58` | A capture with `styles: null` escaped validation and crashed with `UNEXPECTED`. The shared capture boundary validates the fields extraction consumes; the audit command returns `INVALID_PAGE_AUDIT` with a recapture instruction. |
| Minor | `src/scan/handoff.ts:6` | Repair exports told agents to inspect nonexistent `rendered:` and `__taste_audit__` files. Audit locations now name the page, region and evidence directory/artifacts. A source file and line are included only when explicitly supplied. Source-scan exports retain their existing shape. |
| HIGH DX | `src/commands/scan-reports.ts:13` | `scan --output json guide` printed Markdown, and `scan verify ... --output json` rejected the flag. Guide, verify and export now accept JSON before or after the subcommand and validate output format before writing files. |

DX rule impacts are separate from PR severity: `err-fail-fast-validation` is **CRITICAL** for the timestamp/capture boundary failures; `cli-structured-io` and `cli-order-independent-flags` are **HIGH** for the command-output failures. All were resolved within the declared surface.

## Simplification

Report commands now live in `src/commands/scan-reports.ts`; remediation mapping lives in `src/scan/handoff.ts`. The main scan command no longer owns either implementation. Verification hashes each declared before/after artifact once, then resolves check references against those validated records. The synchronous operation has no artifact writes or asynchronous gap between those stages. Existing changed-artifact rejection tests still pass.

No runtime dependency, new model question or confidence policy was added. Sample replay preserves the evidence needed by the existing question, consistent with TypeSafe's [state guidance](https://docs.typesafe.ai/concepts/state). The Markdown documentation endpoint failed; the normal page supplied the current guidance.

## Verification

All commands used Node 24.15.0 and the locally built CLI, not a registry version.

- Baseline page-audit suite: 12 passing tests. Before the rebuild, CLI probes reproduced plain-text JSON output, an unknown output option, and an unexpected capture error. Direct sample replay produced zero jobs for a labeled audit question.
- `npx vitest run src/__tests__/page-audit-contract.test.ts src/__tests__/page-audit.test.ts src/__tests__/rendered.test.ts src/__tests__/scan.test.ts --reporter=dot`: 33 passed, including six new contract regressions.
- `npm run verify:full` initially stopped at formatting in `docs/plans/landing-page.md`. Removing two extra blank lines fixed it without changing content. Each constituent gate then passed: `npm run check`, `npm run build`, `npm run typecheck`, `npm test`, `npm run test:package`, and `node dist/cli.js rules check`.
- Full suite: 244 CLI tests in 34 files and seven web tests passed. Both production builds and typechecks passed. Packed-consumer smoke checks passed. Rule validation loaded 174 active definitions.
- `npm run port-rules -- --skills-dir ../agent-skills --check`: 73 shipped rules, zero drift.
- `npx --yes publint packages/cli`: All good.
- `npx --yes @arethetypeswrong/cli --pack packages/cli --profile esm-only`: exit 0, ESM and bundler resolutions passed. The strict default profile reported only the existing CommonJS-to-ESM warning; CommonJS is not a supported package contract.
- Saved blode.co and Done Bear evidence passed the stricter capture parser in dry runs. Both returned exit 2 because motion remains not assessed. The Done Bear capture covers sign-in, not authenticated tasks.
- `git diff --check`: passed.

Local probe and check logs are in ignored `results/dx-review/`. No live model calls were made during this review. Earlier real-page Jev requests failed authentication, as recorded in `docs/reviews/page-audit.md`; fake-evaluator regressions establish pipeline behavior, not judgment accuracy or successful real repairs.

## Review evidence and remaining scope

Loaded PR references included the severity rubric ("incorrect state transitions or data handling"), context-errors ("only the artifact does" corroborate a claim), security checklist ("reject unexpected shapes early"), and performance checklist ("do the work once at boot"). Loaded DX rules included structured I/O ("parse a whole response, errors and all"), order-independent flags, fail-fast validation ("Check at the door; name what failed"), and package resolution ("ESM-only is a valid answer"). No required reference coverage is missing.

## Follow-up: remaining gaps closed

The user requested all remaining fixes. The `schema` command now includes positional arguments, required options, value types, enums and negated defaults. Enumerated options use Commander's `Option.choices`, so parsing, help and discovery share a definition. Duplicate CLI validation was removed. The regression exercises schema discovery, invalid enum rejection and the required `scan verify` argument through the built CLI; 28 focused tests passed.

The rejected local Gateway credential was replaced with a validation key capped at $1, stored only in ignored `.env.local`. Live Jev now succeeds through the unchanged transport. Fresh Chrome captures resolved the motion evidence gap: both blode.co and Done Bear's scoped sign-in audit completed with zero provider errors or unknown judgments. The homepage yielded a supported reduced-motion finding; sign-in yielded none. Details and limitations are in `docs/reviews/page-audit.md`.

Final Node 24 `npm run verify:full` passed as a single command: 245 CLI tests and seven web tests, both builds, types, lint/formatting, packed-consumer smoke checks and 174 active rule definitions. The source-port check again found zero drift across 73 shipped rules. Logs: `results/dx-review/final-verify.log` and `results/dx-review/final-ports.log`.

No confirmed implementation issue from this review remains deferred. Authenticated Done Bear tasks, population calibration and actual repairs in the target projects remain outside these scoped audits. No commit, push or publication was performed.
