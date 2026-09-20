---
"taste-lint": patch
---

Preserve applicability, exceptions, required evidence, and verification for all 36 raw-source review checks. Mark regex matches as candidates rather than confirmed defects, keep them out of defect-accuracy metrics and automatic failures, and carry their review procedures into reports and agent handoffs. Detect changes to reviewed skill documents and generate new rule ports as drafts.

Abstain when semantic checks lack comparison context or exceed the evidence budget, including questions without regex filters. Split batches when combined context would truncate evidence.
