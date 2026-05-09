---
name: lab-exp-start
description: |
  Optionally create a Git branch for an already-committed experiment when history isolation, remote CI, collaboration, or cleanup PR flow is needed. Requires a clean tree, creates exp/<exp-id>-<shortname>, sets current-exp, and optionally pushes. Folder isolation remains the default. User-invoked only.
disable-model-invocation: true
related-skills:
  - lab-exp-init
  - lab-exp-run
  - lab-exp-finalize
---

# /lab-exp-start

You are creating an optional Git branch for an experiment that already exists as a folder-isolated LabLock node. The user has already run `/lab-exp-init` and committed the experiment files on `main` or the chosen base branch. Only do this when they explicitly want branch-based history isolation, remote CI, collaboration, or cleanup PR flow.

## Pre-flight

Required:

- `--exp=<exp-id>`: the experiment to start. Must already exist (created by `/lab-exp-init`).

Verify:

1. **Experiment exists**: `experiments/<exp-id>-*/hypothesis.md` and `.lablock/locks/<exp-id>.scope.lock` are present.
2. **Working tree clean**: the current `lablock exp-start` CLI calls `ensureCleanTree()`. If any file is staged or dirty, refuse: "Commit the exp-init files first, or stash unrelated work."
3. **Currently on `main` (or specified `--base`)**: if on another branch, refuse: "Switch to main first, or pass `--base=<branch>`."
4. **Branch doesn't already exist**: `git branch --list exp/<exp-id>-*` returns empty.

## Step 1: Run the CLI

```bash
lablock exp-start \
  --exp=<exp-id> \
  --base=main \
  --push  # optional, only if origin is configured
```

This:

- Switches to `<base>` (default `main`)
- Creates branch `exp/<exp-id>-<shortname>`
- Sets `.lablock/state/current-exp` to `<exp-id>` (gitignored)
- Optionally pushes with `-u origin <branch-name>`

The skill will print the branch name as confirmation.

## Step 2: Verify branch state

After branch creation, verify:

```bash
git status            # should be clean
git branch --show-current   # should be exp/<exp-id>-*
cat .lablock/state/current-exp   # should be <exp-id>
```

Read the latest commit log to confirm the exp-init commit exists on the base branch:

```bash
git log -1 --format="%B"
```

Expected:
- A recent commit created `experiments/<exp-id>-*` and `.lablock/locks/<exp-id>.scope.lock`.
- Generated projections include the new experiment.

## Step 3: Push (optional)

If user passed `--push` or you confirmed `origin` is configured:

```bash
git push -u origin exp/<exp-id>-<shortname>
```

If push fails (e.g., remote rejects new branches): tell user to push manually or check repo settings. Don't error out the whole skill.

## Step 4: Final report

Print:

```
Experiment branch ready: exp/<exp-id>-<shortname>

Status:
- current-exp set to <exp-id>
- exp-init files were already committed before branch creation
- Pushed to origin: yes/no

Drift detection is now active for this branch:
- Layer 1 (config): <K> keys locked
- Layer 2 (files): <N> files locked
- Layer 3 (probes): <P> probes (run on <when>)

Suggested next:
- /lab-exp-run to launch training
- Or commit code changes; the hook will track them
```

## Step 5: Reminder about scope.lock

Tell the user once, clearly:

> While you're on `exp/<exp-id>-*`, every commit is checked against `.lablock/locks/<exp-id>.scope.lock`. Changes that touch:
>
> - locked config keys (in the experiment's config.yaml), or
> - locked file SHAs
>
> ...will be blocked by the pre-commit hook unless you handle drift via `/lab-fork`, `lablock override`, or revert.
>
> If your understanding of the experiment's scope changes substantially, that's a fork situation, not a casual commit.

## Special cases

- **Detached HEAD on entry**: refuse: "You're in detached HEAD state. Check out a branch first."
- **Origin not configured**: skip `--push`, warn that the branch is local-only and CI won't run on it until pushed.
- **Branch already exists locally** (e.g., user re-running): if same exp, switch to it and confirm. If different content, refuse.

## Don't

- Don't run `/lab-exp-init`'s logic here. That's a separate skill, run first.
- Don't push without `--push` or explicit user confirmation.
- Don't `--force` push, ever.
- Don't try to start an experiment from a paper branch. The base must be `main` or another exp branch (rare).
- Don't skip Step 2 verification. If the exp-init commit is missing, switch back to the base branch and commit it before starting the experiment branch.
