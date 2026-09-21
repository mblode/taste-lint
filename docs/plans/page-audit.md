---
hidden: true
---

# Page audit and verified repairs

## Outcome

Make one page and its named state the unit of a holistic audit across UI, typography, copywriting, interaction, motion and SEO. Preserve the product's purpose and intended character. Connect existing rendered checks, Jev judgments, saved scans and agent handoffs. A finding disappearing is not verification of a repair.

## Decisions

- Deepen the existing scan interface with `--audit <file>`. Keep the ordinary six-rule source scan unchanged. Audit input explicitly identifies the page, viewport, state, brief, observer, artifacts, lens reviews and proposed repairs.
- The coding agent collects browser evidence and proposes contextual improvements. Jev must judge whether each proposed defect is supported by that evidence and the brief. Its text judgments do not claim to inspect screenshots. Existing computed typography and full-document SEO rules run through the same evaluator and cache.
- Persist artifact hashes and observer provenance. Read source locations only inside the repository and artifacts only inside the audit directory. Validate evidence before model calls. Missing or oversized evidence abstains.
- Group repairs by page region while retaining every supporting finding. Export the brief, evidence and verification procedure. Import verification only against matching before/after page identities, policy and evidence hashes; require repeated checks and preservation observations. Mark absent findings unverified until that evidence is supplied.
- Ship a small agent workflow and example input with the package. No browser platform, new provider, dependency, universal taste score or autonomous code editor.

## Slices

1. Audit input contract, evidence extraction and six focused proposal-verification questions, one per lens, through existing Jev batching.
2. Saved scan integration, lens coverage, region grouping and actionable export.
3. Before/after verification import with stale-evidence and incomplete-run rejection.
4. Agent workflow, consumer docs, examples, changeset and packed-package checks.
5. Real page evidence from blode-co and Donebear where accessible. Record any missing authenticated/runtime evidence explicitly. Do not edit those projects as part of this package change.

## Verification

- Public `runScan` tests cover cross-lens evidence, intent, negative judgments, missing evidence, cache refresh, rendered typography, complete HTML, malformed inputs and root containment.
- CLI tests cover dry run, report export and verified/remaining/unknown repairs. Wrong page, stale hashes, unchanged evidence, missing checks and provider failure cannot establish a verified repair.
- Run Node 24 `npm run verify:full`, source-port drift check and packed-consumer smoke checks. Live semantic checks are diagnostic evidence, not a calibration claim.
- Preserve unrelated concurrent landing-page work. Revert this additive feature to recover the previous scan behavior; no data migration is required.

## Progress

All five implementation slices are delivered. Node 24 `npm run verify:full` passed, including 238 CLI tests (twelve feature regressions), seven web tests and packed-consumer smoke checks. The 73-rule source-port check found zero drift. Read-only review findings about clean reviews, artifact freshness and hidden typography context were fixed and covered by regressions. Details and real-page evidence are recorded in `docs/reviews/page-audit.md`.

Follow-up validation closed the credential and motion gaps. A fresh local Gateway key with a one-time $1 cap enabled live Jev calls. Chrome captures include interaction and motion in normal and reduced-motion modes. The blode.co homepage audit completed with ten requests, one supported motion proposal and 29 typography advisories; Done Bear's sign-in audit completed with six requests and no findings. Both have zero provider errors and unknown judgments. Artifacts are in ignored `results/page-audit-live/`. Authenticated Done Bear tasks were not part of the sign-in audit. The repair lifecycle remains verified through CLI fixtures; no target-project repair or population-accuracy claim is made.
