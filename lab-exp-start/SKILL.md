---
name: lab-exp-start
description: |
  Create the git branch for an experiment after `/lab-exp-init`. Triggers: "start experiment branch", "create exp branch", "branch off", "begin exp", "start working on exp". Creates `exp/<exp-id>-<shortname>` from main (or specified base), makes initial commit (scope.lock + hypothesis.md + experiment dir), pushes to origin if configured, and sets `.lablock/state/current-exp` to focus subsequent commits on this experiment. This skill creates a branch, commits, optionally pushes; user must invoke explicitly.
disable-model-invocation: true
related-skills:
  - lab-exp-init
  - lab-exp-run
  - lab-exp-finalize
---

# /lab-exp-start

You are creating the git branch for a newly-initialized experiment. The user has run `/lab-exp-init`; the experiment files are present (or staged); now we make a real branch.

## Pre-flight

Required:

- `--exp=<exp-id>`: the experiment to start. Must already exist (created by `/lab-exp-init`).

Verify:

1. **Experiment exists**: `experiments/<exp-id>-*/hypothesis.md` and `.lablock/locks/<exp-id>.scope.lock` are present.
2. **Working tree clean** (or only the staged exp-init files): if dirty with unrelated changes, refuse: "Working tree has uncommitted changes outside the new experiment. Commit or stash first."
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
- Stages the state file (it's not tracked but is staged for clarity)
- Optionally pushes with `-u origin <branch-name>`

The skill will print the branch name as confirmation.

## Step 2: Initial commit

If the exp-init files weren't already committed (check `git log` for an "initial create" commit on the new branch), do an initial commit:

```bash
git add experiments/<exp-id>-* .lablock/locks/<exp-id>.scope.lock
git commit -m "create <exp-id>"
```

Hooks will:

- Recognize `current-exp` is set
- Auto-prefix `[<exp-id>][CODE]`
- Add `LabLock-Change` trailer
- Initialize `.lablock/changes/<exp-id>.changes.log`
- Generate / update `MAP.md` and `experiments/matrix.md` because new hypothesis.md is staged

## Step 3: Verify branch state

After commit, verify:

```bash
git status            # should be clean
git branch --show-current   # should be exp/<exp-id>-*
cat .lablock/state/current-exp   # should be <exp-id>
```

Read the new commit log to confirm hooks worked:

```bash
git log -1 --format="%B"
```

Expected:
- First line: `[<exp-id>][CODE] create <exp-id>`
- Trailer: `LabLock-Change: chg-XXXXXXXX`

## Step 4: Push (optional)

If user passed `--push` or you confirmed `origin` is configured:

```bash
git push -u origin exp/<exp-id>-<shortname>
```

If push fails (e.g., remote rejects new branches): tell user to push manually or check repo settings. Don't error out the whole skill.

## Step 5: Final report

Print:

```
Experiment branch ready: exp/<exp-id>-<shortname>

Status:
- current-exp set to <exp-id>
- Initial commit created with auto-prefix and LabLock-Change trailer
- Pushed to origin: yes/no
- changes.log initialized

Drift detection is now active for this branch:
- Layer 1 (config): <K> keys locked
- Layer 2 (files): <N> files locked
- Layer 3 (probes): <P> probes (run on <when>)

Suggested next:
- /lab-exp-run to launch training
- Or commit code changes; the hook will track them
```

## Step 6: Reminder about scope.lock

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
- Don't skip Step 3 verification. If hooks didn't fire on initial commit, something is misconfigured.
