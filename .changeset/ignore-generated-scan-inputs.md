---
"taste-lint": patch
---

Respect Git-ignored artifacts during file discovery and skip excluded paths before inspecting them. This prevents build caches and dangling links in staging directories from overwhelming or aborting repository scans.
