# Documentation project instructions

## About this project

- This is the [Blode.md](https://blode.md) site for taste-lint, published at https://taste-lint.blode.md
- Public pages are MDX files with YAML frontmatter next to `docs.json`
- Run `npx blodemd dev docs --no-open` to preview locally
- Run `npx blodemd validate docs` before publishing

## Terminology

- Use "taste-lint" for the package and CLI
- Use "Jev" for TypeSafe judgments
- Use "scan" for the user-facing command, "lint" only when referring to the evaluator itself
- Use "act" and "review" for bands, never as synonyms for severity

## Style preferences

- Use active voice and second person ("you")
- Keep sentences concise and task-oriented
- Use sentence case for headings
- Bold UI labels: Click **Settings**
- Use code formatting for file names, commands, paths, JSON fields, and code references
- No em dashes

## Content boundaries

- Public nav is only the groups in `docs.json`: Getting Started and Guides
- Keep `audits/`, `evaluations/`, `plans/`, and `reviews/` out of public navigation and `llms.txt`. They are research notes. Mark them `hidden: true` in frontmatter. Do not add them to `navigation.groups`
- Keep the ALL-CAPS `.md` guides for in-repo links (`docs/DESIGN.md`, `docs/SCANS.md`). They are not the public guides. Prefer the matching MDX pages, and keep `hidden: true` on the `.md` copies
- Do not document unpublished provider payloads or raw error bodies

## Workflow reminders

- Content lives in MDX files next to `docs.json`
- Update `docs.json` when navigation or branding changes
- Prefer concise, task-oriented documentation
- Run `npx blodemd validate docs` before publishing
