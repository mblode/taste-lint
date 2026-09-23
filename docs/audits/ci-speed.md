---
title: CI pipeline timings
hidden: true
---

Measured 2026-09-24. Wall-clock is push to last job complete, from the GitHub run and job API. The repository is public, so runner minutes cost nothing; wall-clock is the only number that matters here.

## Before

20 successful runs of `ci.yml` (all branches), ending with run 35808297094.

| Path                  | Median | p90  | Range        |
| --------------------- | ------ | ---- | ------------ |
| Run (one `build` job) | 1:22   | 1:31 | 0:57 to 3:09 |

Run 35808297094, `build` 1:29: setup and checkout 3s, `npm ci` 15s, Verify 65s, agent-skills checkout and `port-rules --check` 3s. Inside Verify:

| Step | Seconds | Class |
| --- | --- | --- |
| `ultracite check` | 2 | execution |
| `turbo run build` (tsdown, then `next build --webpack`) | 28 | execution, 25 of it the web app |
| `turbo run typecheck` | 2 | execution |
| `turbo run test` (web `node --test` alongside Vitest: 14.2s, tests 66%, import 26%) | 15 | execution |
| `test:package` | 5 | execution |
| `rules check` and `taste` | 3 | execution |

The critical path was the one job. The Next.js build and web tests (about 40s) had nothing to do with the CLI checks, yet ran in series with them.

## Changes

- Split `verify:full` into `verify:cli` (check, CLI build, types, tests, packed smoke test, rules check, taste) and `verify:web` (Next build, web types, web tests). `verify:full` runs both, so local coverage is unchanged.
- CI runs them as two parallel jobs, `cli` and `web`. Changeset status and `port-rules --check` stay in `cli`. The web job uses a shallow checkout; only changeset status needs history.

Predicted: the run takes the longer of the two jobs, each about 18s of setup plus its half. `web` is about 18 + 28 + 10 = 56s, `cli` about 18 + 35 + 4 = 57s. The run drops from 1:22 to about 1:00, and runner time rises by one setup (about 18s).

## After

Run 35908788242 on `main` (commit 88ea1aa), first attempt plus two re-runs:

| Attempt | Run  | `cli` | `web` | `web` queue |
| ------- | ---- | ----- | ----- | ----------- |
| 1       | 1:31 | 0:48  | 0:54  | 0:37        |
| 2       | 0:47 | 0:44  | 0:44  | 0:02        |
| 3       | 0:56 | 0:53  | 0:47  | 0:03        |

Median 0:56, down from 1:22. Observed saving: 26 seconds. Projected saving: 22 seconds. Confirmed. The first attempt waited 37s for a hosted runner; the other repositories on this account start three to five jobs within seconds, so the wait was provisioning, not a concurrency cap. Runner time rose from about 1:29 to 1:40 per run.

## Trend

| Week       | Test files | Median run | p90  |
| ---------- | ---------- | ---------- | ---- |
| 2026-09-21 | 36         | 1:22       | 1:31 |
| 2026-09-24 | 36         | 0:56       | 1:31 |

This is far under the five-minute point where an agent loop starts waiting on checks. Re-measure when the median passes 2:30 or the test count doubles.

## Not taken yet

- **Blacksmith runners** (`runs-on: blacksmith-4vcpu-ubuntu-2404`). Both jobs are CPU-bound: the web build takes 7 to 9s on a laptop and 25s on a hosted runner. Linear measured 34% faster with a third-party runner, and `tsc` 52% faster. Expected: both jobs drop to about 40s. Waits on Matthew installing the Blacksmith GitHub app (a free tier of 3,000 minutes a month covers this repository).
- **`.next/cache` restore.** A warm webpack cache saved 2 of 9 seconds locally, so about 5s on a runner, before paying for the restore. Not taken.
- **Dependency install** (15s per job). `setup-node` already caches `~/.npm`. Linear found a restored `node_modules` slower than a fresh install at their size; at ours, time it before trying.
- **Shallow checkout on `cli`.** `fetch-depth: 0` costs about 1s here, and changeset status needs `origin/main`. Not worth it.
