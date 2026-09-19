# slop-cop

Taste as a linter. slop-cop turns the copywriting and typography rules from [agent-skills](https://github.com/mblode/agent-skills) and [taste-training](https://github.com/mblode/taste-training) into checks that run on every file: mechanical where a regex or a real value decides, and a calibrated probability from [TypeSafe Jev](https://typesafe.ai) where a judgement is needed.

```bash
npx slop-cop lint src content --dry-run        # units, requests, estimated cost
TYPESAFE_API_KEY=... npx slop-cop lint src content
npx slop-cop lint --url https://example.com    # computed styles via style-capture; runs npx style-capture, needs network and a Playwright Chromium
npx slop-cop eval                              # precision, recall, calibration per rule
```

Findings carry a severity (how bad if real) and a band (how sure): `act` fails the run, `review` is a note, below that is silent. Every rule traces to the line of the skill or lesson it came from.

Requires Node 24. Set `TYPESAFE_API_KEY` for Jev-backed rules; `--mechanical-only` needs no key.
