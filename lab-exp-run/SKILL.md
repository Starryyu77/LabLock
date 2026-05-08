---
name: lab-exp-run
description: |
  Begin running an experiment. Triggers: "run experiment", "start training", "kick off exp".
disable-model-invocation: true
related-skills:
  - lab-exp-init
  - lab-exp-finalize
---

# /lab-exp-run

Verify scope, set `.lablock/state/current-exp`, update `infra/gpu/runs.md`, and print the canonical training command.
