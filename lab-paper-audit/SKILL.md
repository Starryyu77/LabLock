---
name: lab-paper-audit
description: |
  Verify every paper draft claim is backed by claims.md evidence. Triggers: "audit paper", "claim coverage", "before submission".
disable-model-invocation: false
related-skills:
  - lab-paper-write
---

# /lab-paper-audit

Use this before submission or before sharing a draft externally.

## Inputs

Read:

1. `paper/drafts/*.md`
2. `claims.md`
3. `paper/claims-to-evidence.md`
4. Relevant experiment results and derivations.

## Audit

For each claim-like sentence:

1. Match it to a claim ID.
2. Check evidence exists.
3. Check claim strength is sufficient for the wording.
4. Flag unsupported, overstated, stale, or ambiguous statements.

## Output

Write `paper/audit-report-YYYY-MM-DD.md` with severity levels:

1. Blocker: unsupported or false.
2. Major: overstated relative to evidence.
3. Minor: needs citation or wording cleanup.
4. Pass: supported.
