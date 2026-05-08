---
name: lab-audit
description: |
  Project-level health check. Triggers: "audit", "project health", "weekly check".
disable-model-invocation: false
related-skills:
  - lab-tidy
---

# /lab-audit

Aggregate frontmatter, scope, coverage, orphan, drift, and weekly status checks into `reviews/audit-YYYY-MM-DD.md`.
