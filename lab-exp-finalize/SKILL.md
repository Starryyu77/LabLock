---
name: lab-exp-finalize
description: |
  Close out an experiment. Triggers: "finalize experiment", "experiment done", "wrap up exp".
  User-invoked only: this skill updates experiment status, tags final state, clears current-exp, and routes cleanup/postmortem work.
disable-model-invocation: true
related-skills:
  - lab-cleanup-pr
  - lab-postmortem
---

# /lab-exp-finalize

Use this when the experiment has reached a decision point.

## Pre-flight

1. Resolve experiment ID and directory.
2. Read `hypothesis.md`, `results.md`, and `.lablock/locks/<exp>.scope.lock`.
3. Ask for final status: `done`, `killed`, or `superseded`.
4. Require a short evidence pointer: metric, log path, commit, or reason.
5. Check `git status --short` and avoid mixing unrelated work.

## Execute

Run:

```bash
lablock exp-finalize --exp=<exp-id> --status=<done|killed|superseded>
```

If status is `done`, recommend `/lab-cleanup-pr`.

If status is `killed` or `superseded`, require `/lab-postmortem` before considering the experiment closed.

## Verify

1. Confirm frontmatter status changed.
2. Confirm scope lock status changed where applicable.
3. Confirm `.lablock/state/current-exp` no longer points to the finalized experiment.
4. Confirm final tag creation or explain why it was skipped.

## Final Report

Report status, final tag, changed files, and required follow-up: cleanup PR or postmortem.
