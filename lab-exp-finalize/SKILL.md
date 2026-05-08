---
name: lab-exp-finalize
description: |
  Close out an experiment. Triggers: "finalize experiment", "experiment done", "wrap up exp".
disable-model-invocation: true
related-skills:
  - lab-cleanup-pr
  - lab-postmortem
---

# /lab-exp-finalize

Update status, tag `<exp-id>-final`, clear current-exp state, and route success to cleanup PR or failure to postmortem.
