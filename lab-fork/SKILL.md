---
name: lab-fork
description: |
  Fork an experiment due to scope drift or intentional branching. Triggers: "fork experiment", "branch from current exp".
disable-model-invocation: true
related-skills:
  - lab-guard
  - lab-exp-init
---

# /lab-fork

Allocate a new `exp-NNN`, set `forked_from`, copy/update scope lock, and mark the source experiment superseded when appropriate.
