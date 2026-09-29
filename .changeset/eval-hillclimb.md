---
"taste-lint": minor
---

Add eval diagnostics: `eval consistency` (grader flip rate with the answer cache bypassed), a headroom warning when a rule's precision or recall lower bound already clears 95%, a mechanical guard in `tune ab` against rule text that quotes a corpus item, per-case JSONL, and `eval --html` for a static offline report.
