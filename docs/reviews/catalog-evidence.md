---
hidden: true
---

# Broader catalog evidence procedures

The catalog has 168 shipped rules: 113 YAML rules and 55 code rules. This pass addresses all 36 raw-source searches without a semantic or code verifier. Those searches previously inherited titles such as "Focus not restored" or "useFormStatus misuse" even when their regex only located a dialog or hook.

Each now carries a reviewed procedure: applicability, exceptions, required evidence, and a specific verification step. Examples include primitive-owned focus restoration, child components using useFormStatus, shared accessibility wrappers, inherited route boundaries, dynamic style values, and deliberately fixed brand colors. The 35 procedures sourced from agent-skills record the full source document's digest. Source drift requires reviewing the procedure, even if the regex stays unchanged. The inline-style procedure requires explicit project policy rather than assuming every inline style is wrong.

A source match is a candidate, never proof of a defect. It stays advisory, cannot be promoted through tuning, and remains unknown in defect evaluation. Its probability only describes matching the search pattern. JSON and SARIF mark this distinction; terminal output and agent handoffs preserve the evidence and verification requirements. Handoffs omit defect confidence for candidates. New automatic ports remain drafts until their procedures are reviewed.

The semantic catalog also shares a stricter evidence gate: missing section or comparison context, dynamic target copy requiring section evidence, and oversized state abstain. This applies to questions with or without a regex filter. Individually complete questions are split when combining them would truncate their state.

Validation covers valid child form hooks and primitive focus defaults, incomplete procedures, tuning overlays, evaluation abstention for both matches and misses, report exports, context limits, source-exception drift, and draft generation. Full verification includes packed-consumer checks and the source-drift check.

Offline scans selected these 36 candidates on Donebear and blode-co. Donebear returned 262 candidates; blode-co returned 27. Every result carried a review procedure, every result was advisory, and neither scan made model requests. These counts validate transport and policy, not the accuracy of the candidates. Neither target repository was edited.

The other 132 rules retain their existing semantic questions or deterministic checks. This change does not establish their real-world precision, independently validate runtime behavior, or expand the six-rule product default. Candidate procedures guide the next investigation; they are not themselves completed verification.
