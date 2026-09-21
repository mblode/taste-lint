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

Requires Node 24.11 or later. Run it from your project directory. Init installs locally and adds a scan script.

## Quickstart

Create a [Vercel AI Gateway key](https://vercel.com/docs/ai-gateway/authentication-and-byok/api-keys). Then:

```bash
export AI_GATEWAY_API_KEY="your-vercel-ai-gateway-key"
npm run taste
```

No taste-lint account or config. AI checks send selected text and rule context to Vercel AI Gateway, billed to your account. Repeat runs reuse cached answers.

Use your package manager in place of npm. Pass `--agent` to init for agent instructions, or `--dry-run` to preview setup.

## What it checks

- **Product interfaces:** error recovery, empty states, confirmation labels, unsupported claims, and broad CSS transitions.
- **Whole pages:** agent-assisted UI, typography, copy, interaction, motion and SEO audits. Run `taste-lint scan guide` for the workflow.
- **Writing:** Markdown, MDX, and READMEs with `--profile writing`.
- **Agent instructions:** AGENTS.md and skills with `--profile instructions`.

Rules come from [Agent Skills](https://github.com/mblode/agent-skills) and [Taste Training](https://blode.co/taste-training). Local checks handle measurable rules. Jev judges meaning and returns probabilities. Uncalibrated AI rules stay advisory. Active findings can fail a run.

The default scan focuses on six checks and shows five prioritized groups. Use `--only <rule-id>` for a specific check or `--profile all` for the full catalog. Source checks do not replace reviewing the running interface.

## Docs

<p>
  <a href="https://blode.co/taste-lint/docs">
    <img alt="Read the docs" src="https://raw.githubusercontent.com/mblode/taste-lint/main/.github/assets/documentation.svg" width="200" height="48" />
  </a>
</p>

`taste-lint scan --help` lists every option. `--dry-run` previews scope and cost. `--output json` and `--output sarif` are for scripts and code review.

## License

MIT

---

Crafted by [<img src="https://blode.co/avatar-circle.png" width="20" align="top" alt="" />](https://blode.co) [Matthew Blode](https://blode.co)
