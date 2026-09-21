---
hidden: true
---

# Taste Lint landing page and docs launch

Authoritative implementation plan. Prepared 2026-09-21 from the local taste-lint, glide, dnd-grid, and blode-co checkouts. Implemented and deployed 2026-09-21. User amendment: use Turborepo.

## Outcome

Publish one landing page at `https://blode.co/taste-lint`, served by a Vercel project rooted at `apps/web`. Serve the existing docs at `https://blode.co/taste-lint/docs`, retaining `docs/` as the content source and `taste-lint.blode.md` as the upstream tenant.

Done means the public landing page, install action, docs navigation, assets, search, exports, and share metadata work through blode.co. Existing CLI builds, tests, and package contents remain correct.

## Evidence and decisions

- `../glide/apps/web` supplies the Next.js 16 shell, Tailwind styles, local Glide fonts, button, breadcrumb, footer pattern, and generated share card. Copy that app, then immediately prune the font product features. Do not copy build output, dependencies, environment files, or Vercel project identity.
- Use npm workspaces with a private root, `apps/web`, and the publishable `packages/cli` workspace. Changesets excludes repository-root packages in workspaces, so the CLI manifest and changelog belong in `packages/cli`. Keep existing `src/` and `data/` paths to avoid disrupting concurrent CLI work. The CLI build compiles at root and stages dist, data, README, and licence into its package. Turbo caches both build outputs. No shared UI package.
- The root TypeScript configs already restrict compilation to CLI source and scripts. Give the web workspace its own Next configuration and typecheck. Preserve the repository's `.js` TypeScript import convention, including when adapting sibling helpers.
- `../dnd-grid/apps/web/proxy.ts` and `lib/docs-proxy.ts` proxy HTML and RSC, rewrite navigation and asset paths, preserve redirects, and avoid forwarding the public host into tenant lookup. Adapt this existing implementation rather than creating a docs renderer.
- Its route list, introduction alias, sitemap filter, logos, and example routes belong to dnd-grid. Replace those using this repository's `docs/docs.json` and observed tenant output. Taste Lint uses `index`, not `introduction`, as its configured entry page.
- `../dnd-grid/apps/docs/docs.json` sets `seo.siteUrl`, `seo.siteName`, and `metadata.ogImage`. Apply siteUrl and siteName to Taste Lint's existing docs config. The released CLI rejects metadata.ogImage, so the proxy supplies the share image until support is published.
- `../blode-co/apps/web/lib/zones.ts` is the host routing and sitemap registry. Taste Lint is not registered. Register the zone only after its deployed origin works. Use the actual Vercel-confirmed production alias; never guess a hostname. A dedicated zone domain is optional, not a launch dependency.
- Follow `../blode-co/apps/web/.claude/knowledge/zone-conventions.md`: one product graph referencing host identity, host breadcrumb, author credit, generated zone share card, and canonical paths with the prefix exactly once.

## Page brief and direction

Inferred audience: developers reviewing AI-assisted interfaces, writing, and agent instructions. Inferred traffic: referrals from Blode projects, GitHub, and search; mostly problem-aware. Goal: help the reader install Taste Lint and reach their first scan. Voice comes from the existing README and `docs/index.mdx`: terse, concrete, honest about AI checks.

Recommended copy:

- Product: **Taste Lint**
- Headline: **Catch AI slop before you ship.**
- Description: **Lint your UI, copy, and agent instructions.**
- Primary action: **Copy install command**, beside `npx taste-lint@latest init`.
- Secondary navigation: **Read the docs**, to `/taste-lint/docs`.

Visual thesis (corrected by the user): retain Glide's pink and dark red palette, use a text-only Taste Lint title, and show one real scan example.

Use Glide colours: background `#FBB6CD`, foreground `#8B1A0A`, with the source app's supporting tokens. The docs favicon was not a Taste Lint product logo and must not appear beside the title. Use Blode UI controls and `blode-icons-react`. Keep Glide sans and mono, fixed root sizing, and responsive gutters.

