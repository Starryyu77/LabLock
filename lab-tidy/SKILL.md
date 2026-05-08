---
name: lab-tidy
description: |
  Dry-run repository hygiene audit. Use for "tidy repo", "clean up branches", "archive old experiments", or "repo housekeeping". Reports stale branches, oversized files, expired handoffs, and orphan files; --apply requires per-item consent.
disable-model-invocation: false
related-skills:
  - lab-audit
---

# /lab-tidy

You are doing repository hygiene. Find what's stale, what's mis-located, what's bloating the repo, and (optionally) clean it up. Default is **dry-run**—you only act on items the user explicitly approves.

## Pre-flight

- `--apply` (default off): if absent, you only report. If present, you walk each finding with the user.
- Read `.lablock/config.yaml > git.archive_after_days` (default 30) for the cutoff.

## Step 1: Scan for issues

Run all six checks. Each produces a finding list. Reports go into one structured payload.

### Check 1: Orphan branches

Branches whose corresponding experiment is `done`, `killed`, or `superseded` AND the branch is older than `archive_after_days`.

```bash
git for-each-ref --format='%(refname:short) %(committerdate:iso)' refs/heads/exp/
# For each branch, parse the exp-id, look up status from experiments/<exp-id>-*/hypothesis.md
```

Outcome: list of branches → suggest renaming to `archive/<original-name>`.

### Check 2: Dangling commits

Commits not in any branch or tag.

```bash
git fsck --no-reflogs --unreachable --no-progress 2>/dev/null | grep '^unreachable commit'
```

Filter to those older than 14 days (recent dangling commits may be intentional rebases).

Outcome: list with first-line of commit message → suggest GC, but be cautious; don't auto-prune.

### Check 3: Stale tracking branches

Branches that exist locally with `[gone]` upstream (origin deleted them):

```bash
git remote prune origin --dry-run
git branch -vv | grep ': gone]'
```

Outcome: list → suggest `git branch -D <name>` per branch.

### Check 4: Oversized non-LFS files

Files larger than `.lablock/config.yaml > git.lfs_threshold_mb` that are tracked but not via LFS:

```bash
git ls-files | xargs -I {} stat -c '%s %n' {} 2>/dev/null | awk '$1 > THRESHOLD'
git check-attr filter <files>   # confirm not LFS
```

Outcome: list → suggest moving to LFS.

### Check 5: Expired handoff branches

Branches matching `handoff/*` older than 7 days:

```bash
git for-each-ref --format='%(refname:short) %(committerdate:iso)' refs/heads/handoff/
```

Outcome: list → suggest deletion.

### Check 6: Dead experiments needing archive

Experiments with `status: killed` or `status: superseded` whose:
- Postmortem exists (so we have a record)
- `finalized_at` is older than `archive_after_days`

Suggest moving the branch to `archive/<original-name>` namespace via:

```bash
git branch -m exp/<exp-id>-<shortname> archive/exp-<exp-id>-<shortname>
git push origin :exp/<exp-id>-<shortname> archive/exp-<exp-id>-<shortname>   # rename remotely
```

## Step 2: Report

Print a structured summary, even in dry-run:

```
LabLock Tidy Report (<date>)

Orphan branches (<N>):
  - exp/exp-005-baseline (status=done, finalized 45d ago)
  - exp/exp-009-ood (status=killed, finalized 92d ago)

Dangling commits (<N>):
  - <hash> "<message>" (created <date>)

Stale tracking (<N>):
  - <branch> [gone]

Oversized non-LFS (<N>):
  - <path> (<size>)

Expired handoffs (<N>):
  - handoff/2026-04-15-debug-nan (8d ago)

Dead experiments to archive (<N>):
  - exp-005, exp-009

Total findings: <N>

Run with --apply to walk each item with a yes/no/skip prompt.
```

## Step 3 (only if `--apply`): Walk findings

For each finding, ask: `[Y/n/s]` (yes / no / skip rest of category).

For each "yes":

- **Orphan branch** → `git branch -m exp/... archive/exp-...` and `git push origin :exp/... archive/exp-...`
- **Dangling commit** → typically don't auto-act. Suggest user run `git gc --prune=now` manually.
- **Stale tracking** → `git branch -D <name>`
- **Oversized non-LFS** → don't auto-move. Print the LFS migration command and let user run.
- **Expired handoff** → `git branch -D <name> && git push origin :<name>`
- **Dead experiment archive** → same as orphan branch

After each yes, print confirmation. Don't batch errors silently—if a `git push` fails, report immediately.

## Step 4: Save the report

Even in dry-run, save:

```
reviews/tidy-<date>.md
```

So the user has a record of what was found and what (if anything) was done.

## Step 5: Final report

Print:

```
Tidy complete.

Findings: <N>
Actions taken: <M> (<dry-run/apply mode>)

Items skipped or declined: <K>

Next: review reviews/tidy-<date>.md for details.
```

## Special cases

- **Concurrent users**: if multiple developers share the repo, deleting branches is destructive. Flag any orphan branch with commits authored by someone other than the current `git config user.email` and require explicit confirmation.
- **Repo size won't shrink immediately** after deleting branches: explain that `git gc` is needed for actual disk reclamation.
- **First run**: if findings count is huge (50+), batch by category and ask "process all orphan branches as `--apply` or skip category?".

## Don't

- Don't delete anything in dry-run mode. Default behavior must be safe.
- Don't auto-`git gc --prune=now`. Suggest it; let user confirm.
- Don't delete branches authored by someone else without confirmation.
- Don't take `--apply` as license to skip per-item confirmations. Each finding needs explicit yes.
- Don't operate on `main` or `paper/*`—they're protected, not orphaned.
