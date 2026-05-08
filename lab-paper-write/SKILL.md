---
name: lab-paper-write
description: |
  Write a paper section based strictly on claims.md. Triggers: "write section", "draft paper", "write intro", "method section".
disable-model-invocation: false
related-skills:
  - lab-paper-audit
  - lab-synthesize
---

# /lab-paper-write

Use this to draft paper prose while preserving evidence boundaries.

## Inputs

Read:

1. `paper/outline.md`.
2. `claims.md`.
3. `paper/claims-to-evidence.md`.
4. Related `results.md` or derivation files.

## Writing Rules

1. Only make claims supported by `claims.md`.
2. Mark each substantive sentence with claim IDs in comments or margin notes when useful.
3. If the user asks for an unsupported claim, refuse to state it as fact and propose a weaker version or experiment.
4. Keep method prose aligned with the current `formalism.md` version.

## Output

Write `paper/drafts/<section>.md`.

End with unsupported gaps and suggested experiments or claim edits.
