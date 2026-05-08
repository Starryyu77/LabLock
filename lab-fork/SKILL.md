---
name: lab-fork
description: |
  Fork an experiment due to scope drift or intentional branching. Triggers: "fork experiment", "fork this exp", "branch from current exp".
  User-invoked only: this skill creates a new experiment, writes a new lock, and may mark the parent superseded.
disable-model-invocation: true
related-skills:
  - lab-guard
  - lab-exp-init
---

# /lab-fork

Use this when the current setup should become a new experiment rather than an override on the old one.

## Pre-flight

1. Resolve the parent experiment from `.lablock/state/current-exp` or user input.
2. Verify the parent lock exists and is active.
3. Run staged or working scope verification and summarize the drift.
4. Ask for the new shortname and fork reason.

## Execute

Run:

```bash
lablock fork --from <parent-exp> --shortname <shortname> --reason "<reason>" --stage
```

Use `--source=staged` when the drift is already staged for the blocked commit; otherwise use working state.

## Verify

1. Confirm a new `exp-NNN` was allocated. Never use letter suffixes.
2. Confirm the new hypothesis frontmatter has `forked_from: <parent-exp>` and `fork_reason: scope-drift` when applicable.
3. Confirm `.lablock/locks/<new-exp>.scope.lock` reflects the drifted baseline.
4. Confirm generated maps are updated on the next commit.

## Final Report

Report parent experiment, new experiment, staged files, and whether the parent was marked superseded.
