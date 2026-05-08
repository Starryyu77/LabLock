---
name: lab-paper-init
description: |
  Bootstrap the paper writing structure. Triggers: "init paper", "start writing paper", "submit to venue".
  User-invoked only: this skill creates paper files and may create a paper branch or snapshot tag.
disable-model-invocation: true
related-skills:
  - lab-paper-write
  - lab-paper-audit
---

# /lab-paper-init

Use this when the project is ready to organize evidence for paper writing.

## Pre-flight

1. Ask for venue or target format.
2. Run `lablock-coverage --json` to understand claim/evidence gaps.
3. Ask whether to create or use a claim snapshot tag.
4. Check if `paper/` already exists and avoid overwriting user drafts.

## Execute

Create or update:

1. `paper/outline.md`
2. `paper/claims-to-evidence.md`
3. `paper/drafts/`
4. Optional `paper/<venue>` branch.

## Verify

1. Every outline claim should map to an ID in `claims.md` or be marked unsupported.
2. Do not create paper prose that overstates evidence.
3. Suggest `/lab-paper-write` for the first section and `/lab-paper-audit` before submission.
