---
"taste-lint": minor
---

Add a `code` profile that reviews source, tests and CI for performance, data access (N+1 queries, unbounded reads, writes without a transaction), test value and gaps, dead code, code quality, telemetry and sensitive data, and search-visibility rules for Next.js pages under `product`. Every new rule reports and never fails a run. A whole file too long for one Jev question is now judged on the lines around its candidate match instead of reporting unknown.
