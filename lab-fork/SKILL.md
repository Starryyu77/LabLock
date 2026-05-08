---
name: lab-fork
description: |
  Fork an experiment because of scope drift or intentional branching. Use for "fork experiment" or "branch from current exp". Allocates a new sequential exp ID, records fork metadata, updates scope.lock, and may mark the parent superseded. User-invoked only.
disable-model-invocation: true
related-skills:
  - lab-guard
  - lab-exp-init
---

# /lab-fork

You are forking an experiment. Two main use cases:

1. **Drift fork** (most common): scope drift was detected, user wants to capture the drifted state as a new baseline.
2. **Parallel fork**: user wants to test a variant of an active experiment without abandoning the original. (Use `--no-supersede` for this.)

## Pre-flight

1. **Validate parent.** `--from=<exp-NNN>`. The parent must:
   - Exist (`experiments/<from>-*/hypothesis.md` is present)
   - Be `active` in scope.lock (refuse to fork an already-superseded experiment)
2. **Decide source mode.** `--source=staged` (default for drift forks, captures what's currently staged) or `--source=working` (captures working tree state). Ask if unclear.
3. **Decide supersede behavior.** Default: yes (the original is marked superseded). Override with `--no-supersede` for parallel forks.

## Step 1: Capture context

Read:

- `experiments/<from>-*/hypothesis.md` — original hypothesis, controlled changes, criteria
- `.lablock/locks/<from>.scope.lock` — original invariants
- For drift forks: read the drift from `.git/lablock-commit-meta.json` (if from `/lab-guard`) or run `lablock-verify-scope --exp=<from> --source=<src>` to get the diff fresh

## Step 2: Compose the new experiment

Walk the user through:

- **Shortname**: default to `<original-shortname>-fork` but suggest something more descriptive. E.g., if drift was lr changing, propose `<original>-low-lr`.
- **Hypothesis**: default behavior is "test the same hypothesis under the post-drift baseline". For parallel forks, ask the user for a refined hypothesis.
- **Reason**: required for drift forks. Used in the decision file.

## Step 3: Run the CLI

```bash
lablock fork \
  --from=<exp-NNN> \
  --shortname=<short-name> \
  --reason="<one-line reason>" \
  --source=<staged|working> \
  --stage
```

By default, `--supersede` is on (the parent is marked superseded). Add `--no-supersede` for parallel forks.

This single command:

- Allocates next exp-NNN (sequential, never reuses, never letter-suffixes)
- Creates `experiments/<new-id>-<shortname>/` with hypothesis.md
- The new hypothesis.md frontmatter has `forked_from: <from>` and `fork_reason: scope-drift|parallel-exploration|manual` and `drift_commit: <short-sha>`
- Copies scope.lock from parent, then **overlays the drifted values as new invariants** (so the new exp is locked to the new state, not the old)
- Re-hashes file invariants from current state (so `files` layer reflects current SHAs)
- For drift forks: sets parent's lock and frontmatter status to `superseded`
- Writes `decisions/<date>-fork-<from>-to-<new-id>-<change-id>.md` if `--reason` was given
- Stages all changes

## Step 4: Verify and report

After the fork:

```
Forked: <from> -> <new-id>

What changed:
  Old invariants: <list>
  New invariants: <list with drifted values>

Status:
  <from>: superseded  (or: still active, if --no-supersede)
  <new-id>: active

Decision recorded: decisions/<filename>.md

Files staged for commit:
  experiments/<new-id>-*/
  .lablock/locks/<new-id>.scope.lock
  .lablock/locks/<from>.scope.lock  (status update, if superseded)
  experiments/<from>-*/hypothesis.md  (status update, if superseded)
  decisions/<filename>.md
```

## Step 5: Commit

Tell the user:

```bash
git commit -m "fork <from> -> <new-id>: <one-line reason>"
```

The hooks will:

- Auto-prefix `[<from>][SCOPE-DRIFT]` (because the staged content includes the parent's drift)
- Add `LabLock-Change` trailer
- Recognize the staged decision file as accountability artifact (no further `/lab-guard` needed)

## Step 6: Switch focus to new exp

If the user wants to continue work on the new fork (typical after drift fork):

```bash
echo "<new-id>" > .lablock/state/current-exp
```

This is gitignored; doesn't need committing. Future commits will be tracked to `<new-id>`.

If parallel fork: leave `current-exp` as `<from>` and tell the user they can switch later via `/lab-exp-start --exp=<new-id>` (which creates a new branch).

## Step 7: Branch decision

For drift forks, the **same git branch** continues, just now scoped to the new exp. No new branch needed.

For parallel forks, the user typically wants a new branch:

```bash
git checkout -b "exp/<new-id>-<shortname>"
```

Suggest this only for parallel forks.

## Failure modes

- **Parent superseded** → refuse: "Cannot fork from a superseded experiment. Pick the active descendant."
- **Source `staged` but nothing staged** → refuse: "No staged changes. Run with `--source=working` if forking the working tree state."
- **No drift detected and `--source=staged`** → warn: "No drift between staged and parent's lock. The fork will be a literal copy. Continue?"

## Don't

- Don't use letter suffixes (`exp-007a`). Always sequential numbers.
- Don't fork without a reason for drift forks. The decision file is the accountability artifact.
- Don't both fork AND override the same drift. Pick one.
- Don't forget to update `.lablock/state/current-exp` if user wants to continue on the fork (ask them).
