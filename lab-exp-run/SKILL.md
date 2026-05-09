---
name: lab-exp-run
description: |
  Begin running an experiment. Triggers: "run experiment", "start training", "kick off exp", "launch run". Verifies scope.lock pre-flight, sets .lablock/state/current-exp, updates infra/gpu/runs.md, and prints the canonical training command for the user to execute. Does NOT submit a job—LabLock has no opinion on your training infrastructure. The user runs the printed command. This skill writes state files and modifies infra/; user must invoke explicitly.
disable-model-invocation: true
related-skills:
  - lab-exp-init
  - lab-exp-start
  - lab-exp-finalize
---

# /lab-exp-run

You are starting an experiment run. The user has done `/lab-exp-init`; `/lab-exp-start` is optional and only needed when they explicitly want Git branch isolation.

LabLock does not own job submission. You will print the command and the user will run it (locally, via tmux, via Slurm—not your concern).

## Pre-flight

1. **Verify experiment folder.** Ensure `experiments/<exp-id>-<shortname>/hypothesis.md` and `.lablock/locks/<exp-id>.scope.lock` exist. Folder isolation is the default; a matching Git branch is optional.
2. **Verify clean tree.** Run `git status --porcelain`. Reject if dirty: "Commit or stash before running."
3. **Verify scope.lock pre-flight.** Run:
   ```bash
   lablock-verify-scope --exp=<exp-id> --source=working --layers=config,files
   ```
   If it returns drift, **refuse to start**: "Working tree differs from scope.lock. Address drift before launching the run, or your results won't reflect the locked invariants."
4. **Read `.lablock/locks/<exp-id>.scope.lock`** to extract:
   - `config` invariants (will be passed to training)
   - `kill_criteria` (display to user)
   - `success_criteria` (display)

## Step 1: Set current-exp

Write the exp-id to `.lablock/state/current-exp` so hooks and dashboards know which experiment is in focus:

```bash
echo "<exp-id>" > .lablock/state/current-exp
```

This is gitignored; it is a focus pointer, not the isolation boundary. The isolation boundary is the experiment folder plus `.lablock/locks/<exp-id>.scope.lock`.

## Step 2: Update GPU runs ledger

Append a row to `infra/gpu/runs.md`:

```markdown
| Date | Exp | Machine | GPU | Started | Expected | Status |
|---|---|---|---|---|---|---|
| 2026-05-08 | exp-007 | gpu-host-3 | 4× A100 | 14:23 | 2 days | running |
```

Ask the user for: machine, GPU spec, expected duration. If `infra/gpu/machines.md` exists, suggest from that list.

## Step 3: Print canonical run command

Construct the training command. The exact form depends on the project, but should:

- Reference the experiment config: `experiments/<exp-id>-<shortname>/config.yaml`
- Set output directory: `experiments/<exp-id>-<shortname>/outputs/`
- Set the seed from scope.lock
- Set log directory: `experiments/<exp-id>-<shortname>/logs/`

If the project has an existing convention (e.g., `python train.py --config=...`), use it. Otherwise, suggest a generic form and ask the user to confirm.

Print clearly:

```bash
# Run from the repo root, on the GPU machine:
python train.py \
  --config=experiments/exp-007-contrastive/config.yaml \
  --output=experiments/exp-007-contrastive/outputs \
  --seed=42 \
  --log_dir=experiments/exp-007-contrastive/logs

# Or, if using your job submission script:
sbatch scripts/submit.sh experiments/exp-007-contrastive/config.yaml
```

## Step 4: Display run reminders

Before user runs the command, display:

```
Run reminders for <exp-id>:

Hypothesis: <from hypothesis.md>

Kill if any of:
  - <kill criterion 1>
  - <kill criterion 2>

Success means:
  - <success criterion 1>
  - <success criterion 2>

Drift detection is active. Any commit that changes:
  - locked config keys, or
  - locked file SHAs
  will be rejected by pre-commit unless you /lab-fork or `lablock override`.

When done:
  /lab-exp-finalize --exp=<exp-id> --status=<done|killed|superseded>
```

## Step 5: Commit the state changes

```bash
git add infra/gpu/runs.md
git commit -m "begin run for <exp-id>"
```

Hooks will add the LabLock scope/tag prefix and `LabLock-Change` trailer.

## Step 6: Final reminder

Tell the user clearly:

> The training command has been printed but NOT executed by LabLock. Run it yourself when ready. While the run is in progress, normal commits work as usual—drift detection will catch any unintended changes to locked invariants.

## Failure modes

- **Verify-scope returns drift before run starts** → refuse. The user must clean up first.
- **`infra/gpu/machines.md` missing** → don't fail; suggest creating it via `/lab-init` Layer 2 modules, but proceed anyway with user-supplied machine info.
- **Already focused on a different `current-exp`** → warn, ask user to confirm switching focus.

## Don't

- Don't actually execute the training command. Print only.
- Don't skip Step 3 verify-scope. Running an experiment with drifted setup is the bug LabLock exists to prevent.
- Don't make assumptions about training infrastructure. Ask, or use generic template, but don't pretend to know.
- Don't write to results.md from this skill. Results come from the actual run, not from setup.