```text
Home / Projects / Taste Lint

Taste Lint
Catch AI slop before you ship.
One sentence explaining the scan.

npx taste-lint@latest init       [Copy install command]
Read the docs

One real input and its actual scan finding

Crafted by Matthew Blode         GitHub / MIT
```

Three content blocks: hero/install, evidence, footer. No pricing, account flow, browser scan, carousel, animated terminal, feature card grid, or invented adoption numbers. A real excerpt is enough proof; a backend demo would add cost and expose credentials without helping installation.

Product decisions:

- Copying changes only the clipboard, never runs a command or modifies a project. Keep the command selectable; show stable-width success feedback and a manual-copy recovery message on failure. `rule/name-object-scope-consequence`, `rule/cover-reachable-states`, `rule/error-states-recovery`.
- Docs and GitHub are anchors; clipboard copy is a button. Use a normal document navigation into the separate docs app, avoiding marketing-router prefetch across that boundary. `rule/navigation-vs-action`.
- Keep the primary path usable by keyboard, with named controls, visible focus, and an announced copy result. Build 48px controls. No modal or extra confirmation. `rule/keyboard-complete-flow`, `rule/accessible-name-required`, `rule/smallest-intervention`.
- No entrance or scroll animation is needed. Use brief colour feedback for interactive states, respecting reduced motion. Visual implementation belongs to ui-design; final strings belong to copywriting.

## Implementation order

### 1. Prove the landing-to-docs boundary locally

Copy `../glide/apps/web` to `apps/web` and rename the private package to `@taste-lint/web`. Keep its shell, fonts, required components, PostCSS setup, and OG helper. Remove specimen, glyph and weight controls, font releases/downloads, install-agent endpoints, font metadata, Glide markdown negotiation, unused dependencies, and stale branding. Retain only the font files needed to render the site and card.

Set `lib/config.js` to one base path, `/taste-lint`, and public URL. Use it in `next.config.ts`, raw asset URLs, icons, and manifest. Replace the source app's preview-skipping `vercel.json` policy so preview verification can run. Do not inherit Glide redirects or discovery headers for removed endpoints.

Add the workspace and lockfile entries. Make `npm run build` build both through Turborepo; use `build:cli` or `build:web` for a single target. Add web typecheck/build to CI and narrowly configure linting for the new app if required. Add a patch changeset with the implementation, per repository policy.

Render the hero and docs link first. Adapt dnd-grid's proxy and smoke script, targeting `taste-lint.blode.md`; make `/taste-lint/docs` and `/taste-lint/docs/quickstart` work before adding page polish. Preserve upstream status codes and binary responses. Bound upstream fetch time and return a readable 502/504 with retry guidance on failure, without raw provider errors or a cacheable success response.

### 2. Finish the one-page experience and canonical docs

Implement the copy block and clipboard states. Capture one actual CLI finding from a small checked-in fixture using local deterministic checks, and display it faithfully as an example. Do not invent a Jev probability or imply a source scan proves rendered accessibility.

Adapt layout, favicon, manifest, share card, schema, sitemap, and 404. The 404 must be noindex and must not inherit the landing canonical. Use `SoftwareApplication` facts that the README supports, without ratings, claims of a free AI service, or duplicate host identity entities. Set author/creator to Matthew Blode and `og:site_name` to Matthew Blode; card titles identify Taste Lint.

Update `docs/docs.json`:

- `seo.siteUrl`: `https://blode.co/taste-lint/docs`
- `seo.siteName`: `Matthew Blode`
- Proxy share-image override: `https://blode.co/taste-lint/opengraph-image` (the released CLI rejects `metadata.ogImage`).
- Website navbar link: `https://blode.co/taste-lint`

Keep all seven current public docs pages and hidden research material unchanged. Rewrite root-relative MDX links, HTML and escaped RSC URLs, asset preloads, redirects, and canonical URLs onto the correct public mount. Keep `/_docs` assets separate from the marketing app's `/_next`. Verify docs logos, images, search requests, markdown exports, and llms files against actual upstream responses, extending only the missing mappings.

