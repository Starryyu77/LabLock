---
name: lab-plan-exp
description: |
  Design one experiment before creating scope.lock. Triggers: "design experiment", "plan an experiment", "experiment design".
disable-model-invocation: false
related-skills:
  - lab-plan
  - lab-review
  - lab-exp-init
---

# /lab-plan-exp

Use this when the research question is known but the experiment contract is not ready for `/lab-exp-init`.

## Specify the Experiment

Capture:

1. Independent variable.
2. Dependent metric or observable.
3. Baseline or parent experiment.
4. Controlled variables.
5. Dataset, split, seed, and evaluation protocol.

## Predict Outcomes

Write expected results under:

1. Hypothesis supported.
2. Hypothesis refuted.
3. Ambiguous or noisy result.

For each branch, state what action follows.

## Scope Contract Draft

Draft:

1. Config invariants.
2. File invariants.
3. Optional probes.
4. Controlled changes.
5. Kill criteria.
6. Success criteria.

## Output

Write to `plans/YYYY-MM-DD-<shortname>-experiment.md`. End with the exact `/lab-exp-init` command shape the user can run after approval.
