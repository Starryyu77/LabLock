---
name: lab-tidy
description: |
  Audit and tidy the repository. Triggers: "tidy repo", "repo health", "archive old experiments", "clean up branches".
disable-model-invocation: false
related-skills:
  - lab-audit
---

# /lab-tidy

Use this when the repository has accumulated stale branches, old experiments, orphan files, or oversized artifacts.

## Default Mode

Default to dry-run. Do not delete, move, archive, or rename files unless the user explicitly asks for `--apply` and confirms each item.

## Inspect

Check:

1. Git branch state and stale tracking branches.
2. Old experiments past `git.archive_after_days`.
3. Oversized non-LFS files.
4. Orphan markdown files via `lablock-orphans`.
5. Expired handoffs without incoming responses.
6. Dirty generated projections: `MAP.md` and `experiments/matrix.md`.

## Report

Group findings by:

1. Safe automatic cleanup.
2. Needs user decision.
3. Destructive or irreversible.
4. No action recommended.

## Apply Mode

When applying, ask item by item. Show exact path, command, and rollback risk before acting.

End by recommending `/lab-audit` for a read-only health report if the user wants documentation.
