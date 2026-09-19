---
"slop-cop": patch
---

Rule files carry only what cannot be derived: `tier`, `domain`, `question.type`, `fix.mode`, `related`, `severityOverrides`, `source.tier` and `preconditions.element` are gone, `scope` is optional for every unit kind but `source` (include follows the unit kinds, tests and stories are always excluded), and severity is `major` or `minor`. The runtime `Rule` still exposes tier, domain and a resolved scope.
