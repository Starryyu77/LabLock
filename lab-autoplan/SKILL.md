---
name: lab-autoplan
description: |
  Run advisor, reviewer2, feasibility, and novelty reviews in sequence. Triggers: "autoplan", "full review", "review everything".
disable-model-invocation: false
related-skills:
  - lab-review
---

# /lab-autoplan

Use this when the user wants a complete go/no-go review of a plan.

## Inputs

Resolve one target plan or experiment design. Do not review multiple unrelated targets in one autoplan.

## Review Sequence

Run the four perspectives in order:

1. Advisor: framing and importance.
2. Reviewer2: novelty, baselines, ablations, claim risk.
3. Feasibility: compute, data, time, implementation risk.
4. Novelty: relationship to `lit/` and prior work.

## Synthesis

Merge duplicate findings and classify them:

1. Blockers.
2. Must fix before experiment.
3. Nice to fix.
4. Accepted risk.

## Output

Write `reviews/YYYY-MM-DD-<target>-autoplan.md` with a traffic-light verdict: go, revise, or no-go.
