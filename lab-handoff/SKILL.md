---
name: lab-handoff
description: |
  Package context for an external AI or teammate. Triggers: "handoff", "ask another AI", "external AI", "package context".
disable-model-invocation: false
related-skills:
  - lab-debug
---

# /lab-handoff

Use this when the user wants to send a self-contained context bundle outside the current agent.

## Select Type

Ask for or infer one type:

1. `debug`
2. `method`
3. `results`
4. `design`
5. `writing`

## Gather Context

Include only relevant material:

1. Project goal from `PROJECT.md`.
2. Formalism version from `formalism.md`.
3. Experiment hypothesis and lock when applicable.
4. Related claims and evidence.
5. Relevant code or logs.
6. Specific question for the recipient.

## Output

Write `handoffs/outgoing/YYYY-MM-DD-<topic>.md` using the matching handoff template.

The bundle must be self-contained. Avoid references like "see above" or "from our chat".
