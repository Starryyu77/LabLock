---
name: lab-autoplan
description: |
  Run advisor, reviewer2, feasibility, and novelty reviews on one plan. Use for "autoplan", "full review", or "stress test the plan". Writes a go/no-go dashboard under reviews/ with no git side effects.
disable-model-invocation: false
related-skills:
  - lab-review
  - lab-plan
---

# /lab-autoplan

You are running the full review pipeline on a plan or experiment design. This is what you'd do before committing 2 weeks of GPU time.

## Pre-flight

Required:

- `--target=<path>` — path to a `plans/*.md` or `experiments/*/hypothesis.md`. If the user didn't specify, ask.

Verify file exists. Read it fully.

If the target is an experiment design (`hypothesis.md`), the corresponding `scope.lock` also informs feasibility and reviewer2.

## Step 1: Run advisor review

Invoke the same logic as `/lab-review --as=advisor`. Save to `reviews/<date>-<target>-advisor.md` (so the artifact is reusable). Capture:

- 3-5 challenges
- Recommendation: proceed | reframe | shelve

## Step 2: Run reviewer2

Invoke the same logic as `/lab-review --as=reviewer2`. Save artifact. Capture:

- Severity per attack vector (novelty, baselines, ablations, claim strength, generalization, stat rigor)
- Predicted reception: borderline reject / weak reject / strong reject

## Step 3: Run feasibility

Invoke the same logic as `/lab-review --as=feasibility`. Save artifact. Capture:

- Resource gap table
- Verdict: feasible / tight / infeasible

## Step 4: Run novelty

Invoke the same logic as `/lab-review --as=novelty`. Save artifact. Capture:

- Closest related work
- Novelty assessment: clear / contested / probably done

## Step 5: Compile dashboard

Write the dashboard to:

```
reviews/<date>-<target-basename>-autoplan.md
```

Format:

```markdown
---
type: autoplan
target: <path>
created: <date>
---

# Autoplan Dashboard: <target-name>

| Perspective | Verdict | Severity / Notes |
|---|---|---|
| Advisor | proceed / reframe / shelve | <1-line summary> |
| Reviewer 2 | borderline / weak / strong reject | <strongest issue> |
| Feasibility | feasible / tight / infeasible | <largest gap> |
| Novelty | clear / contested / probably done | <closest paper> |

## Aggregate recommendation

<traffic light>: GREEN / YELLOW / RED

GREEN: all four perspectives clean. Proceed.
YELLOW: one or more concerns; address before running. Specific actions:
  - <action 1>
  - <action 2>
RED: showstopper present. Do not run. Required revisions:
  - <revision 1>
  - <revision 2>

## Linked artifacts
- [Advisor review](<advisor-artifact-path>)
- [Reviewer 2 review](<reviewer2-artifact-path>)
- [Feasibility review](<feasibility-artifact-path>)
- [Novelty review](<novelty-artifact-path>)
```

## Step 6: Verbal report

After writing the dashboard, print a short summary to the user:

```
Autoplan complete.
- Advisor: <verdict>
- Reviewer 2: <verdict>
- Feasibility: <verdict>
- Novelty: <verdict>

Aggregate: <GREEN | YELLOW | RED>

Full dashboard: reviews/<date>-<target>-autoplan.md
```

If GREEN, suggest: `/lab-exp-init` (or proceed with the existing exp).
If YELLOW, list the specific actions and ask: "Address now or proceed with risk noted?"
If RED, refuse to suggest progression. The user must revise the plan.

## Decision rules

The aggregate verdict follows a strict logic, not a fuzzy combination:

- **RED** if any of:
  - Advisor said "shelve"
  - Reviewer 2 found a showstopper
  - Feasibility said "infeasible"
  - Novelty said "probably done"
- **YELLOW** if any of:
  - Advisor said "reframe"
  - Reviewer 2 had moderate severity issues
  - Feasibility said "tight"
  - Novelty said "contested"
- **GREEN** otherwise

Do not soften RED to YELLOW because the rest looks good. If novelty is "probably done", no amount of compute will save the plan.

## Don't

- Don't skip any of the four reviews. Run them all.
- Don't combine the four review artifacts into one file—keep them separate so they can be cited individually.
- Don't soft-pedal RED verdicts. The point of `/lab-autoplan` is friction.
- Don't run autoplan on the same target twice in the same hour without explicit user confirmation; if reviews already exist for today, ask: "Reviews from earlier today exist. Re-run, or open the existing dashboard?"
