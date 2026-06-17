---
name: lab-exp-run
description: |
  Begin running an experiment. Triggers: "run experiment", "start training", "kick off exp", "launch run". Uses folder-isolated alignment pre-flight, sets current-exp, updates infra/gpu/runs.md, and prints the canonical command. Does NOT submit jobs. User-invoked only.
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
2. **Inspect worktree, but do not require a globally clean tree.** Run `git status --porcelain` and split changes into:
   - current experiment files: `experiments/<exp-id>-<shortname>/...`
   - current experiment lock/change metadata: `.lablock/locks/<exp-id>.scope.lock`, `.lablock/changes/<exp-id>.changes.log`, `.lablock/state/current-exp`
   - unrelated files from other experiments or repo work

   Do not reject just because unrelated files are dirty. Report them as a warning:

   ```text
   Worktree note: unrelated dirty files exist outside <exp-id>. They are not blocking this run intent because LabLock vNext uses folder isolation. Do not interpret those files as evidence for this experiment unless they are linked later.
   ```

   Only pause when a dirty file is in the current experiment boundary and would make the run command ambiguous.
3. **Verify scope.lock pre-flight for the current experiment only.** Run:
   ```bash
   lablock-verify-scope --exp=<exp-id> --source=working --layers=config,files
   ```
   If it returns drift, warn clearly and explain how the drift affects the current research objective. Do not turn the warning into a hard gate unless:
   - the drift is inside the current experiment boundary and changes the run command/config being registered, or
   - the user explicitly asks for a fully controlled legacy `scope.lock` run.
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
  will be tagged as SCOPE-DRIFT and recorded as an alignment note. In vNext this is a warning and provenance signal, not the research agenda. Use `/lab-monitor` or `/lab-deguard` when you need to recenter on the objective; use legacy `lablock fork` / `lablock override` only when the experiment frame itself must change.

When done:
  /lab-exp-finalize --exp=<exp-id> --status=<done|killed|superseded>
```

## Step 5: Save the run intent

Prefer writing or updating:

- `experiments/<exp-id>-<shortname>/progress.md`
- `infra/gpu/runs.md` when the project tracks GPU runs

Do not require an immediate commit before printing the run command. If the user wants a commit, stage only the files created by this run-intent step and do not ask them to clean unrelated experiments first.

## Step 6: Final reminder

Tell the user clearly:

> The training command has been printed but NOT executed by LabLock. Run it yourself when ready. While the run is in progress, normal commits work as usual; drift detection records alignment warnings so you can decide whether they matter for the research target.

## Failure modes

- **Unrelated dirty files exist outside the current experiment** → warn only. Do not block run intent.
- **Current experiment files are dirty in a way that changes the registered command/config** → pause and ask whether to update the run intent, update the experiment plan, or continue with a note.
- **Verify-scope returns drift before run starts** → warn and explain objective impact. Refuse only for current-experiment drift that makes the run command/config ambiguous, or when the user requested strict legacy control.
- **`infra/gpu/machines.md` missing** → don't fail; suggest creating it via `/lab-init` Layer 2 modules, but proceed anyway with user-supplied machine info.
- **Already focused on a different `current-exp`** → warn, ask user to confirm switching focus.

## Don't

- Don't actually execute the training command. Print only.
- Don't convert unrelated repo dirtiness into a blocker for the current experiment. Folder isolation is the default.
- Don't skip Step 3 verify-scope. The check is for objective alignment and provenance; it is not a global clean-tree gate.
- Don't make assumptions about training infrastructure. Ask, or use generic template, but don't pretend to know.
- Don't write to results.md from this skill. Results come from the actual run, not from setup.
