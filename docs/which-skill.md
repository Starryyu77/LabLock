# Which Skill

Use this as the routing table before invoking a LabLock skill.

For the full explanation of every skill, see `docs/skills-reference.md`.

## Project Setup

- Unsure which LabLock skill fits the request: `/lab-advice`
- New research repository needs LabLock skeleton, hooks, and CI: `/lab-init`
- Existing research repository needs non-destructive adoption planning or legacy plan/run import: `/lab-migrate`
- Installed LabLock should be upgraded from GitHub or refreshed locally: `/lab-update`
- You want a read-only health report: `/lab-audit`
- You want cleanup candidates and optional apply: `/lab-tidy`
- You are preparing beta dogfood: follow `docs/dogfood.md`

## Planning

- Idea is vague or too broad: `/lab-plan`
- One experiment needs concrete variables, controls, metrics, and criteria: `/lab-plan-exp`
- Existing plan needs pressure test: `/lab-review`
- Existing plan needs all review modes at once: `/lab-autoplan`
- Research direction, story potential, common-problem abstraction, or anomaly meaning needs a taste lens: `/lab-taste`

## Experiment Lifecycle

- Create experiment files and `scope.lock`: `/lab-exp-init`
- Optional Git branch isolation for collaboration/CI/archival history: `/lab-exp-start`
- Start a training or evaluation run: `/lab-exp-run`
- Commit produced a SCOPE-DRIFT warning: `/lab-guard`
- Drift should become a new baseline: `/lab-fork`
- Experiment is done, killed, or superseded: `/lab-exp-finalize`
- Failed/killed/superseded experiment needs writeup: `/lab-postmortem`
- Successful experiment should merge cleanly to main: `/lab-cleanup-pr`

## Debug And Handoff

- Failure needs investigation before fixes: `/lab-debug`
- Failure or anomaly needs papers/docs/forums/community search plus local code diagnosis: `/lab-research-debug`
- Context must be sent to another AI or teammate: `/lab-handoff`
- Another AI should write experiment code/scripts under a specific LabLock experiment: `/lab-handoff --type=implementation`

## Claims, Formalism, Paper

- Multiple results need claim-level interpretation: `/lab-synthesize`
- A result or direction needs "is this meaningful or just a local fact?" interpretation: `/lab-taste`
- Math, loss, or algorithm definition changed: `/lab-formalism-update`
- Paper directory should be bootstrapped: `/lab-paper-init`
- Draft a paper section from supported claims: `/lab-paper-write`
- Check paper claims before sharing/submission: `/lab-paper-audit`
