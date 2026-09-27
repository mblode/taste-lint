# Development

The npm workspace uses Turborepo to build the CLI package in `packages/cli` and the landing page in `apps/web`. CLI source and rules remain in `src/` and `data/`; the build stages a self-contained npm package. Changesets versions `packages/cli/package.json`.

```bash
npm ci
npm run dev:web       # landing page at localhost:3000/taste-lint
npm run build         # CLI and web
npm run verify        # CI-equivalent gate: lint, types, tests, builds, packed CLI smoke test, rules check, taste (same as verify:full)
npm run verify:quick  # fast edit-loop gate: lint, types, tests, build, packed CLI smoke test (no rules check, no taste, no web)
```

Use `npm run build:cli` or `npm run build:web` to build one target. Documentation source stays in `docs/`.
