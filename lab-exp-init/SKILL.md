---
name: lab-exp-init
description: |
  Start a new experiment, ablation, or fork baseline. Triggers: "new exp", "start an experiment", "ablate X", "create scope.lock".
  User-invoked only: this skill creates experiment files and a tracked scope.lock.
disable-model-invocation: true
related-skills:
  - lab-plan-exp
  - lab-exp-start
  - lab-fork
---

# /lab-exp-init

Use this after the experiment design is clear enough to lock controlled variables.

## Pre-flight

1. Validate the shortname: lowercase letters, digits, and dashes only.
2. Resolve the parent experiment when provided; it must exist and must not be superseded.
3. Run `lablock next-exp-id` and tell the user which `exp-NNN` will be allocated.
4. Confirm the user is not trying to encode multiple experiments into one scope.

## Collect Experiment Contract

Ask for:

1. Hypothesis: one sentence, 1-280 characters, with a measurable prediction.
2. Controlled changes versus the parent or baseline.
3. Config invariants. Keep at least three when the project has meaningful config.
4. File invariants. Recommend dataloader, model, loss, or evaluation code that must remain byte-identical.
5. Optional probes. Each needs name, command, requirements, timeout, `run_on`, and reason.
6. Kill criteria.
7. Success criteria.

Push back on vague hypotheses such as "X helps". Ask what metric, what comparison, and what direction of change.

## Execute

Prefer the deterministic CLI:

```bash
lablock exp-init <shortname> \
  --hypothesis "<one sentence>" \
  --config key=value,key.nested=value \
  --control-modified "<what changes>" \
  --file-invariant path/to/file.py:"why it must stay fixed" \
  --kill "<kill criterion>" \
  --success "<success criterion>" \
  --stage
```

If probes are needed and the CLI cannot yet express them, edit `.lablock/locks/<exp>.scope.lock` directly and validate it before commit.

## Verify

1. Confirm `experiments/<exp>-<shortname>/hypothesis.md`, `config.yaml`, and `results.md` exist.
2. Confirm `.lablock/locks/<exp>.scope.lock` validates.
3. Run `lablock-verify-scope --exp=<exp> --source=working --json`.
4. Commit the staged experiment files normally so hooks regenerate `MAP.md` and `experiments/matrix.md`.

## Final Report

Report the new experiment ID, lock path, controlled change summary, and next step:

```text
Next: run /lab-exp-start <exp-id> to create the experiment branch.
```
