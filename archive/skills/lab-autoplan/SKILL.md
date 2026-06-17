---
name: lab-autoplan
description: |
  Run advisor, reviewer2, feasibility, and novelty reviews on one plan. Use for "autoplan", "full review", or "stress test the plan". Writes a research alignment dashboard under reviews/ with no git side effects.
disable-model-invocation: false
related-skills:
  - lab-review
  - lab-plan
---

# /lab-autoplan

You are running the full review pipeline on a plan or experiment design. This is what you'd do before committing 2 weeks of GPU time, but the result is guidance, not a gate.

## Pre-flight

Required:

- `--target=<path>` — path to a `plans/*.md` or `experiments/*/hypothesis.md`. If the user didn't specify, ask.

Verify file exists. Read it fully.

If the target is an experiment design (`hypothesis.md`), the corresponding `scope.lock` also informs feasibility and reviewer2.

## Step 1: Run advisor review

Invoke the same logic as `/lab-review --as=advisor`. Save to `reviews/<date>-<target>-advisor.md` (so the artifact is reusable). Capture:

- 3-5 challenges
- Next action: proceed | reframe | pause

## Step 2: Run reviewer2

Invoke the same logic as `/lab-review --as=reviewer2`. Save artifact. Capture:

- Risk per attack vector (novelty, baselines, ablations, claim strength, generalization, stat rigor)
- Predicted reception and research next action

## Step 3: Run feasibility

Invoke the same logic as `/lab-review --as=feasibility`. Save artifact. Capture:

- Resource gap table
- Feasibility note: feasible / tight / infeasible

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

| Perspective | Finding | Risk / Notes |
|---|---|---|
| Advisor | proceed / reframe / shelve | <1-line summary> |
| Reviewer 2 | borderline / weak / strong reject | <strongest issue> |
| Feasibility | feasible / tight / infeasible | <largest gap> |
| Novelty | clear / contested / probably done | <closest paper> |

## Research alignment recommendation

<alignment state>: ON-TRACK / NEEDS-FOCUS / HIGH-RISK

ON-TRACK: all four perspectives support the current direction. Proceed.
NEEDS-FOCUS: one or more concerns should be addressed, but the research target is still coherent. Specific actions:
  - <action 1>
  - <action 2>
HIGH-RISK: the current plan likely misses the research target unless reframed. Recommended revisions:
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

Alignment: <ON-TRACK | NEEDS-FOCUS | HIGH-RISK>

Full dashboard: reviews/<date>-<target>-autoplan.md
```

If ON-TRACK, suggest: `/lab-exp-init` (or proceed with the existing exp).
If NEEDS-FOCUS, list the specific actions and ask whether to address now or proceed with risk noted.
If HIGH-RISK, still provide a concrete next action; do not turn the review into a hard stop.

## Alignment Rules

The aggregate alignment state follows a clear rule:

- **HIGH-RISK** if any of:
  - Advisor said "shelve"
  - Reviewer 2 found a severe risk
  - Feasibility said "infeasible"
  - Novelty said "probably done"
- **NEEDS-FOCUS** if any of:
  - Advisor said "reframe"
  - Reviewer 2 had moderate severity issues
  - Feasibility said "tight"
  - Novelty said "contested"
- **ON-TRACK** otherwise

Do not hide high risk because the rest looks good. If novelty is "probably done", explain the needed reframe instead of simply blocking progression.

## Don't

- Don't skip any of the four reviews. Run them all.
- Don't combine the four review artifacts into one file—keep them separate so they can be cited individually.
- Don't soft-pedal high-risk findings. The point of `/lab-autoplan` is useful friction that redirects work toward the research goal.
- Don't run autoplan on the same target twice in the same hour without explicit user confirmation; if reviews already exist for today, ask: "Reviews from earlier today exist. Re-run, or open the existing dashboard?"
