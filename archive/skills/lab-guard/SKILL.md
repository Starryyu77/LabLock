---
name: lab-guard
description: |
  Classify a SCOPE-DRIFT warning against the active research objective. Triggers: "drift detected", "scope drift", "guard", "alignment warning", or "should this become a fork?". Reads commit metadata/current diff and walks through fork, override, continue-with-note, or revert. User-invoked only.
disable-model-invocation: true
related-skills:
  - lab-fork
---

# /lab-guard

You are classifying a SCOPE-DRIFT warning. The local commit may already have succeeded; your job is not to unlock progress. Your job is to recenter the user on the original research objective and decide whether the drift changes the experiment's meaning.

## Pre-flight

1. **Read available drift context.** Prefer `.git/lablock-commit-meta.json` if present. If it was already cleared by post-commit, inspect the latest `[SCOPE-DRIFT]` commit and `.lablock/changes/<exp>.changes.log`.
2. **Read `.lablock/state/current-exp`** to confirm the active experiment.
3. **Read `.lablock/locks/<current-exp>.scope.lock`** to remind the user of the original hypothesis and locked invariants.

## Step 1: Diagnose Against The Research Objective

Print to user, plainly:

```
SCOPE-DRIFT warning on <exp-id>.

Original hypothesis:
  <from hypothesis.md>

What drifted:
  Layer 1 (config):
    - <key> was <expected>, now <actual>
    - ...
  Layer 2 (files):
    - <path> hash changed (<expected> → <actual>)
    - ...

Research alignment question:
  Does this drift help test the original hypothesis, change the hypothesis, or distract from it?
```

Be concrete. Explain the drift's effect on the original research target before discussing process.

## Step 2: Present three paths

```
Four options:

(a) FORK — Create a new experiment with the drifted setup as its baseline.
    Original exp gets marked superseded. Use this when:
    - The drift represents a genuinely different configuration worth testing
    - You want to keep the original exp for comparison
    - You don't fully trust the drift

(b) OVERRIDE — Record a decision file explaining why this drift is acceptable,
    optionally update scope.lock to reflect new invariants. Use this when:
    - The drift is a fix to an incorrect original lock (e.g., lr was wrong)
    - The change is intentional and the experiment should continue under new invariants

(c) CONTINUE WITH NOTE — Keep the commit as a research alignment note without changing lock.
    Use this when:
    - The drift is exploratory and does not yet deserve a new experiment
    - The user wants momentum but future synthesis should know the run is less controlled
    - You will record the rationale in results.md, notes, or a decision file

(d) REVERT — Unstage or undo the offending changes. Use this when:
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
5. Tell user: "Continue from the new experiment folder. The fork records that the research target changed."

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

## Path (c): Continue With Note

Confirm: "Keep this drift as an alignment note for `<current-exp>`?"

If yes:

1. Ask for a one-sentence reason tied to the original research objective.
2. Append the note to `experiments/<exp-id>-*/results.md` or write a short `decisions/` note if the change affects interpretation.
3. Do not force a lock update. The point is to preserve momentum while making later synthesis aware of the caveat.
4. Tell user: "The experiment can continue. Treat downstream results as exploratory unless you later fork or update the lock."

## Path (d): Revert

Confirm: "Unstage or undo the offending changes?"

If yes:

1. Identify the drifted files from the meta:
   - Layer 1: the `experiments/<exp-id>-*/config.yaml`
   - Layer 2: the listed paths in `drift_layers.files`
2. For each, run `git reset HEAD <path>` to unstage. Optionally `git checkout -- <path>` to discard working changes (ask the user first—this is destructive).
3. Tell user: "Drift removed. Continue with the original experiment frame."

## Step: Continue

After whichever path was taken, summarize:

- Which research objective is now active
- Whether the current run is controlled or exploratory
- What file records the decision/note, if any
- The next concrete experiment action

## Special cases

- **Multi-layer drift** (config + files both): the user can fork once to absorb both, or override once with reason covering both. Don't make them resolve layer-by-layer.
- **Drift in a file that shouldn't have been an invariant** (the original lock was over-restrictive): use override path, update scope.lock to remove that file from `locked_invariants.files`, and write the decision explaining why the lock was overcautious.
- **Drift on a paper branch**: paper branches normally don't track exp state. Treat this as a configuration warning and route back to the active experiment if needed.

## Don't

- Don't turn the warning into the research agenda. Keep the decision tied to the original hypothesis and the next useful run.
- Don't make the choice for the user. Present the four options clearly and let them decide.
- Don't delete files in revert path without explicit confirmation.
- Don't proceed with override if `lablock override` reports "no SCOPE-DRIFT detected"—that means the staged content doesn't actually drift. Tell the user to re-stage their changes or check the meta.
