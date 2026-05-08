---
name: lab-cleanup-pr
description: |
  Create a clean PR for a successful experiment. Use for "cleanup PR", "merge experiment", "back to main", or "promote exp to main". Classifies diff, asks per-file for utility code, excludes exp scripts/debug noise, then can create a cleanup branch and draft PR. User-invoked only.
disable-model-invocation: true
related-skills:
  - lab-exp-finalize
---

# /lab-cleanup-pr

You are creating a focused PR that brings only the *worth-merging* parts of an experiment back to main. The experiment may have hundreds of changed files; most are scripts, configs, debug code, or experiment-specific tweaks that should NOT pollute main.

## Pre-flight

Required:

- `--exp=<exp-id>`: the experiment whose results to merge.

Verify:

- The experiment is finalized (`status=done`). If not, refuse: "Run /lab-exp-finalize first. Cleanup PRs only make sense for done experiments."
- The experiment branch exists and is pushed to origin (gh PR requires it).
- We're checked out somewhere—doesn't matter where (the skill switches branches as needed).
- `gh` CLI is available and authenticated. If not, the skill can still classify the diff (see Step 1) but can't open a PR; tell user.

## Step 1: Diff and classify

Run:

```bash
lablock cleanup-pr --exp=<exp-id> --base=main --json
```

This CLI command is the classifier/dry-run engine only. It does not create the cleanup branch, copy files, commit, push, or open a PR. This skill performs those manual Git/GitHub steps after the user approves the include set.

The classifier:

- Computes `git diff --name-status main...exp/<exp-id>-*`
- Classifies each file using `lib/classify.ts` rules:
  - `formalism` (formalism.md, derivations/) → **include**
  - `claim` (claims.md) → **include**
  - `decision` (decisions/) → **include**
  - `index` (MAP.md, INDEX.md, experiments/matrix.md) → **exclude** (regenerated automatically)
  - `exp-script` (experiments/exp-NNN-*) → **exclude** (lives in branch + tag)
  - `debug-noise` (code with print/pdb/console.log) → **exclude with warning**
  - `utility` (other code files) → **ASK USER per-file**
  - `doc`, `config`, `other` → **ASK USER per-file**

Default outcome printed as a table:

```
Action      Status  Path
include     M       formalism.md
include     M       claims.md
include     A       decisions/2026-05-08-add-contrastive.md
exclude     M       experiments/exp-007-contrastive/config.yaml
exclude     A       experiments/exp-007-contrastive/results.md
exclude     M       MAP.md
review      M       src/losses/contrastive.py
review      M       src/data/sampler.py
flagged     M       src/train.py  (contains print() — likely debug noise)
```

## Step 2: Walk through "review" and "flagged" items

For each `review` (utility code) item:

- Show the user the file's diff (or just file size and one-line summary).
- Ask: "Include this in main? [Y/n] (Reason this matters: <interpret>)"

For each `flagged` (debug-noise) item:

- Show the suspicious lines (the print/pdb hits).
- Ask: "Include this? Most users would clean up the prints first. [y/N]"
- If user says yes, allow but warn about debug noise leaking to main.

The user's per-file decisions become the include set.

## Step 3: Create cleanup branch

```bash
git checkout main
git pull --ff-only
git checkout -b cleanup/<exp-id>-merge
```

## Step 4: Cherry-pick / patch the included files

For each "include" file (auto + user-confirmed):

- Get its content from `exp/<exp-id>-<shortname>` HEAD: `git show exp/<exp-id>-*:<path>`
- Write to working tree
- Stage

This is **per-file copy**, NOT `git cherry-pick <commit>`. Cherry-pick of commits would bring everything in those commits, including excluded paths. We need surgical inclusion.

Compose a single commit:

```bash
git commit -m "[main] cleanup PR from <exp-id>: <one-line summary of contribution>"
```

Hooks auto-prefix is `[main]` since we're on a non-experiment branch.

## Step 5: Update claims.md frontmatter

If `claims.md` was included and any new claim was added, update its frontmatter:

```yaml
last_updated: <date>
formalism_version: v<N>
```

This sometimes already exists in the experiment branch's version; verify it's current.

## Step 6: Verify CI-relevant files are coherent

Quick sanity:

```bash
lablock-frontmatter-check --strict
lablock-coverage --strict
```

If anything fails (e.g., a new claim references an exp-id but the exp's frontmatter wasn't included), STOP. Tell the user what's missing and let them decide whether to include the additional file.

## Step 7: Push and open draft PR

```bash
git push -u origin cleanup/<exp-id>-merge
```

Then via gh:

```bash
gh pr create --draft \
  --base main \
  --head cleanup/<exp-id>-merge \
  --title "[<exp-id>] cleanup: <one-line summary>" \
  --body "<rendered body, see below>" \
  --label cleanup
```

PR body template (`templates/pr-template-cleanup.md`):

```markdown
# Cleanup PR for <exp-id>

## Hypothesis tested
<from hypothesis.md>

## Outcome
<status: done>
Final results: <key metric numbers>

## What this PR brings to main
- formalism.md changes: <yes/no, summary>
- New claims: <list of claim IDs>
- Decisions: <list of decision filenames>
- Utility code: <list of files included after review>

## What stays in the experiment branch only
- experiment configs and scripts (preserved at tag <exp-id>-final)
- debug code (cleaned up before merge if any)

## Postmortem
<link to postmortem.md if exists>

## Audit
- Coverage check: <pass/fail>
- Frontmatter check: <pass/fail>
- Drift accountability: clean

Reviewed against <exp-id>-final tag.
```

## Step 8: Final report

Print:

```
Cleanup PR opened: <PR URL>

Branch: cleanup/<exp-id>-merge
Base: main
Files included: <N>
Files excluded: <M>

Next step:
- Review the PR yourself in the GitHub UI
- Merge when satisfied
- After merge, you can run /lab-tidy to archive cleanup branches older than 30 days
```

## Failure modes

- **Coverage check fails** in Step 6 → don't create the PR. Show the gaps and let user decide whether to include more files.
- **Working tree not clean before Step 3** → refuse: "Stash or commit your in-progress changes before cleanup."
- **Origin doesn't have `exp/<exp-id>-*`** → tell user to push the experiment branch first.
- **`gh` not authenticated** → fall back to printing the would-be `gh pr create` command for the user to run.

## Don't

- Don't `git cherry-pick` commits. Use per-file copy. Cherry-pick is too coarse.
- Don't auto-include utility code without user confirmation. Yesterday's "useful helper" is tomorrow's main-branch debt.
- Don't include exp-scripts. They live in the experiment branch + tag forever; main shouldn't carry them.
- Don't merge the cleanup PR within this skill. The user reviews in GitHub.
- Don't `--force` push.
