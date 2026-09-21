---
hidden: true
---

# Page-audit implementation review

Reviewed 2026-09-21. Authoritative plan: `docs/plans/page-audit.md`.

## Delivered behavior

`scan --audit` connects a page brief, named state, viewport and attributed evidence to the existing Jev evaluator, rendered typography checks, document SEO checks, cache and saved reports. Six focused questions judge UI, typography, copywriting, interaction, motion and SEO observations. Both proposed problems and clean reviews receive semantic judgments. Ordinary product defaults remain six rules.

The agent workflow is available through `scan guide`, the packaged `data/audit/SKILL.md` and new `init --agent` instructions. It gives the coding agent ownership of browser observations and edits. Every proposed repair retains its consequence, correction, intent to preserve and repeated verification procedure. Reports group by page region and consolidate repeated corrections; exports retain the full evidence.

`scan verify` requires compatible complete before/after audits, fresh appropriate artifacts, unchanged saved artifact hashes, and a repeated check for every visible, undismissed before finding. Disappearance alone stays unverified. Failed and unknown checks exit 2 and are counted explicitly. Verification remains an attributed observation, not independent authentication or execution of an agent's claim.

The Jev boundary follows TypeSafe's [state](https://docs.typesafe.ai/concepts/state), [Noul](https://docs.typesafe.ai/primitives/noul) and [citation checking](https://docs.typesafe.ai/cookbooks/citation_check) guidance: narrow questions, supplied evidence, separate deterministic validation and semantic judgment. Images are never represented as something Jev has inspected. No new runtime dependency was added for page audits.

## Regression evidence

Twelve feature tests cover all six lenses, clean reviews, negative judgments, cache invalidation, intent preservation, rendered typography, full HTML, quoted evidence, path and symlink containment, mismatched identity, missing evidence, provider failure, incomplete and stale verification, fresh evidence per lens, failed checks that remain present, and the CLI dry-run/export/verify path.

Read-only review found and resolved four evidence gaps: inappropriate artifacts for clean lens reviews, unchanged artifacts passing a check after an unrelated change, clean audits without semantic inputs, and hidden DOM text contaminating rendered units and neighbouring comparisons. The audit capture now records visibility and rejects captures that omit it. Hidden text is removed before constructing typography context; `display: contents` does not hide its visible descendants.

Packed-consumer smoke checks verify that the workflow, example and browser helper ship in the npm artifact, that `scan guide` resolves there, and that the example can preview a text audit without a key. The existing missing-key guard and default-source policy checks remain exercised.

Node 24 `npm run verify:full` passed: formatting/lint, CLI and web builds, types, 238 CLI tests, seven web tests, the packed-consumer smoke check and 174 loaded rule definitions. The source-port check verified 73 shipped rules with zero drift. The local command log is `results/page-audit/verify-full.log`.

## Real-page checks

Local, ignored artifacts are in `results/page-audit/`.

| Target | Evidence exercised | Result |
| --- | --- | --- |
| blode.co homepage | 1280x720 initial state, screenshot, full document, 272 captured elements, first keyboard focus observation | 25 repeated line-height advisories consolidated into one page-region group. These are measurements to review in the intentional design context, not 25 proven defects. |
| Done Bear sign-in | 1280x720 empty password form, screenshot, document, 52 captured elements, switch from code to password mode | No mechanical findings. Password field, code alternative and recovery link appeared; empty Continue remained disabled. Authenticated tasks were unavailable after the app redirected to sign-in. |

The browser's object serialization truncated the larger capture at 200 keys. Serializing in the browser and retrieving JSON in text chunks preserved all 272 elements. The workflow documents this, and the input guard rejects incomplete per-element visibility data.

Both live Jev runs reached Vercel AI Gateway but received authentication errors with the session key. The homepage retained nine unknown judgments; sign-in retained five. Neither is a successful live semantic evaluation or a clean-page verdict. Motion and reduced-motion behavior were not measured, so motion remains not assessed. The complete repair lifecycle is verified with injected evaluators and fixtures; no target-project edits or real repairs were claimed.

## Completed live follow-up

The earlier credential and motion gaps are now resolved for the audited page states. Both the existing client and Vercel's documented TypeSafe-compatible endpoint rejected the old key with HTTP 401. Vercel CLI created a replacement local validation key under the user's blode team with a one-time $1 budget. It is stored only in ignored `.env.local`; the distributed package still requires each user's own key. The existing transport succeeded without modification.

The browser runner had defaulted to Lightpanda, which lacks `document.getAnimations`. Fresh evidence uses Chrome 153 with a 1280x720 viewport. The workflow now requires a rendering browser and checks that reduced-motion emulation actually changes `matchMedia`, rather than trusting a successful tool command.

| Target | Live result |
| --- | --- |
| blode.co homepage, initial state | Complete, ten Jev requests, zero provider errors or unknowns. Jev assigned 0.78 to the supported claim that the contact button's decorative expansion ignores reduced motion. Chrome recorded the same 700ms scale transition in both preference modes. The report also retains 25 line-height and four small-text advisories for contextual review. |
| Done Bear, empty password form | Complete, six Jev requests, zero provider errors, unknowns or findings. The code-to-password transition preserved focus, recovery and the disabled empty submit action in both motion modes. No running animations appeared in four samples over 600ms after each transition. SEO is explicitly inapplicable to this sign-in state. |

Fresh captures, motion measurements, attributed reviews, live reports, blind samples and remediation exports are in ignored `results/page-audit-live/`. This verifies the end-to-end live workflow on two scoped pages, including a supported problem and satisfactory observations. It does not establish population accuracy, authenticated task coverage or a completed repair in either target project. No target-project files were changed.
