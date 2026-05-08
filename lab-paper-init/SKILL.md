---
name: lab-paper-init
description: |
  Bootstrap the paper writing structure. Triggers: "init paper", "start writing paper", "set up paper directory", "submit to <venue>", "paper init", "draft submission". Creates paper/outline.md, paper/claims-to-evidence.md, paper/drafts/ subdirectory, and optionally creates a paper/<venue> branch from a frozen claim snapshot tag. This skill writes files and may create a git branch and tag; user must invoke explicitly.
disable-model-invocation: true
related-skills:
  - lab-paper-write
  - lab-paper-audit
---

# /lab-paper-init

You are setting up the paper directory and (optionally) a dedicated paper branch. This is typically run when the user has accumulated enough empirical claims to start drafting.

## Pre-flight

1. **Check that the project has claims with evidence.** Run `lablock-coverage --json`. If there are zero `[empirical]` claims, ask: "You have no empirical claims yet. Are you sure you want to set up paper structure now? It's usually done after a few done experiments." Allow override but flag this.
2. **Check `paper/` doesn't already exist with content.** If `paper/outline.md` exists, ask whether to overwrite or proceed without re-rendering templates.
3. **Verify `formalism.md` is at a stable version.** If formalism has been bumped within the last 7 days, warn: "Recent formalism changes may not be settled. Confirm the paper should be based on formalism `<current-version>`."

## Step 1: Venue

Ask: "What's the target venue?"

Examples: `neurips-2026`, `cvpr-2026`, `iclr-2027-workshop`, `tmlr`, `arxiv-preprint`.

Use a slug-like name—it becomes the branch name `paper/<venue>`. Lowercase, dashes only.

## Step 2: Snapshot strategy

Ask: "Should we freeze a claim snapshot before starting the paper, or use the current state of `main`?"

Two modes:

- **Freeze** (recommended for serious submissions). Creates a tag `claim-frozen-<date>` pointing at current `main`. The paper branch is cut from this tag. Future experiments on `main` won't disturb the paper.
- **Live main**. Paper branch tracks `main`. Useful for ongoing preprints where you want to absorb new results.

If `freeze`:

```bash
git checkout main
git pull --ff-only
git tag "claim-frozen-$(date +%Y-%m-%d)"
git push origin "claim-frozen-$(date +%Y-%m-%d)"
```

## Step 3: Create paper directory and templates

Render the following:

- `paper/outline.md` — section outline with placeholders (Introduction, Related Work, Method, Experiments, Discussion, Limitations, Conclusion)
- `paper/claims-to-evidence.md` — table mapping each planned claim to specific exp-IDs and gap status
- `paper/drafts/` — empty directory for per-section drafts
- `paper/.frozen-at` — text file recording the snapshot tag (if used)

Pre-populate `claims-to-evidence.md` from current `claims.md`:

```markdown
| Claim ID | Statement | Strength | Evidence | Gap |
|---|---|---|---|---|
| C1 | ... | empirical | exp-005, exp-007 | (none) |
| C3 | ... | empirical | exp-002 | needs single-component ablation |
| C5 | ... | hypothesis | exp-009 | needs >1 OOD dataset |
```

This table is the **contract** for `/lab-paper-write` and `/lab-paper-audit`. Do not skip.

## Step 4: Create paper branch

```bash
git checkout -b "paper/<venue>" "<base-tag-or-main>"
git add paper/
git commit -m "[paper] init paper/<venue> structure"
git push -u origin "paper/<venue>"
```

## Step 5: Final report

Print:

- Branch created: `paper/<venue>`
- Snapshot: `claim-frozen-<date>` if applicable
- Files created: `paper/outline.md`, `paper/claims-to-evidence.md`
- Coverage status from `lablock-coverage` — if any `[empirical]` claim is missing evidence, flag it now
- Next step: "Run `/lab-paper-audit` to verify claim coverage, then `/lab-paper-write --section=intro` to draft."

## Failure modes

- **`gh push` fails** because remote rejects new branch creation: tell user to run manually or check permissions.
- **Tag already exists** (re-running on same day): suggest appending `-2` or pick a different name.
- **`main` not clean** when checking out: refuse and tell user to commit/stash.

## Don't

- Don't create the paper directory if `lablock-coverage` shows zero empirical claims, without an explicit confirmation.
- Don't skip the `claims-to-evidence.md` initialization—`/lab-paper-write` depends on it.
- Don't try to write any actual paper content here. This skill only sets up structure.
- Don't use a venue name with spaces or special chars in the branch name; slugify first.
