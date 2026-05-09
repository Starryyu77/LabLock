---
name: lab-dashboard
description: |
  Open, refresh, or populate the LabLock experiment dashboard. Use for "open dashboard", "实验看板", "show experiments visually", "把实验加入看板", or repo-level experiment board management. Runs `lablock dashboard`, can guide `lablock exp-init`, then refresh/open the generated board. User-invoked only.
disable-model-invocation: true
related-skills:
  - lab-exp-init
  - lab-plan-exp
  - lab-advice
---

# /lab-dashboard

Use this skill as the user-facing entrypoint for the graphical LabLock experiment board.

## Pre-flight

1. Confirm the current directory is the intended research repo:

```bash
git status --short --branch
test -f .lablock/config.yaml
```

2. If `.lablock/config.yaml` is missing:
   - For a new repo, recommend `/lab-init`.
   - For an existing research repo, recommend `/lab-migrate`.
   - Do not create a dashboard from arbitrary files.

3. Read current dashboard state:

```bash
lablock dashboard --json
```

## Open Or Refresh

When the user wants to see the board:

```bash
lablock dashboard --open
```

If opening a browser is blocked by the environment, run:

```bash
lablock dashboard
```

Then report the generated path: `.lablock/dashboard/index.html`.

## Add An Experiment To The Board

The board is generated from experiment files. To add a new item, create a real experiment node, then refresh the dashboard.

If the item already exists as a legacy plan, run, or result folder, route to `/lab-migrate` or use `lablock migrate-node` for a single approved item. Do not use `exp-init` to invent a fresh experiment when the user is asking to surface historical work.

Ask only for missing fields:

- `shortname`: lowercase slug, 3-30 chars.
- `parent`: `none` for a root experiment, or `exp-NNN` for a sub-experiment.
- `hypothesis`: one falsifiable sentence.
- `controlled change`: what differs from the parent/baseline.
- `config invariants`: comma-separated dotted keys, or defaults if the user confirms.
- `success criteria` and `kill criteria`.

Run:

```bash
lablock exp-init "<shortname>" \
  --parent="<exp-NNN | none>" \
  --hypothesis="<hypothesis>" \
  --config="<dotted.key=value,...>" \
  --control-modified="<controlled change>" \
  --success="<success criteria>" \
  --kill="<kill criteria>" \
  --stage
```

Then refresh:

```bash
lablock dashboard --open
```

For a legacy item that the user has already approved for import, run:

```bash
lablock migrate-node "<shortname>" \
  --source="<legacy-path>" \
  --source-type="<plan|experiment|run|result|unknown>" \
  --status="<planned|running|done|killed|superseded>" \
  --hypothesis="<conservative hypothesis or summary>" \
  --confidence="<low|medium|high>" \
  --stage
```

Then refresh the dashboard.

## Summarize The Board

For status questions, use `lablock dashboard --json` and report:

- total experiments
- active/running/planned counts
- current experiment
- root experiments and their children
- experiments missing progress or next sub-experiment notes

## Safety Rules

- Do not edit `.lablock/dashboard/index.html` directly; it is generated.
- Do not invent experiment records just to make the board look populated.
- Do not create a git branch by default. Use `/lab-exp-start` only when the user explicitly wants Git history isolation, remote CI, collaboration, or cleanup PR flow.
- If the user has only a vague idea, route to `/lab-plan-exp` before creating an experiment.
