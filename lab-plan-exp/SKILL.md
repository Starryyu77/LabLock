---
name: lab-plan-exp
description: |
  Design one experiment before scope.lock creation. Use for "design experiment", "plan an experiment", "design ablation", or "spec out exp". Defines IV, controls, metrics, expected outcomes, and criteria. Writes only to plans/.
disable-model-invocation: false
related-skills:
  - lab-plan
  - lab-review
  - lab-exp-init
---

# /lab-plan-exp

You are designing a single experiment. The user has typically already done `/lab-plan` (good) or has a hypothesis in mind (also OK, you'll surface the framing yourself).

The output of this skill is **a draft**. The next step is `/lab-exp-init`, which turns the draft into the actual `scope.lock`.

## Pre-flight

Ask the user:

- "Do you have a `/lab-plan` for this experiment, or are we starting from a hypothesis directly?"
- "What's the parent experiment (or `none` for root)?"

If parent is given, read `experiments/<parent>-*/hypothesis.md` and the corresponding `.lablock/locks/<parent>.scope.lock`. You'll use these to suggest controlled variables and avoid duplication.

## Step 1: Primary Research Intervention

Ask: "What's the primary thing you're changing to reach the research goal?"

Prefer one variable when possible. If the user proposes a bundled intervention (e.g., "add contrastive AND change lr"), ask whether both are necessary to test the intended idea. If yes, record it explicitly as a planned bundle rather than treating it as drift.

Acceptable IVs:
- Adding a loss term
- Replacing a module
- Changing a hyperparameter (single value)
- Switching dataset

## Step 2: Controlled Variables And Planned Bundle

Walk through every variable in the parent experiment's config. For each:

- Is this fixed in the new exp? → goes to `controlled_variables`
- Is this changed? → if yes and it's not part of the primary intervention, ask whether it is required for the research goal. If yes, add it to the planned bundle. If no, mark it as avoidable drift.

Be clear, not defensive. The point is to keep interpretation tied to the original research target.

## Step 3: Evaluation metric

Ask:

- **Primary metric**: one number, comparable to baseline. (e.g., "Top-1 accuracy on ImageNet val", "perplexity on WikiText-2 test", "Recall@1 on Flickr30k")
- **Secondary metrics**: 0-3 supporting numbers.
- **Statistical handling**: how many seeds? Mean ± std? Bootstrapped CI? "Run 1 seed and call it" is acceptable for early experiments but flag it.

Reject metrics that have no shared definition with the baseline. ("Custom score" without a paper reference is a red flag.)

## Step 4: Predicted outcomes

Ask the user to predict, **before running**:

- **If H1 is true**: expected metric value range
- **If H0 is true**: expected metric value range (often this is the baseline number)
- **What outcome would surprise me**: forces the user to think about what could go wrong

This is core to good experimental hygiene—pre-registered predictions reduce post-hoc rationalization.

## Step 5: Kill criteria and budget

Ask:

- **Compute budget**: GPU-hours allocated. If exceeded, kill.
- **Time budget**: calendar days. If exceeded, kill.
- **Failure modes that abort**: numerical (e.g., "loss diverges"), behavioral (e.g., "outputs become repetitive"), correctness (e.g., "loss_contract test fails").
- **Threshold for declaring failure**: how much worse than baseline before we conclude H0?

These map to the `kill_criteria` array in scope.lock. Give specific numbers.

## Step 6: Success criteria

Tied to Step 4 predictions:

- "Metric ≥ baseline + N% with p < 0.05" (if doing stats)
- "Metric ≥ baseline + N% in single-seed run" (early-stage)
- "Behavioral observation: <specific qualitative result>"

These map to `success_criteria` in scope.lock.

## Step 7: Probes (if applicable)

Suggest contract tests for things that should NOT change. If the user's IV is "add contrastive loss", possible probes:

- `loss_contract`: when λ=0, total loss equals the previous version exactly
- `dataloader_contract`: sampling behavior unchanged

If the user has no probes in mind, that's fine—Layer 1 + 2 in scope.lock will still catch most drift.

## Step 8: Write the draft

Save to:

```
plans/<date>-exp-<shortname>.md
```

Format:

```markdown
---
created: <date>
status: design
parent: <exp-NNN | none>
target_exp_id: (will be assigned at /lab-exp-init)
---

# Design: <shortname>

## Hypothesis (one sentence)
<from Step 1, refined>

## Primary intervention
<the main research change>

## Planned bundle (if any)
- <additional changes required to make the intervention meaningful>

## Controlled variables
- key=value
- ...

## Evaluation
- Primary: <metric>
- Secondary: ...
- Seeds: <N>

## Predictions
- If H1: <range>
- If H0: <range>
- Surprise: <what would surprise me>

## Kill criteria
- ...

## Success criteria
- ...

## Probes (optional)
- name | command | reason

## Suggested CLI invocation
\`\`\`bash
lablock exp-init <shortname> \\
  --parent=<parent> \\
  --hypothesis="..." \\
  --config="<csv>" \\
  --control-modified="<csv>" \\
  --file-invariant="<csv>" \\
  --kill="<csv>" \\
  --success="<csv>" \\
  --stage
\`\`\`
```

The pre-rendered CLI command is the bridge to `/lab-exp-init`—the user can copy-paste and run.

## Step 9: Suggest review

Tell the user:

> This is a draft. Before running, consider:
> - `/lab-review --as=reviewer2 plans/<this-file>.md` to stress-test the design
> - `/lab-review --as=feasibility plans/<this-file>.md` to check compute / time budget realism
>
> Or if you're confident, run the suggested CLI command and continue with folder-isolated execution via `/lab-exp-run`. Use `/lab-exp-start` only when you explicitly need a Git branch.

## Don't

- Don't hide multi-variable interventions. Prefer one primary intervention, but record necessary bundles explicitly.
- Don't accept "we'll figure it out" for kill criteria. Push for specific numbers.
- Don't write the actual scope.lock here. That's `/lab-exp-init`'s job.
- Don't skip Step 4 (predictions). Pre-registered predictions are the difference between an experiment and a fishing expedition.
