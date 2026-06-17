---
name: lab-advice
description: |
  Route an unclear LabLock request to the best matching lab-* skill. Use for "which skill should I use", "不知道用哪个 skill", "LabAdvice", or ambiguous LabLock workflow requests. Returns one recommended skill, alternatives, or "no suitable LabLock skill"; read-only.
disable-model-invocation: false
related-skills:
  - lab-init
  - lab-migrate
  - lab-literature-research
  - lab-methodology-synthesis
  - lab-research-story
  - lab-plan
  - lab-plan-exp
  - lab-roadmap
  - lab-monitor
  - lab-deguard
  - lab-exp-init
  - lab-guard
  - lab-research-debug
  - lab-audit
---

# /lab-advice

You are the LabLock vNext skill router. The user does not know which LabLock skill fits their current research workflow stage. Your job is to identify the stage, recommend the best matching `/lab-*` skill, and explain the expected artifact and next step.

This skill is read-only. Do not initialize projects, create files, switch branches, run cleanup, write decisions, or invoke another side-effect skill automatically. Route first; act only if the user explicitly approves the next skill.

## Core Rule

Return exactly one of:

1. **One best skill** with confidence, stage, artifact, and why.
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

## vNext Stage Routing

### Stage 0: Migration and compatibility

- New research repo needs skeleton, hooks, CI, `CLAUDE.md` / `AGENTS.md`: `/lab-init`
- Existing research repo has old scripts/plans/results and needs non-destructive adoption or legacy node import: `/lab-migrate`
- Old LabLock repo needs vNext compatibility planning: `/lab-migrate` for now; future `/lab-vnext-migrate`
- LabLock itself should be upgraded from GitHub or refreshed locally: `/lab-update`
- Read-only project health, weekly check, stale state: `/lab-audit`
- Repo cleanup candidates, stale branches, oversized files, orphan files: `/lab-tidy`
- Graphical board request: `/lab-dashboard` only as legacy/optional visualization, not vNext monitoring default

### Stage 1: Research direction formation

- Vague research idea, unclear question, need falsifiable hypotheses: `/lab-plan`
- Idea needs literature research, paper lineage, gaps, or positioning: `/lab-literature-research`
- Literature and resources need a candidate methodology: `/lab-methodology-synthesis`
- Direction needs a coherent Research Narrative or Lab Story: `/lab-research-story`
- Existing plan or hypothesis needs advisor/reviewer2/feasibility/novelty review: `/lab-review`
- Need all four review perspectives and a combined review bundle: `/lab-autoplan`
- Need a research taste lens for direction choice, story potential, common-problem abstraction, anomaly meaning, or "科研品味": `/lab-taste`

### Stage 2: Experiment plan and roadmap

- Research direction is ready to become an interactive experiment plan with stage goals, constraints, deliverables, and success criteria: `/lab-plan-exp`
- Approved plan needs a step-by-step execution route: `/lab-roadmap`
- Objective needs review for clarity, executability, verifiability, or defensive bloat: `/lab-review` for now; future `/lab-objective-review`
- Plan is confirmed and experiment files should be created: `/lab-exp-init`

### Stage 3: Handoff orchestration

- Another AI should write experiment code/scripts under the current research objective: `/lab-handoff --mode=execution` or current `/lab-handoff --type=implementation`
- External expert/advisor/community/AI should judge a problem or propose solution paths: `/lab-handoff --mode=expert-consultation`
- Incoming handoff reply should be summarized or converted to next actions: `/lab-handoff --mode=reply`
- Context must be packaged for external AI/teammate: `/lab-handoff`

### Stage 4: Execution monitoring

- User asks "where are we", "progress", "current result", "阶段性结论": `/lab-monitor`
- Need a short current-state answer: `/lab-monitor` for now; future `/lab-status`
- Need time-window digest from commits/handoffs/results/logs: `/lab-monitor` for now; future `/lab-progress-digest`
- Start a run, verify scope, set current-exp, record run command: `/lab-exp-run`

### Stage 5: Problem diagnosis

- Failure needs research-aligned reproduce -> hypothesis -> minimal fix: `/lab-debug`
- Experiment issue needs literature/docs/forum/community research plus local code diagnosis: `/lab-research-debug`
- Unclear problem should be escalated to external expert: `/lab-handoff --mode=expert-consultation`

### Stage 6: Interpretation and next decision

- Multiple completed experiments need a claim/evidence synthesis: `/lab-synthesize`
- Failed/killed/superseded experiment needs lessons captured: `/lab-postmortem`
- Experiment is done, killed, or superseded: `/lab-exp-finalize`

### Stage 7: Agent behavior degating

- Agent adds broad gates, validators, retries, fallbacks, abstractions, or policy checks unrelated to the objective: `/lab-deguard`
- Commit produced a SCOPE-DRIFT warning in a legacy/lock flow: `/lab-guard`
- Drift should become a new experiment baseline in legacy/lock flow: `/lab-fork`

### Stage 8: Paper and knowledge capture

- Math/loss/algorithm/formalism version needs update: `/lab-formalism-update`
- Paper writing structure should be bootstrapped: `/lab-paper-init`
- Draft paper section strictly from supported claims: `/lab-paper-write`
- Audit paper draft claims against `claims.md`: `/lab-paper-audit`
- Done experiment should be promoted back to main cleanly: `/lab-cleanup-pr`

## No-Match Cases

Return "No suitable LabLock skill" for tasks like:

- General coding unrelated to LabLock experiment workflow. If coding is for a LabLock experiment, route to `/lab-handoff --mode=execution` or legacy `/lab-handoff --type=implementation` to generate the prompt for the coding agent.
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
Stage: <vNext stage name>
Recommended skill: `/lab-<name>`
Confidence: high | medium

Why:
- <reason 1>
- <reason 2>

Expected artifact:
- <file or report>

Use it like this:
请使用 /lab-<name> ...

Next step after that:
- <next skill or decision>
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
