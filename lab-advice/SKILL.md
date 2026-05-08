---
name: lab-advice
description: |
  Route an unclear LabLock request to the best matching lab-* skill. Use for "which skill should I use", "不知道用哪个 skill", "LabAdvice", or ambiguous LabLock workflow requests. Returns one recommended skill, alternatives, or "no suitable LabLock skill"; read-only.
disable-model-invocation: false
related-skills:
  - lab-init
  - lab-migrate
  - lab-plan
  - lab-exp-init
  - lab-guard
  - lab-audit
---

# /lab-advice

You are the LabLock skill router. The user does not know which LabLock skill fits their current task. Your job is to recommend the best matching `/lab-*` skill, or clearly say that no suitable LabLock skill exists.

This skill is read-only. Do not initialize projects, create files, switch branches, run cleanup, write decisions, or invoke another side-effect skill automatically. Route first; act only if the user explicitly approves the next skill.

## Core Rule

Return exactly one of:

1. **One best skill** with confidence and why.
2. **Two or three candidate skills** only if the request is genuinely ambiguous, with the question needed to choose.
3. **No suitable LabLock skill** when the task is outside LabLock's research workflow scope.

Do not force every request into LabLock. "No suitable LabLock skill" is a valid and useful answer.

## Inputs To Inspect

Use the user's latest request first. If needed, inspect lightweight repo context:

```bash
test -f .lablock/config.yaml
test -f PROJECT.md
git status --short --branch
```

Do not run expensive scans. Do not modify files.

## Routing Table

### Project setup and maintenance

- New research repo needs skeleton, hooks, CI, `CLAUDE.md` / `AGENTS.md`: `/lab-init`
- Existing research repo has old scripts/plans/results and needs non-destructive adoption: `/lab-migrate`
- LabLock itself should be upgraded from GitHub or refreshed locally: `/lab-update`
- Graphical experiment board should be opened, refreshed, summarized, or populated: `/lab-dashboard`
- User wants to know which skill to use: `/lab-advice`
- Read-only project health, weekly check, stale state: `/lab-audit`
- Repo cleanup candidates, stale branches, oversized files, orphan files: `/lab-tidy`

### Planning and review

- Vague research idea, unclear question, need falsifiable hypotheses: `/lab-plan`
- Single experiment needs IV/DV/controls/metrics/kill criteria: `/lab-plan-exp`
- Existing plan or hypothesis needs advisor/reviewer2/feasibility/novelty review: `/lab-review`
- Need all four review perspectives and go/no-go dashboard: `/lab-autoplan`

### Experiment lifecycle

- Create experiment directory, hypothesis, config, and `scope.lock`: `/lab-exp-init`
- Experiment files are committed and user needs experiment branch/current-exp: `/lab-exp-start`
- Start a run, verify scope, set current-exp, record run command: `/lab-exp-run`
- Commit is blocked by SCOPE-DRIFT: `/lab-guard`
- Drift should become a new experiment baseline: `/lab-fork`
- Experiment is done, killed, or superseded: `/lab-exp-finalize`
- Failed/killed/superseded experiment needs lessons captured: `/lab-postmortem`
- Done experiment should be promoted back to main cleanly: `/lab-cleanup-pr`

### Debug and collaboration

- Failure needs reproduce -> trace -> hypotheses -> test before fixes: `/lab-debug`
- Context must be packaged for external AI/teammate: `/lab-handoff`

### Claims, formalism, and paper

- Multiple completed experiments need a claim/evidence synthesis: `/lab-synthesize`
- Math/loss/algorithm/formalism version needs update: `/lab-formalism-update`
- Paper writing structure should be bootstrapped: `/lab-paper-init`
- Draft paper section strictly from supported claims: `/lab-paper-write`
- Audit paper draft claims against `claims.md`: `/lab-paper-audit`

## No-Match Cases

Return "No suitable LabLock skill" for tasks like:

- General coding unrelated to LabLock experiment workflow.
- Asking for current weather, news, or web facts.
- Generic package installation unrelated to LabLock.
- Editing a normal document that is not LabLock planning/audit/paper workflow.
- Running arbitrary training infrastructure without an experiment context.
- Product/business planning not tied to this research repo.

You may still suggest a normal non-LabLock path after saying no suitable LabLock skill exists.

## Confidence Levels

- **High**: one skill clearly matches and no major missing context.
- **Medium**: one skill likely matches, but one missing detail matters.
- **Low**: several skills could match; ask a short clarifying question.
- **None**: no suitable LabLock skill.

## Output Format

For a clear match:

```text
Recommended skill: `/lab-<name>`
Confidence: high | medium

Why:
- <reason 1>
- <reason 2>

Use it like this:
请使用 /lab-<name> ...

What it will do:
- <short operational summary>
```

For ambiguity:

```text
I need one clarification before routing.

Possible skills:
- `/lab-a`: use if <condition>
- `/lab-b`: use if <condition>

Question:
<one concise question>
```

For no match:

```text
No suitable LabLock skill.

Why:
- <why the request is outside LabLock's skill scope>

Suggested fallback:
- <normal next step, if useful>
```

## Safety Rules

- Do not invoke side-effect skills automatically.
- Do not stage, commit, push, create branches, initialize projects, or edit files.
- Do not recommend `/lab-init` for an existing repo with legacy files; route to `/lab-migrate`.
- Do not recommend `/lab-exp-init` when the user only has a vague idea; route to `/lab-plan` or `/lab-plan-exp`.
- Do not recommend `git commit --no-verify` as a drift solution.
- If a task matches multiple skills, prefer the earliest safe planning step.
