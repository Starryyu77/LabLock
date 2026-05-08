---
name: lab-exp-init
description: |
  Start a new experiment, ablation, or fork. Triggers: "new exp", "start an experiment", "ablate X".
disable-model-invocation: true
related-skills:
  - lab-plan-exp
  - lab-exp-start
  - lab-fork
---

# /lab-exp-init

Allocate the next `exp-NNN`, capture hypothesis, controlled changes, config/file/probe invariants, kill criteria, and success criteria. Render `scope.lock.tmpl` and `hypothesis.md.tmpl`.
