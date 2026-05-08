---
name: lab-cleanup-pr
description: |
  Generate a clean PR merging only necessary parts of a successful experiment. Triggers: "cleanup PR", "merge experiment", "back to main".
  User-invoked only: this skill creates cleanup branches, stages curated changes, and may open a GitHub PR.
disable-model-invocation: true
related-skills:
  - lab-exp-finalize
---

# /lab-cleanup-pr

Use this after a successful experiment when only durable changes should return to `main`.

## Pre-flight

1. Confirm the experiment status is `done`.
2. Confirm `results.md` contains the evidence supporting merge.
3. Run `lablock-drift-audit --strict --json`.
4. Check GitHub authentication if a PR will be opened.

## Classify Changes

Classify the experiment branch diff:

1. Auto-include formalism, claims, decisions, docs required by the result.
2. Ask before including shared utility code.
3. Exclude experiment-only scripts unless the user explicitly wants them promoted.
4. Reject or quarantine debug noise.

Start with a dry-run:

```bash
lablock cleanup-pr --exp=<exp-id> --dry-run
```

## Execute

After the user approves the curated file list, create a cleanup branch and stage only the approved changes. Open a draft PR if requested.

## Verify

1. Run frontmatter, scope, coverage, and drift audit checks.
2. Confirm the PR body references hypothesis, result evidence, and any postmortem.
3. Report excluded files so the user can audit what did not merge.
