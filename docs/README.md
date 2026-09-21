# Taste Lint docs

Public guides for [taste-lint](https://www.npmjs.com/package/taste-lint): [blode.co/taste-lint/docs](https://blode.co/taste-lint/docs).

This folder is the Blode.md root (`docs.json` lives here). Git deploys from repo `mblode/taste-lint` with docs path `docs`.

Canonical public guides are the MDX files listed in `docs.json` navigation. The ALL-CAPS `.md` files are kept for in-repo links and stay hidden from the published nav and `llms.txt` index.

`audits/`, `evaluations/`, `plans/`, and `reviews/` are research notes. They are not product docs. Do not add them to public navigation.

## Commands

```bash
npx blodemd dev docs --no-open
npx blodemd validate docs
```

After merge, reconnect the GitHub App at https://blode.md/app/taste-lint/git with branch `main` and docs path `docs`.
