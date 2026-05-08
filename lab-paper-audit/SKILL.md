---
name: lab-paper-audit
description: |
  Verify every paper draft claim is backed by claims.md evidence. Triggers: "audit paper", "claim coverage".
disable-model-invocation: false
related-skills:
  - lab-paper-write
---

# /lab-paper-audit

Scan `paper/drafts/`, extract claim-like sentences, match to `claims.md`, and write an audit report.
