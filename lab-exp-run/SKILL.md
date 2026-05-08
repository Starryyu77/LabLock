---
name: lab-exp-run
description: |
  Begin running an experiment. Triggers: "run experiment", "start training", "kick off exp".
  User-invoked only: this skill writes current-exp state and run notes, then prints the command to execute.
disable-model-invocation: true
related-skills:
  - lab-exp-init
  - lab-exp-start
  - lab-exp-finalize
---

# /lab-exp-run

Use this immediately before launching a training, evaluation, or experimental run.

## Pre-flight

1. Resolve the experiment ID. Prefer `.lablock/state/current-exp`; otherwise ask.
2. Confirm the current branch belongs to the experiment or that the user intentionally runs elsewhere.
3. Run `lablock-verify-scope --exp=<exp> --source=working --json`.
4. If project config sets `drift.layers.probes` to `local` or `both`, run the relevant local probes before launch.
5. Check for obvious dirty unrelated files with `git status --short`.

## Collect Run Metadata

Ask for:

1. Run command.
2. Expected output directory or tracking system.
3. GPU/data/network needs.
4. Kill criterion threshold to watch first.

## Execute

1. Write `.lablock/state/current-exp` with the experiment ID.
2. Append a concise entry to `infra/gpu/runs.md` if that file or module exists.
3. Print the canonical command for the user to execute. Do not submit long-running jobs unless the user explicitly asks.

## Final Report

Report the experiment ID, scope verification status, run command, expected artifacts, and which kill criterion should be checked first.
