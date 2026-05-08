---
name: lab-migrate
description: |
  Adopt LabLock into an existing research repository. Use for "migrate existing repo", "adopt LabLock", "已有项目接入", or "legacy experiment repo". Inventories old plans/experiments, bootstraps LabLock after approval, and can import selected legacy work as real experiment nodes. User-invoked only.
disable-model-invocation: true
related-skills:
  - lab-init
  - lab-audit
  - lab-exp-init
  - lab-tidy
---

# /lab-migrate

You are helping an existing research repository adopt LabLock without breaking its current structure.

The repository may already contain scripts, plans, notebooks, configs, results, paper drafts, logs, and ad-hoc experiment folders. Treat that history as valuable. The migration goal is not to reorganize everything immediately; it is to establish LabLock guardrails around future work and gradually make the old work auditable.

Important: LabLock dashboards and audits only understand LabLock experiment nodes (`experiments/exp-NNN-*/hypothesis.md` plus `.lablock/locks/exp-NNN.scope.lock`). Existing plans and experiment folders should therefore be converted into **mirror nodes** when the user wants them visible in dashboards. The original files stay where they are; the LabLock node references them as legacy source material.

## Core Principle

Default to read-only discovery. Do not move, rename, delete, rewrite, or reclassify legacy files during inventory.

After the user approves a migration plan, create LabLock mirror nodes for selected legacy plans/experiments. A mirror node is a new `experiments/exp-NNN-*` folder and `.lablock/locks/exp-NNN.scope.lock` that points back to the legacy source path. It is not a rewrite of the old experiment.

Do not pretend this is a greenfield `/lab-init`. Existing repositories need a staged adoption path.

## Pre-flight

1. Verify this is a Git repository:

   ```bash
   git rev-parse --git-dir
   ```

2. Check whether LabLock is already initialized:

   ```bash
   test -f .lablock/config.yaml
   ```

   - If yes, this is not first migration. Switch to `/lab-audit` plus targeted cleanup.
   - If no, continue.

3. Check working tree:

   ```bash
   git status --short --branch
   ```

   If dirty, continue with read-only inventory but do not initialize until the user decides whether to commit/stash existing work.

4. Confirm the user wants a non-destructive adoption plan first.

## Phase 1: Inventory Existing Repository

Scan and summarize:

1. Top-level structure:

   ```bash
   find . -maxdepth 2 -type d \
     -not -path './.git*' \
     -not -path './node_modules*' \
     -not -path './.lablock*'
   ```

2. Likely research artifacts:

   - Plans: `plans/`, `docs/`, `notes/`, `README.md`, `PROJECT.md`
   - Experiments: `experiments/`, `runs/`, `outputs/`, `ablation/`, date-stamped folders
   - Scripts: `scripts/`, `src/`, `train.py`, `eval.py`, `*.sh`
   - Configs: `configs/`, `*.yaml`, `*.toml`, `*.json`
   - Results: `results/`, `metrics`, `wandb/`, `mlruns/`, CSV/JSON summaries
   - Paper assets: `paper/`, `manuscript/`, `*.tex`, `figures/`

3. Git history:

   ```bash
   git branch --all
   git log --oneline --decorate -20
   git tag --list
   ```

4. Risk surfaces:

   - Large files likely needing LFS.
   - Generated outputs mixed with source.
   - Multiple active experiment lines.
   - Existing branch protection or CI.
   - Current active work without a clean branch.

## Phase 2: Classify Legacy Material

Group files and directories into migration buckets:

1. `control-plane`: README, docs, plans, design notes, paper notes.
2. `shared-code`: source code and reusable scripts.
3. `legacy-experiment`: past experiment folders, old runs, old configs.
4. `active-experiment-candidate`: current work that should become the first LabLock-controlled experiment.
5. `artifact`: checkpoints, logs, generated outputs, datasets.
6. `unknown`: anything that cannot be confidently classified.

Do not infer scientific conclusions from filenames. If a result or plan cannot be read confidently, mark it `unknown` or `needs-user-confirmation`.

## Phase 3: Write Migration Plan And Import Table

Create a migration plan before changing project structure.

If `reviews/` exists, write:

```text
reviews/migration-YYYY-MM-DD.md
```

Otherwise write:

```text
LABLOCK_MIGRATION_PLAN.md
```

The report must include:

1. Current repository summary.
2. Existing artifact inventory.
3. Suggested LabLock modules: `gpu`, `data`, `agents`, `vision`, `lit`.
4. Recommended CI mode: usually `warn-only`.
5. A **Legacy Experiment Import Table**.
6. Proposed first active experiment to lock.
7. Candidate config invariants for that first active experiment.
8. Candidate file invariants for that first active experiment.
9. Legacy material that should remain unmanaged for now.
10. Risks before enabling strict enforcement.
11. Exact next commands, separated into "read-only", "initialize", "import legacy nodes", and "first controlled experiment".

