---
name: lab-migrate
description: |
  Adopt LabLock into an existing research repository. Use for "migrate existing repo", "adopt LabLock", "已有项目接入", or "legacy experiment repo". Defaults to read-only inventory and migration plan; only initializes LabLock after explicit approval. User-invoked only.
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

## Core Principle

Default to read-only discovery. Do not move, rename, delete, rewrite, or reclassify legacy files until the user approves a migration plan.

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

## Phase 3: Write Migration Plan

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
5. Proposed first active experiment to lock.
6. Candidate config invariants for that first experiment.
7. Candidate file invariants for that first experiment.
8. Legacy material that should remain unmanaged for now.
9. Risks before enabling strict enforcement.
10. Exact next commands, separated into "read-only", "initialize", and "first controlled experiment".

## Phase 4: Ask For Approval

Ask the user to choose one:

1. Plan only: stop after writing the migration report.
2. Bootstrap LabLock: run initialization in warn-only mode.
3. Bootstrap and lock one active experiment: initialize, then guide `/lab-exp-init`.

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

## Phase 6: First Controlled Experiment

If the user wants to lock one active experiment:

1. Choose exactly one active line.
2. Use `/lab-exp-init` to create a new `exp-NNN` that represents the current active work.
3. Keep invariants modest:
   - A few stable config keys.
   - One or two important source files.
   - Optional probes only if they already exist.
4. Commit this as the first controlled LabLock experiment.

Old experiments stay legacy until the user explicitly migrates them.

## Final Report

End with:

```text
Migration status:
- Plan written: <path>
- LabLock initialized: yes/no
- First controlled experiment: <exp-id or none>
- CI mode: warn-only
- Strict enforcement: disabled

Next:
- Review the migration plan.
- Pick one active experiment for scope.lock.
- Run /lab-audit after the first LabLock commit.
```

## Do Not

- Do not rename legacy folders.
- Do not rewrite old plans to fit LabLock vocabulary.
- Do not generate scope locks for every historical experiment in one pass.
- Do not enable `ci.mode=enforce` during initial migration.
- Do not commit unrelated dirty work.
- Do not run cleanup/destructive commands. Use `/lab-tidy --apply` later if needed.
