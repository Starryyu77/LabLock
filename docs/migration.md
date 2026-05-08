# Migration

Use `/lab-migrate` when a research repository already has scripts, plans, results, configs, branches, or paper assets and was not created with LabLock.

Migration is intentionally staged. The goal is to put guardrails around future work first, then gradually make old work auditable.

## Principles

- Start read-only.
- Preserve existing directory structure.
- Do not rename, move, delete, or rewrite legacy files during discovery.
- Initialize with `ci.mode=warn-only`.
- Lock one active experiment first; do not backfill every historical experiment in one pass.
- Switch to `enforce` only after audits are clean and the user has dogfooded the flow.

## Recommended Flow

1. Run `/lab-migrate`.
2. Let it write `reviews/migration-YYYY-MM-DD.md` or `LABLOCK_MIGRATION_PLAN.md`.
3. Review the inventory and identify one active experiment candidate.
4. If approved, run LabLock bootstrap in warn-only mode.
5. Use `/lab-exp-init` to create the first controlled experiment.
6. Use `/lab-audit` after the first LabLock commit.
7. Gradually migrate old experiments only when they matter for synthesis, paper writing, or reproducibility.

## What `/lab-migrate` Does

It classifies existing files into:

- control-plane docs and plans
- shared code
- legacy experiments
- active experiment candidates
- artifacts such as checkpoints, logs, datasets, and outputs
- unknown files needing user confirmation

It then writes a migration plan with:

- suggested modules
- warn-only CI recommendation
- candidate first experiment
- suggested config/file invariants
- legacy material that should remain unmanaged initially
- exact next commands

## What It Does Not Do

- It does not move legacy experiment folders.
- It does not create scope locks for every old experiment.
- It does not enable strict CI.
- It does not set `current-exp` until a real controlled experiment is created.
- It does not clean the repo; use `/lab-tidy` later.

## After Migration

The first useful milestone is not "all old work is converted". It is:

```text
one active experiment has a valid scope.lock,
commits are guarded by hooks,
and drift has an accountable path through fork/override/revert.
```