Use the configured navigation as the page-list source where practical. Do not retain dnd-grid's `/introduction` special case. Verify whether the tenant emits `/index`; if it is an alias, choose `/docs` as canonical and remove the duplicate sitemap entry. Preserve query strings and fragments and avoid rewriting unrelated external links.

### 3. Deploy the child, then connect the public host

Inspect current Vercel linkage and account access using the deployment skill. Create or reuse the Taste Lint web project, connect the repository, set root directory `apps/web`, Node 24, and verify workspace installation and the Next build command. Never reuse Glide's project identity or copy its secrets. This static page needs no AI Gateway credential.

Deploy a preview and run the checks below. Publish the docs config through the existing Blode.md workflow and confirm that the upstream has refreshed. Deploy the child production app and record its actual production alias.

In the blode-co repository, read its applicable instructions, then add a `taste-lint` zone with that verified origin, `hasSitemap: true`, and `docsSitemap: true` only after both endpoints return valid XML. Its existing registry generates exact-root and nested rewrites and excludes zone responses from conflicting host headers. Deploy the host after the child works. Verify the host sitemap index includes both sitemaps.

After the public route passes, update the npm homepage to the landing page, README docs links to the public docs URL, and the canonical docs guidance in `AGENTS.md` and `docs/CLAUDE.md`. Leave historical research evidence URLs intact. Keep the upstream tenant reachable; redirecting it back through the proxy would create a loop.

## Verification

Use Node 24.11 or later for reported results.

| Acceptance | Check and expected result |
| --- | --- |
| CLI remains valid | `npm ci`, `npm run verify:full`, and the existing port-rules check pass. Packed smoke test confirms web files are absent from the npm payload. |
| Web can ship | `npm run check:web` and `npm run build:web` pass from a clean install. Inspect production build output, not just dev metadata. |
| Docs remain valid | `npx blodemd validate docs` passes; public nav contains the current seven pages only. |
| Proxy correctness | Adapted smoke suite covers root/deep docs, HTML and RSC, assets/preloads, redirects, query/hash preservation, external links, and sitemap aliases. Include missing-page 404 and upstream failure cases. |
| Page works | ui-verification checks mobile at 375px and desktop at 1440px, keyboard focus, copy success/failure, 200% zoom, readable contrast, and no overflow. Save screenshots and inspect console/network failures. |
| Docs work in context | From the deployed landing page, follow Docs, visit Quickstart, search, navigate back, switch theme, copy/export markdown, and fetch llms files. No upstream-host escape or lost prefix; fonts, logos, content images, and scripts load. |
| Public SEO is correct | Fetch landing, docs root, Quickstart, sitemap XML, share image, and a nonexistent route. Canonicals use blode.co with one prefix; unique page titles include Taste Lint; share image returns an image; nonexistent routes remain 404/noindex. |
| Host integration is correct | Run blode-co's `npm run check-zones`; investigate pre-existing failures separately. Inspect `/robots.txt` and the host sitemap index for zone coverage, including docs. Check origin and public URLs for redirect loops. |

## Recovery and remaining uncertainty

Record existing deployments and docs config before cutover. If the host route fails, revert the zone registration and redeploy the host or roll it back; the old docs tenant continues serving. Roll the child back independently. If rolling the whole launch back, restore docs canonical settings to the tenant URL so they do not point at an unavailable route.

Vercel and Blode.md access verified. No DNS change was needed. The child uses `https://taste-lint.vercel.app`; the host registration is in `../blode-co/apps/web/lib/zones.ts`. Keep both repositories' changes together when committing so a later Git deployment retains the route.

Skills used for this plan: planning (create, plan-quality-rubric); ui-design (Direction, marketing-ui, aesthetic-direction, design-in-code); product-design (shape, rules, product-judgment, surfaces); copywriting (Write, frameworks, page-types). Implementation should load ui-design Build guidance and ui-verification, plus the applicable Vercel and Blode.md deployment instructions.

