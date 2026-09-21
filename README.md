<div align="center">

# [Taste Lint](https://blode.co/taste-lint)

**Catch AI slop before you ship.**

Design review on every commit, from the [Taste Training](https://blode.co/taste-training) and [Agent Skills](https://github.com/mblode/agent-skills) rules.

<p align="center">
  <a href="https://www.npmjs.com/package/taste-lint"><img alt="npm version" src="https://img.shields.io/npm/v/taste-lint?style=flat&colorA=000000&colorB=000000" /></a>
  <a href="https://github.com/mblode/taste-lint/blob/main/LICENSE.md"><img alt="MIT license" src="https://img.shields.io/npm/l/taste-lint?style=flat&colorA=000000&colorB=000000" /></a>
</p>

</div>

## Install

```bash
npx taste-lint@latest init
```

Node 24.11+. Init adds a `taste` script that runs `taste-lint lint --profile product`.

## Quickstart

```bash
npm run taste -- --dry-run
```

No key, no account. The mechanical checks run and fail the build on what they find.

To add the Jev review notes, get a [Vercel AI Gateway key](https://vercel.com/docs/ai-gateway/authentication-and-byok/api-keys):

```bash
export AI_GATEWAY_API_KEY="your-vercel-ai-gateway-key"
npm run taste
```

Checks bill your key and cache between runs. `--dry-run` previews the cost first.

## What it checks

- **Motion:** `transition-all`, ease-in, linear easing, transitions over 300ms, entrances from scale zero.
- **Copy:** “click here” links, “successfully” toasts, emoji in UI, Latinisms, nominalisations, anthropomorphism, sentences over 25 words.
- **Typography:** straight quotes, three-dot ellipses, hyphens for dashes, `x` for ×, missing space before a unit, light weights on small body text, uppercase without tracking.
- **Under review:** vague errors, empty states with no action, bare “Confirm” labels, claims with nothing to check, missing error states. These go to [Jev by TypeSafe AI](https://docs.typesafe.ai/introduction), which answers with a probability.

22 checks block. 122 more report and never fail a run. They are pattern ports nobody has yet watched on a real codebase, and Jev questions no labelled corpus has yet promoted. See [usage](https://blode.co/taste-lint/docs/usage) for how promotion works.

Profiles scope a run: `product` (tsx, jsx, css), `writing` (md, mdx, README), `instructions` (AGENTS.md, skills, plans), `all`.

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
