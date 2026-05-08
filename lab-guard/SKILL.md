---
name: lab-guard
description: |
  Resolve SCOPE-DRIFT detected by pre-commit. Triggers: "drift detected", "scope drift", "guard".
  User-invoked only: this skill may create decisions, fork experiments, update locks, or unstage changes.
disable-model-invocation: true
related-skills:
  - lab-fork
  - lab-exp-init
---

# /lab-guard

Use this when a commit is blocked by LabLock scope drift.

## Diagnose

1. Read `.git/lablock-commit-meta.json` if it exists.
2. Re-run `lablock-verify-scope --exp=<current-exp> --source=staged --json`.
3. Show the user the exact drift: config key expected/actual values and file hash mismatches.
4. Restate the current experiment hypothesis and controlled changes.

## Present Choices

Offer exactly these paths:

1. Fork: the drift changes the experiment meaning. Run `/lab-fork`.
2. Override: the drift is intentional but should remain an auditable exception. Run `lablock override`.
3. Update lock: the original lock was wrong; update the lock and write a `scope-update` decision.
4. Revert/unstage: the drift was accidental; unstage or revert only the offending changes after confirmation.

## Execute Selected Path

For override:

```bash
lablock override --exp=<exp-id> --reason="<specific reason>"
```

For fork:

```bash
lablock fork --from <exp-id> --shortname <new-shortname> --reason "<specific reason>" --stage
```

For lock update, require a decision file whose frontmatter binds `type`, `exp_id`, and `change_id`.

## Verify

Re-run the original commit without `--no-verify`. If it still fails, show the new blocking condition rather than bypassing it.
