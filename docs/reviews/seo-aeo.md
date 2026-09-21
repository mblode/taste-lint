---
hidden: true
---

# Landing page SEO and AEO

Reviewed 2026-09-21 against the deployed landing page and seven published docs pages.

## Changes

- Search title identifies the UI and copy linter. The description explains the CLI and the issues it checks. Visible landing copy stays unchanged.
- Landing Open Graph metadata now names its canonical public URL.
- Software schema uses `softwareRequirements` for Node.js, not `operatingSystem`. Repository and npm identity links use `sameAs`; `codeRepository` belongs to `SoftwareSourceCode`. The application has a description and share image, and the page identifies it as its main entity.
- Landing response headers link to the existing docs index and full-text export for discovery.

## Verification

Web typecheck, seven proxy tests, and production build pass. Public checks cover HTML and HTTP indexing directives, canonical and Open Graph URLs, JSON-LD, social image retrieval, docs exports, discovery headers, root crawler permissions, host sitemap coverage, and missing-page 404/noindex responses. Evidence: `results/web/seo-verified.json`.

The local page-audit doc belongs to concurrent work and was not published at review time. This deployment uses the seven-page published navigation from the isolated checkout. No Search Console access or field performance data was used, so this review does not measure search rankings, actual indexing, or Core Web Vitals.

## Parent routing regression

During verification, a Git deployment of `blode-co` at `ae34209` omitted the local Taste Lint zone. Cached HTML briefly worked while sitemap and export requests returned the host's 404. Restored only the zone entry on top of that deployed revision, keeping its newer zones. The registration remains in `../blode-co/apps/web/lib/zones.ts` and needs to be included in the parent repository's next Git deployment.

## References

- [Google's AI search guidance](https://developers.google.com/search/docs/appearance/ai-features): existing SEO fundamentals apply; special AI markup is not required.
- [Schema.org software requirements](https://schema.org/softwareRequirements)
- [Schema.org repository property](https://schema.org/codeRepository)
