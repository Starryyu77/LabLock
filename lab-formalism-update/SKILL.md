---
name: lab-formalism-update
description: |
  Bump formalism version with echo-back protocol. Triggers: "update formalism", "change loss definition", "bump formalism".
  User-invoked only: this skill edits protected formalism files and writes a decision record.
disable-model-invocation: true
related-skills:
  - lab-synthesize
---

# /lab-formalism-update

Use this when math, notation, loss definitions, or algorithms change.

## Echo-back Protocol

1. Read `formalism.md`.
2. Restate the current relevant definition in your own words.
3. Ask the user to confirm the restatement before editing.
4. If the user says the restatement is wrong, correct understanding first and do not edit.

## Plan the Change

Ask for:

1. What definition or algorithm changes.
2. Why the old version is insufficient.
3. Which claims, experiments, and paper sections may become stale.

## Execute

1. Bump the formalism version.
2. Edit `formalism.md`.
3. Create `decisions/YYYY-MM-DD-formalism-bump-vN.md`.
4. Search `.py`, `.ts`, `.md`, and `.tex` files for stale version references.

## Verify

1. Run `lablock-frontmatter-check --strict`.
2. Run `lablock-coverage --strict` when claims changed.
3. Report every stale reference found, even if not fixed.
