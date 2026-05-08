---
name: lab-cleanup-pr
description: |
  Generate a clean PR merging only necessary parts of a successful experiment. Triggers: "cleanup PR", "merge experiment".
disable-model-invocation: true
related-skills:
  - lab-exp-finalize
---

# /lab-cleanup-pr

Classify diffs, curate cherry-picks, create a cleanup branch, and open a draft PR via `gh`.
