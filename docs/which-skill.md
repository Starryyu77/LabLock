# Which Skill

Use this as the routing table before invoking a LabLock skill.

## Project Setup

- New research repository needs LabLock skeleton, hooks, and CI: `/lab-init`
- Existing research repository needs non-destructive adoption planning: `/lab-migrate`
- Installed LabLock skills are stale and should be refreshed from local source: `/lab-update`
- You want a read-only health report: `/lab-audit`
- You want cleanup candidates and optional apply: `/lab-tidy`
- You are preparing beta dogfood: follow `docs/dogfood.md`

## Planning

- Idea is vague or too broad: `/lab-plan`
- One experiment needs concrete variables, controls, metrics, and criteria: `/lab-plan-exp`
- Existing plan needs pressure test: `/lab-review`
- Existing plan needs all review modes at once: `/lab-autoplan`

## Experiment Lifecycle

- Create experiment files and `scope.lock`: `/lab-exp-init`
- Create isolated experiment branch and current-exp state: `/lab-exp-start`
- Start a training or evaluation run: `/lab-exp-run`
- Commit is blocked by SCOPE-DRIFT: `/lab-guard`
- Drift should become a new baseline: `/lab-fork`
- Experiment is done, killed, or superseded: `/lab-exp-finalize`
- Failed/killed/superseded experiment needs writeup: `/lab-postmortem`
- Successful experiment should merge cleanly to main: `/lab-cleanup-pr`

## Debug And Handoff

- Failure needs investigation before fixes: `/lab-debug`
- Context must be sent to another AI or teammate: `/lab-handoff`

## Claims, Formalism, Paper

- Multiple results need claim-level interpretation: `/lab-synthesize`
- Math, loss, or algorithm definition changed: `/lab-formalism-update`
- Paper directory should be bootstrapped: `/lab-paper-init`
- Draft a paper section from supported claims: `/lab-paper-write`
- Check paper claims before sharing/submission: `/lab-paper-audit`
