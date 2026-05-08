---
name: lab-review
description: |
  Review a plan or experiment design as advisor, reviewer2, feasibility, or novelty. Triggers: "review plan", "feasibility check", "reviewer 2".
disable-model-invocation: false
related-skills:
  - lab-plan
  - lab-autoplan
---

# /lab-review

Use this to pressure-test an existing plan, design, or experiment document.

## Inputs

Resolve the target file. Accept `plans/*.md`, `experiments/*/hypothesis.md`, or a user-provided design document.

Ask for mode if not specified:

1. `advisor`: is this worth doing and well framed?
2. `reviewer2`: novelty, baselines, ablations, claim strength.
3. `feasibility`: compute, data, calendar time, operational risk.
4. `novelty`: positioning against `lit/` and known work.

## Review Protocol

1. Quote or summarize the target's core hypothesis.
2. List findings by severity.
3. Separate blockers from improvements.
4. Include concrete fixes, not just criticism.
5. State what evidence would change the recommendation.

## Output

Write `reviews/YYYY-MM-DD-<target>-<mode>.md` with:

1. Verdict.
2. Findings.
3. Open questions.
4. Recommended next action.
