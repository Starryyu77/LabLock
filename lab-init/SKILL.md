---
name: lab-init
description: |
  Initialize a new LabLock research project. Triggers: "init project", "new research repo", "set up LabLock".
disable-model-invocation: true
related-skills:
  - lab-exp-init
---

# /lab-init

Run pre-flight checks, collect project name/domain/hypothesis/modules/CI mode, then run:

```bash
lablock init-project --name="<name>" --modules=<csv> --ci-mode=<warn-only|enforce>
```

Report created files, installed hooks, and the next step: `/lab-exp-init`.