## Completion record

- Public landing: https://blode.co/taste-lint
- Public docs: https://blode.co/taste-lint/docs
- Vercel child deployment: `https://taste-lint-b0345z3x0-blode.vercel.app`, project `taste-lint`, root `apps/web`, Node 24. Host: `https://blode-e2lfqselg-blode.vercel.app`, project `blode-co`.
- Blode.md publication: `80f1cc3a-8d3d-4b6b-9791-6e76b4914e7d`.
- `npm run verify:full` passes in an isolated checkout containing the launch changes: 226 CLI tests, six proxy tests (seven after the final discovery-header regression test), both builds, both typechecks, package smoke test, and 168 active rules. The shared checkout contains separate audit work in progress, so its full-suite result is not attributed to this launch.
- Changesets recognizes the CLI workspace. A version rehearsal in the isolated checkout bumps it to 0.0.12; rebuilding and installing the packed artifact confirms the CLI reports the package version. The working repository remains at 0.0.11; no npm release was requested.
- Public browser checks at 320, 375, and 1440 pixels: no horizontal overflow, no automated WCAG A/AA violations, no runtime errors. Clipboard success and manual-copy recovery pass. Evidence is in `results/web/` (ignored).
- Public HTTP checks pass for landing, docs, Quickstart, markdown/llms exports, search, both sitemaps, share image, and 404/noindex responses. The host sitemap includes both zone sitemaps. The host zone-conventions checker passes.
- Search uses a build-time index from the docs navigation because the published tenant has no search endpoint. Mobile docs search selection and theme switching pass with no runtime errors. Docs runtime assets require the rewritten Turbopack chunk prefix. Preserve serialized React arrays when transforming preconnect hints.
- Next.js 16.3 applies basePath to generated image metadata; metadataBase is the bare public host to avoid a doubled zone prefix.
- No commits or pushes were made. Deployments were published directly from local checkouts; the parent deployment used an isolated checkout containing only the zone registration.

- Use the primary `taste-lint.vercel.app` origin: Vercel adds an HTTP `X-Robots-Tag: noindex` to the secondary team alias. Public indexing checks must inspect response headers as well as HTML metadata.
- Mobile docs menu, copying page markdown, search-result navigation, and theme switching pass. At 200% text size with a 720px viewport, the landing page still has no horizontal overflow.

## User correction, 2026-09-21

The user rejected the reused docs logo, the green palette, and low-value explanatory copy. Removed the title mark and the Node/Gateway note, shortened the description, and cut the explanatory paragraphs around the actual lint result. Installed the Blode UI design system and button, using Blode Icons for copy feedback and navigation. The public favicon is a plain T; docs logos are text wordmarks. The share card now matches Glide colours and has no borrowed mark. The Ghostwriter rewrite uses the user's soul and README register.

Revision verification: web types, seven proxy tests, production build, clipboard success/failure, and automated accessibility checks at 320, 375, and 1440 pixels pass. No overflow or browser errors were observed.

## Jev positioning

User requested a stronger pitch for Jev by TypeSafe AI. The hero now leads its description with that attribution and links to the official System One docs. It explains contextual checks for canned phrasing and vague praise, with a probability for each AI finding. Search, social, and software-schema descriptions use the same positioning. Product capabilities were checked against the current TypeSafe System One docs and existing copywriting rules.

## Hero audience tabs

Adapted the line-tab hero pattern from `../stratasync/apps/web/components/landing/hero-install.tsx`: For humans is selected initially; For agents adds `--agent` to the init command so it also writes AGENTS.md guidance. Both panels stay in server-rendered HTML. Copy feedback resets when switching tabs. Arrow keys move focus and Enter activates, matching the source Base UI default. Verified correct clipboard values, one exposed panel, no overflow, and no automated accessibility violations at 320, 375, and 1440 pixels.
