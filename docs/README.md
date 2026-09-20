# Taste Lint docs

Public guides for [taste-lint](https://www.npmjs.com/package/taste-lint), published at [taste-lint.blode.md](https://taste-lint.blode.md).

This folder is the Blode.md root (`docs.json` lives here). Git deploys from repo `mblode/taste-lint` with docs path `docs`.

## Public pages

- [Introduction](https://taste-lint.blode.md)
- [Quickstart](https://taste-lint.blode.md/quickstart)
- [Scans](https://taste-lint.blode.md/scans)
- [Usage](https://taste-lint.blode.md/usage)
- [Design](https://taste-lint.blode.md/design)
- [TypeSafe](https://taste-lint.blode.md/typesafe)
- [Skill packs](https://taste-lint.blode.md/skill-packs)

Canonical public guides are the MDX files listed in `docs.json` navigation. The ALL-CAPS `.md` files are kept for in-repo links and stay hidden from the published nav and `llms.txt` index.

`audits/`, `evaluations/`, `plans/`, and `reviews/` are research notes. They are not product docs. Do not add them to public navigation.

## Commands

```bash
npx blodemd dev docs --no-open
npx blodemd validate docs
```

After merge, reconnect the GitHub App at https://blode.md/app/taste-lint/git with branch `main` and docs path `docs`.
