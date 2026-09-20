---
"taste-lint": patch
---

Stop flagging CSS token references, calculations, asset URLs and relative layout expressions as hardcoded arbitrary values. Keep literal values advisory with a contextual review hint. Make punctuation, sentence length and line-height preferences advisory in product scans while preserving strict lint policy. Respect explicit font-size overrides, abstain on unresolved size variables, and avoid reporting slow transitions for transition-none. Bind scan baselines to the taste-lint version so changed analysis cannot imply source fixes.
