---
name: lab-audit
description: |
  Project-level health check. Triggers: "audit", "project health", "weekly check", "what's stale".
disable-model-invocation: false
related-skills:
  - lab-tidy
---

# /lab-audit

Use this for read-only project health reporting. Never modify files as part of audit unless the user explicitly asks for a separate tidy/apply step.

## Modes

Support:

1. Full audit.
2. `--formalism`: stale formalism references.
3. `--coverage`: claim/evidence gaps.
4. `--orphans`: unindexed markdown files.
5. `--weekly`: recent activity digest.

## Checks

Run or summarize:

1. `lablock-frontmatter-check --strict`
2. `lablock-verify-scope --all-active --source=head --json`
3. `lablock-coverage --json`
4. `lablock-orphans --json`
5. `lablock-drift-audit --json`
6. Recent commits with `LabLock-Change` trailers.

## Output

Write `reviews/audit-YYYY-MM-DD.md` with:

1. Executive status.
2. Active experiments.
3. Drift events.
4. Claim coverage gaps.
5. Stale handoffs.
6. Recommended next actions.

Keep the report concrete: paths, experiment IDs, change IDs, and exact commands for follow-up.
