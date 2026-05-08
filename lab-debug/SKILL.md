---
name: lab-debug
description: |
  Systematic debugging with no fixes before investigation. Triggers: "debug", "why is X failing", "investigate".
disable-model-invocation: false
related-skills:
  - lab-handoff
---

# /lab-debug

Use this when something is broken and the cause is not yet known.

## Debug Law

Do not apply fixes before reproducing or forming a testable hypothesis.

## Protocol

1. Reproduce the failure or capture why it cannot be reproduced.
2. Record command, environment, input, output, and traceback.
3. Trace the data flow one or two layers upstream and downstream.
4. List hypotheses with expected observations.
5. Test the most likely hypothesis with the smallest probe.
6. Attempt at most three fixes before stepping back and writing a handoff.

## Output

Write `debug/YYYY-MM-DD-<topic>.md` with:

1. Reproduction.
2. Observations.
3. Hypotheses.
4. Tests run.
5. Fix attempts.
6. Current blocker or resolution.

Use `/lab-handoff --type=debug` if the problem should be packaged for another AI or teammate.
