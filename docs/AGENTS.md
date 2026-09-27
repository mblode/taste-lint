# Documentation project instructions

## About this project

- This is the [Blode.md](https://blode.md) site for taste-lint, published at https://blode.co/taste-lint/docs
- Public pages are MDX files with YAML frontmatter next to `docs.json`; update `docs.json` when navigation or branding changes
- Run `npx blodemd validate docs` before publishing. It is the reliable check: `npx blodemd dev --dir docs --no-open` (blodemd 0.2.2) starts but serves 500s, because its standalone runtime cannot resolve `typeset.css` or `@vercel/edge-config`

## Terminology

- Use "taste-lint" for the package and CLI
- Use "Jev" for TypeSafe judgments
- Use `lint` for the user-facing command; there is no `scan` command
- Use "act" and "review" for bands, never as synonyms for severity

## Style preferences

- Use active voice and second person ("you")
- Keep sentences concise and task-oriented
- Use sentence case for headings
- Bold UI labels: Click **Settings**
- Use code formatting for file names, commands, paths, JSON fields, and code references
- No em dashes, and no spaced hyphen standing in for one
- Point readers at https://blode.co/taste-lint/docs, not raw GitHub `docs/*.md` paths

## Content boundaries

- Public nav is only the groups in `docs.json`: Getting Started and Guides
- Keep `audits/`, `evaluations/`, `plans/`, and `reviews/` out of public navigation and `llms.txt`. They are research notes. Mark them `hidden: true` in frontmatter. Do not add them to `navigation.groups`
- Do not document unpublished provider payloads or raw error bodies
