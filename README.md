<div align="center">

# Taste Lint

**Catch AI slop before you ship.**

Scan your project with local checks and [Jev by TypeSafe AI](https://docs.typesafe.ai/introduction).

<p align="center">
  <a href="https://www.npmjs.com/package/taste-lint"><img alt="npm version" src="https://img.shields.io/npm/v/taste-lint?style=flat&colorA=000000&colorB=000000" /></a>
  <a href="https://github.com/mblode/taste-lint/blob/main/LICENSE.md"><img alt="MIT license" src="https://img.shields.io/npm/l/taste-lint?style=flat&colorA=000000&colorB=000000" /></a>
</p>

</div>

## Install

```bash
npx taste-lint@latest init
```

Requires Node 24.11 or later. Run from your project directory to install locally and add check scripts.

## Quickstart

Create a [Vercel AI Gateway key](https://vercel.com/docs/ai-gateway/authentication-and-byok/api-keys). From your project directory, set your key and run:

```bash
export AI_GATEWAY_API_KEY="your-vercel-ai-gateway-key"
npm run taste
```

No account or config for taste-lint. AI checks send selected text and rule context to Vercel AI Gateway, billed to your account. Answers are cached for repeat runs.

Run `npm run check:taste` for local checks without a key. Use your package manager in place of npm. Add `--agent` to init for agent instructions, or `--dry-run` to preview setup.

## What it checks

- **Product interfaces:** copy, typography, interaction, and motion in JSX, TSX, and CSS.
- **Writing:** Markdown, MDX, and READMEs with `--profile writing`.
- **Agent instructions:** AGENTS.md and skills with `--profile instructions`.

Rules draw on [Agent Skills](https://github.com/mblode/agent-skills) and [Taste Training](https://blode.co/taste-training). Local checks handle measurable rules. Jev judges meaning and returns probabilities. Uncalibrated AI rules stay advisory; active findings can fail a run.

## Useful options

| Option              | What it does                                         |
| ------------------- | ---------------------------------------------------- |
| `--dry-run`         | Preview scope and estimated cost without model calls |
| `--mechanical-only` | Run local checks without an API key                  |
| `--output json`     | Save findings for scripts and agents                 |
| `--output sarif`    | Export findings for code review tools                |

Run `taste-lint scan --help` for all options. See the [scan guide](https://github.com/mblode/taste-lint/blob/main/docs/SCANS.md), [usage reference](https://github.com/mblode/taste-lint/blob/main/docs/USAGE.md), and [changelog](https://github.com/mblode/taste-lint/blob/main/CHANGELOG.md) for more.

## License

MIT

---

Crafted by [<img src="https://blode.co/avatar-circle.png" width="20" align="top" alt="" />](https://blode.co) [Matthew Blode](https://blode.co)
