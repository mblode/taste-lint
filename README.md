<div align="center">

# [Taste Lint](https://blode.co/taste-lint)

**Catch AI slop before you ship.**

Scan your project with [Jev by TypeSafe AI](https://docs.typesafe.ai/introduction).

<p align="center">
  <a href="https://www.npmjs.com/package/taste-lint"><img alt="npm version" src="https://img.shields.io/npm/v/taste-lint?style=flat&colorA=000000&colorB=000000" /></a>
  <a href="https://github.com/mblode/taste-lint/blob/main/LICENSE.md"><img alt="MIT license" src="https://img.shields.io/npm/l/taste-lint?style=flat&colorA=000000&colorB=000000" /></a>
</p>

</div>

## Install

```bash
npx taste-lint@latest init
```

Node 24.11+. Init adds a `taste` script.

## Quickstart

Get a [Vercel AI Gateway key](https://vercel.com/docs/ai-gateway/authentication-and-byok/api-keys):

```bash
export AI_GATEWAY_API_KEY="your-vercel-ai-gateway-key"
npm run taste
```

No account or config. Checks bill your key and cache between runs. `--dry-run` previews cost.

## What it checks

- **Product interfaces:** error recovery, empty states, confirmation labels, unsupported claims, CSS transitions.
- **Whole pages:** typography, copy, interaction, motion, SEO, via `scan guide`.
- **Text:** Markdown, MDX and READMEs (`--profile writing`), AGENTS.md and skills (`--profile instructions`).

Rules from [Agent Skills](https://github.com/mblode/agent-skills) and [Taste Training](https://blode.co/taste-training). Code measures, Jev judges meaning, uncalibrated rules stay advisory.

`--profile all` runs everything. Source checks never replace opening the page.

## Docs

<p>
  <a href="https://blode.co/taste-lint/docs">
    <img alt="Read the docs" src="https://raw.githubusercontent.com/mblode/taste-lint/main/.github/assets/documentation.svg" width="200" height="48" />
  </a>
</p>

## License

MIT

---

Crafted by [<img src="https://blode.co/avatar-circle.png" width="20" align="top" alt="" />](https://blode.co) [Matthew Blode](https://blode.co)
