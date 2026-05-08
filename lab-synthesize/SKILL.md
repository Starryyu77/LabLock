---
name: lab-synthesize
description: |
  Cross-experiment synthesis. Triggers: "synthesize", "what do these experiments tell us", "summary across experiments".
disable-model-invocation: false
related-skills:
  - lab-formalism-update
  - lab-paper-write
---

# /lab-synthesize

Use this after multiple experiments have results and the user wants claim-level interpretation.

## Inputs

Read:

1. Selected `experiments/*/hypothesis.md`.
2. Selected `experiments/*/results.md`.
3. `.lablock/changes/*.changes.log`.
4. `claims.md`.
5. `formalism.md`.

## Analyze

For each result:

1. State whether it supports, refutes, or leaves the hypothesis ambiguous.
2. Identify metric caveats and missing baselines.
3. Compare with related experiments.
4. Decide whether a new claim, weaker claim, or no claim is justified.

## Output

Write `reviews/YYYY-MM-DD-synthesis.md` with:

1. Cross-experiment pattern summary.
2. Proposed claim additions or edits.
3. Evidence pointers.
4. Gaps requiring new experiments.

Do not directly strengthen `claims.md` beyond the available evidence.
