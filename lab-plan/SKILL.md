---
name: lab-plan
description: |
  Convert a vague research idea into a structured, falsifiable research plan. Triggers: "research plan", "research idea", "let's plan".
disable-model-invocation: false
related-skills:
  - lab-plan-exp
  - lab-review
---

# /lab-plan

Use this before experiments exist, when the user has an idea but not yet a falsifiable plan.

## Reframe

1. Identify the actual research question.
2. List hidden premises the user may be assuming.
3. Offer 1-2 alternative framings.
4. Push back when the idea is too broad, too unfalsifiable, or not worth the compute.

## Hypotheses

Write 2-4 hypotheses. Each must be:

1. One sentence.
2. Measurable.
3. Comparative.
4. Falsifiable by a concrete metric or observation.

## Implementation Alternatives

For each hypothesis, propose 2-3 ways to test it. Include:

1. Effort estimate.
2. Compute or data needs.
3. Main risk.
4. Expected information value.

## Recommendation

Pick the narrowest experiment that learns the most. Explain why broader variants should wait.

## Output

Write the plan to `plans/YYYY-MM-DD-<topic>.md`. End by recommending `/lab-plan-exp` for the first experiment design.