The Legacy Experiment Import Table must use this structure:

```markdown
| Import? | Source path | Source type | Proposed shortname | Proposed status | Parent | Hypothesis / summary | Confidence | Notes |
|---|---|---|---|---|---|---|---|---|
| yes/no | runs/2026-05-01-baseline | run | baseline | done | none | Baseline reproduces reference accuracy. | high/medium/low | result table exists |
```

Rules:

- `Import?` defaults to `yes` only when the source clearly represents a plan, experiment, run, or result that should appear in the dashboard.
- `Proposed status` must be one of `planned`, `running`, `done`, `killed`, `superseded`.
- If the hypothesis is unclear, write a conservative summary such as "Legacy experiment imported from <path>; hypothesis requires confirmation." and set confidence `low`.
- Do not mark an imported node as high confidence unless the source file clearly states the hypothesis or result.

## Phase 4: Ask For Approval

Ask the user to choose one:

1. Plan only: stop after writing the migration report.
2. Bootstrap LabLock: run initialization in warn-only mode.
3. Bootstrap and import selected legacy experiment nodes.
4. Bootstrap, import selected legacy nodes, and lock one active experiment.

Do not proceed without explicit approval.

## Phase 5: Bootstrap LabLock

If the user approves initialization, run:

```bash
lablock init-project \
  --name="<project-name>" \
  --modules="<csv>" \
  --ci-mode=warn-only \
  --goal="<one-line goal inferred from existing docs>" \
  --hypothesis="<current broad hypothesis or TBD>"
```

Important:

- Do not use a nonexistent `--migrate` flag.
- Do not move old experiment folders.
- Do not set `.lablock/state/current-exp`.
- Do not enable CI enforcement.
- Do not require all legacy markdown files to become perfect immediately.

Then stage only the LabLock bootstrap files and the migration plan. If there are unrelated user changes, do not include them.

## Phase 6: Import Selected Legacy Nodes

If the user approves importing selected legacy material, create real LabLock experiment nodes for every approved row in the import table.

Use:

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

What this creates:

- `experiments/<exp-id>-<shortname>/hypothesis.md`
- `experiments/<exp-id>-<shortname>/config.yaml`
- `experiments/<exp-id>-<shortname>/results.md`
- `.lablock/locks/<exp-id>.scope.lock`

The created node includes:

- `tags: [imported, legacy, <source-type>, migration-reviewed|needs-confirmation]`
- a migration source section pointing to the original path
- migration metadata in `config.yaml`
- a minimal `scope.lock` so dashboards and audits can treat it as a real node

Important:

- Do not move or copy the original legacy source into the LabLock experiment folder.
- Import enough legacy experiments/plans to make the dashboard useful, especially current active lines and completed results that support claims.
- Do not invent scientific conclusions. Low-confidence imports are allowed, but must be tagged and described as needing confirmation.

After importing, refresh the dashboard:

```bash
lablock dashboard
```

## Phase 7: First Controlled Experiment

If the user wants to lock one active experiment after importing legacy nodes:

1. Choose exactly one active line from the import table or current working tree.
2. If it already has an imported node, refine that node or create a child experiment with `/lab-exp-init`.
3. If it has no imported node yet, use `/lab-exp-init` to create a new `exp-NNN` that represents the current active work.
4. Keep invariants modest:
   - A few stable config keys.
   - One or two important source files.
   - Optional probes only if they already exist.
5. Commit this as the first controlled LabLock experiment.

Old experiments stay in their original folders. The LabLock nodes are the dashboard/audit mirror.

## Final Report

End with:

```text
Migration status:
- Plan written: <path>
- LabLock initialized: yes/no
- Imported legacy nodes: <count and exp-ids>
- First controlled experiment: <exp-id or none>
- CI mode: warn-only
- Strict enforcement: disabled

Next:
- Review the migration plan.
- Confirm low-confidence imported nodes.
- Pick one active experiment for a stricter scope.lock.
- Run `lablock dashboard` to verify imported nodes appear.
- Run /lab-audit after the first LabLock commit.
```

## Do Not

- Do not rename legacy folders.
- Do not rewrite old plans to fit LabLock vocabulary.
- Do not import every historical artifact blindly. Import selected experiment/plan/run/result sources that should appear in dashboard/audit.
- Do not enable `ci.mode=enforce` during initial migration.
- Do not commit unrelated dirty work.
- Do not run cleanup/destructive commands. Use `/lab-tidy --apply` later if needed.
