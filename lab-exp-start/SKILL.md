---
name: lab-exp-start
description: |
  Create the Git branch for an experiment after /lab-exp-init. Triggers: "start experiment branch", "create exp branch", "branch off".
  User-invoked only: this skill switches branches, commits staged experiment files, may push, and writes current-exp state.
disable-model-invocation: true
related-skills:
  - lab-exp-init
  - lab-exp-run
  - lab-exp-finalize
---

# /lab-exp-start

Use this when the experiment files already exist and the user wants to begin work on an isolated branch.

## Pre-flight

1. Verify the experiment exists in `experiments/<exp>-*/hypothesis.md`.
2. Verify `.lablock/locks/<exp>.scope.lock` exists and is active.
3. Check `git status --short`. Do not hide unrelated dirty files.
4. Prefer starting from `main`; if not on `main`, explain the current branch and confirm the base.
5. Run `lablock-verify-scope --exp=<exp> --source=working --json`.

## Execute

Run:

```bash
lablock exp-start --exp=<exp-id> --base=main
```

If a remote exists and the user asked to push, push the created branch:

```bash
git push -u origin exp/<exp-id>-<shortname>
```

## Verify

1. Confirm the current branch is `exp/<exp-id>-<shortname>`.
2. Confirm `.lablock/state/current-exp` contains the experiment ID.
3. Confirm the initial experiment commit includes the hypothesis, lock, generated maps, and changes log when applicable.

## Final Report

Report branch name, current-exp state, verification status, and the next command the user should run for training or implementation.
