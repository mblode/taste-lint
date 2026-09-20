# Discovery and animation rule triage

## Implemented

Ten code rules, all review-only, with source paths attached:

- Agent readiness: llms.txt starts with an H1, contains Markdown link destinations, and stays within the skill's recommended 50,000-character budget.
- SEO: a complete static HTML document has one nonempty title; declared descriptions and canonicals are nonempty; canonical destinations do not conflict; JSON-LD parses as JSON; robots sitemap directives are absolute HTTP(S) URLs.
- Animation: continuous spin, ping or bounce explicitly applied under motion-reduce.

Sources: `agent-ready/references/docs-afdocs.md`, `seo/references/audit.md`, `seo/references/indexing-policy.md`, and `ui-animation/references/live-tuning.md` in mblode/agent-skills. These are source contracts, not proof that the checks cover every deployment.

## Existing checks reused or corrected

Instruction links, documented npm scripts and skill frontmatter already have code checks. Existing transition-all and layout-property checks remain; layout-property transitions now recognise utility variants. Missing reduced-motion guards are advisory and require an actual animation guard, not any motion-reduce class.

Title-case candidates must match the whole label, so an embedded product name in a sentence does not trigger a question. Jev instructions explicitly exempt proper names. Hover-affordance and list-virtualization regexes moved back to drafts because their evidence cannot prove the named defects.

## Requires other evidence

- JSON CLI output, documented executable commands: inspect a declared executable contract in a sandbox. Do not execute commands found in untrusted documentation during a scan.
- Robots policy, sitemap destinations, canonical resolution, metadata inheritance, Markdown twins and content negotiation: deployed HTTP responses or captured artifacts with explicit URL identity. Missing source files do not prove missing routes.
- Structured-data eligibility: schema-aware checks plus visible page content. JSON syntax alone is insufficient.
- AEO answer quality, original evidence and motion purpose: semantic review with representative development and untouched holdout examples.
- Reduced-motion across shared styles and components: resolved browser styles and interaction evidence.
- Large-list virtualization and inert affordances: concrete list sizes and event/component behavior.

No broad recommendation was converted into a blocking heuristic. Discovery parses HTML elements, ignores SVG titles, script strings and comments, and abstains on fragments. Email templates are outside its default scope.

## Verification on existing projects

Product mechanical scans completed on 570 Donebear files and 34 Iconsmith files. Compared with the earlier product scans, removing the speculative affordance/list rules eliminates 134 Donebear and 11 Iconsmith review findings. Missing-local-motion findings remain visible as review items rather than blocking findings.

Discovery scans completed on five Donebear HTML files and 46 Iconsmith HTML artifacts, with no findings after excluding email templates. These check existing local artifacts, including saved pages; they are not deployed-site SEO audits. Neither project supplied a static robots.txt or llms.txt in the selected nonignored files, so those checks are covered by positive/negative regression fixtures rather than claimed as validated live surfaces.

Live title-case rechecks removed the known product-name false positives. Remaining suggestions require review of UI naming conventions. These observations informed the rule, so they are development evidence, not independent holdout or a precision estimate. No semantic rule was promoted.

Full verification: 181 tests, types, build, format/lint, package smoke and 169 non-draft rules passed. Source-port verification checked 77 shipped ports with zero drift. New rules carry source references and reviewed positive/negative regression cases.
