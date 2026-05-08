---
name: lab-postmortem
description: |
  Write a postmortem for a failed, killed, or superseded experiment. Triggers: "postmortem", "experiment failed", "killed exp".
disable-model-invocation: false
related-skills:
  - lab-exp-finalize
---

# /lab-postmortem

Use this after an experiment is killed, failed, or superseded.

## Inputs

Read:

1. `experiments/<exp>-*/hypothesis.md`
2. `experiments/<exp>-*/results.md`
3. `.lablock/changes/<exp>.changes.log`
4. Recent commits containing `LabLock-Change` for the experiment.

## Required Sections

Write a specific, evidence-backed postmortem with exactly these sections:

1. What we did.
2. What happened.
3. Why we think it happened.
4. What we learned.
5. Conditions to revive.

Do not write generic filler. Each section should name concrete evidence or state that evidence is missing.

## Execute

Prefer the deterministic CLI:

```bash
lablock postmortem --exp=<exp-id>
```

Then edit the generated file if more evidence is available.

## Verify

1. Confirm `experiments/<exp>-<shortname>/postmortem.md` exists.
2. Confirm the five required sections are present.
3. If there is a durable lesson, append it to `.lablock/learnings.jsonl` or explicitly report why not.
