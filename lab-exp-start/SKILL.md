---
name: lab-exp-start
description: |
  Create the git branch for an experiment after lab-exp-init. Triggers: "start experiment branch", "create exp branch".
disable-model-invocation: true
related-skills:
  - lab-exp-init
  - lab-exp-finalize
---

# /lab-exp-start

Ensure a clean main branch, create `exp/<exp-id>-<shortname>`, commit initial experiment files, push, and set `.lablock/state/current-exp`.
