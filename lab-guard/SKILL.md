---
name: lab-guard
description: |
  Resolve a SCOPE-DRIFT detected by the pre-commit hook. Triggers: "drift detected", "scope drift", "pre-commit blocked", "guard", "drift accountability needed", "commit refused". Reads `.git/lablock-commit-meta.json` to understand what drifted, then walks the user through three options: fork (creates new exp), override (records decision and updates lock), or revert (unstages changes). After resolution, the user re-runs `git commit` (without --no-verify). This skill may create files (decisions/), modify scope.lock, unstage changes, or initiate fork; user must invoke explicitly.
disable-model-invocation: true
related-skills:
  - lab-fork
---

# /lab-guard

You are resolving a SCOPE-DRIFT that the pre-commit hook just blocked. The user's commit was refused; they're now invoking you to figure out what to do.

## Pre-flight

1. **Read `.git/lablock-commit-meta.json`.** This file was written by the failed pre-commit. If it doesn't exist, ask: "I don't see a pending commit-meta. Was a commit just blocked? Try the commit again to regenerate the meta." (Note: in some cases pre-commit may have cleaned this up; check the most recent commit log too.)
2. **Read `.lablock/state/current-exp`** to confirm the active experiment.
3. **Read `.lablock/locks/<current-exp>.scope.lock`** to remind the user of the original hypothesis and locked invariants.

## Step 1: Diagnose

Print to user, plainly:

```
SCOPE-DRIFT detected on <exp-id>.

Original hypothesis:
  <from hypothesis.md>

What drifted:
  Layer 1 (config):
    - <key> was <expected>, now <actual>
    - ...
  Layer 2 (files):
    - <path> hash changed (<expected> → <actual>)
    - ...

The pre-commit hook will not accept this commit until accountability is recorded.
```

Don't editorialize. Just show the diff.

## Step 2: Present three paths

```
Three options:

(a) FORK — Create a new experiment with the drifted setup as its baseline.
    Original exp gets marked superseded. Use this when:
    - The drift represents a genuinely different configuration worth testing
    - You want to keep the original exp for comparison
    - You don't fully trust the drift

(b) OVERRIDE — Record a decision file explaining why this drift is acceptable,
    optionally update scope.lock to reflect new invariants. Use this when:
    - The drift is a fix to an incorrect original lock (e.g., lr was wrong)
    - The change is intentional and the experiment should continue under new invariants

(c) REVERT — Unstage the offending changes and abort the commit. Use this when:
    - The drift was unintentional (you didn't mean to change lr)
    - You want to undo and try again
```

Ask: "Which path?"

## Path (a): Fork

Confirm: "Create a fork of `<current-exp>` capturing the drifted state as the new baseline?"

If yes:

1. Ask for shortname: e.g., `<original>-fork` or something descriptive of the drift.
2. Ask for reason (one sentence). This becomes the decision file.
3. Run:
   ```bash
   lablock fork \
     --from=<current-exp> \
     --shortname=<new-shortname> \
     --reason="<reason>" \
     --source=staged \
     --stage
   ```
4. The fork command:
   - Allocates next exp-NNN
   - Copies scope.lock with drifted values absorbed as new invariants
   - Marks original exp as superseded (status in frontmatter and lock)
   - Writes `decisions/<date>-fork-<from>-to-<to>-<change-id>.md`
   - Stages all changes
5. Tell user: "Re-run `git commit -m '<your message>'` now. The hook will accept because the fork accountability is staged."

## Path (b): Override

Confirm: "Record an override decision and continue with `<current-exp>` under updated invariants?"

If yes:

1. Ask for reason (1-2 sentences). This must be specific—"lr should be 1e-4 because original lock was a typo" not "needed".
2. Ask: "Do you also want to update scope.lock to reflect the new invariants?" (Recommended: yes. Otherwise the same drift will trigger again next commit.)
3. Run:
   ```bash
   lablock override --exp=<current-exp> --reason="<reason>"
   ```
   This:
   - Verifies drift is actually staged
   - Generates change-id
   - Renders `decisions/<date>-override-<exp-id>-<change-id>.md`
   - Stages the decision
   - Writes the override info to `.git/lablock-commit-meta.json`
4. If user said "yes" to updating scope.lock:
   - Read `.lablock/locks/<exp-id>.scope.lock`
   - Update the drifted keys/file hashes to the new values
   - Save and `git add .lablock/locks/<exp-id>.scope.lock`
   - The decision file should also note that scope.lock was updated.
5. Tell user: "Re-run `git commit -m '<your message>'`. The hook will accept (override is staged, drift is acknowledged)."

## Path (c): Revert

Confirm: "Unstage the offending changes and abort the commit?"

If yes:

1. Identify the drifted files from the meta:
   - Layer 1: the `experiments/<exp-id>-*/config.yaml`
   - Layer 2: the listed paths in `drift_layers.files`
2. For each, run `git reset HEAD <path>` to unstage. Optionally `git checkout -- <path>` to discard working changes (ask the user first—this is destructive).
3. Tell user: "Drift unstaged. The originally-staged non-drifting changes are still staged. Re-run your commit; the hook should accept now."

## Step: Re-attempt commit (all paths)

After whichever path was taken, prompt the user:

> Now re-run your commit:
>
> ```bash
> git commit -m "<your original message>"
> ```
>
> The hook should accept this time. If it still fails, run `/lab-guard` again with the new diagnosis.

## Special cases

- **Multi-layer drift** (config + files both): the user can fork once to absorb both, or override once with reason covering both. Don't make them resolve layer-by-layer.
- **Drift in a file that shouldn't have been an invariant** (the original lock was over-restrictive): use override path, update scope.lock to remove that file from `locked_invariants.files`, and write the decision explaining why the lock was overcautious.
- **Drift on a paper branch**: this should not happen because paper branches don't track exp state. If the user got here on `paper/*`, something is misconfigured; tell them to switch branches.

## Don't

- Don't suggest `git commit --no-verify`. That bypasses local hook but CI will reject on push to protected branches. The user is also not building good habits.
- Don't make the choice for the user. Present the three options clearly and let them decide.
- Don't delete files in revert path without explicit confirmation.
- Don't proceed with override if `lablock override` reports "no SCOPE-DRIFT detected"—that means the staged content doesn't actually drift. Tell the user to re-stage their changes or check the meta.
