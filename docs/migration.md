# Migration

Use `/lab-migrate` when a research repository already has scripts, plans, results, configs, branches, or paper assets and was not created with LabLock.

Migration is intentionally staged. The goal is to put guardrails around future work first, while also creating LabLock experiment nodes for old plans and experiments that should appear in dashboards, audits, synthesis, and paper workflows.

## Principles

- Start read-only.
- Preserve existing directory structure.
- Do not rename, move, delete, or rewrite legacy files during discovery.
- Initialize with `ci.mode=warn-only`.
- Convert selected old plans/experiments/runs into LabLock mirror nodes so dashboards have a real source of truth.
- Lock one active experiment with stronger invariants first; imported legacy nodes can start as lower-confidence mirrors.
- Switch to `enforce` only after audits are clean and the user has dogfooded the flow.

## Recommended Flow

1. Run `/lab-migrate`.
2. Let it write `reviews/migration-YYYY-MM-DD.md` or `LABLOCK_MIGRATION_PLAN.md`.
3. Review the inventory and the Legacy Experiment Import Table.
4. If approved, run LabLock bootstrap in warn-only mode.
5. Import selected old plans/experiments/runs with `lablock migrate-node`.
6. Use `/lab-exp-init` to create or refine the first strongly controlled active experiment.
7. Run `lablock dashboard` and `/lab-audit` after the first LabLock migration commit.
8. Gradually confirm low-confidence imported nodes when they matter for synthesis, paper writing, or reproducibility.

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
- Legacy Experiment Import Table
- candidate first active experiment
- suggested config/file invariants
- legacy material that should remain unmanaged initially
- exact next commands

## Legacy Experiment Import Table

The import table is the bridge between an old research repo and LabLock's experiment model:

```markdown
| Import? | Source path | Source type | Proposed shortname | Proposed status | Parent | Hypothesis / summary | Confidence | Notes |
|---|---|---|---|---|---|---|---|---|
| yes | runs/2026-05-01-baseline | run | baseline | done | none | Baseline reproduces reference accuracy. | high | result table exists |
| yes | notes/ablation-plan.md | plan | ablation-plan | planned | exp-001 | Planned ablation of the contrastive loss weight. | medium | needs config confirmation |
```

Approved rows are imported with:

```bash
lablock migrate-node "<shortname>" \
  --source="<legacy-path>" \
  --source-type="<plan|experiment|run|result|unknown>" \
  --status="<planned|running|done|killed|superseded>" \
  --hypothesis="<hypothesis-or-conservative-summary>" \
  --confidence="<low|medium|high>" \
  --parent="<exp-NNN|none>" \
  --stage
```

This creates a real LabLock node:

- `experiments/<exp-id>-<shortname>/hypothesis.md`
- `experiments/<exp-id>-<shortname>/config.yaml`
- `experiments/<exp-id>-<shortname>/results.md`
- `.lablock/locks/<exp-id>.scope.lock`

The original legacy source stays in place. The LabLock node references it and is what dashboard/audit tools read.

## What It Does Not Do

- It does not move legacy experiment folders.
- It does not blindly import every old artifact.
- It does not claim low-confidence imports are scientifically verified.
- It does not enable strict CI.
- It does not set `current-exp` until a real controlled experiment is created.
- It does not clean the repo; use `/lab-tidy` later.

## After Migration

The first useful milestone is not "all old work is converted". It is:

```text
selected legacy experiments appear as LabLock nodes,
one active experiment has a valid scope.lock,
the dashboard has real data,
commits are guarded by hooks,
and drift has an accountable path through fork/override/revert.
```
