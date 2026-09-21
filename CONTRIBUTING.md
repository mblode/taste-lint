# Development

The npm workspace uses Turborepo to build the CLI package in `packages/cli` and the landing page in `apps/web`. CLI source and rules remain in `src/` and `data/`; the build stages a self-contained npm package. Changesets versions `packages/cli/package.json`.

```bash
npm ci
npm run dev:web       # landing page at localhost:3000/taste-lint
npm run build         # CLI and web
npm run verify:full   # lint, types, tests, builds, and packed CLI smoke test
```

Use `npm run build:cli` or `npm run build:web` to build one target. Documentation source stays in `docs/`.
