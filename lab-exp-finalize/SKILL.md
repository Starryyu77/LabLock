---
name: lab-exp-finalize
description: |
  Close out an experiment. Triggers: "finalize experiment", "experiment done", "wrap up exp", "kill exp", "exp finished", "mark superseded". Asks for outcome status (done / killed / superseded), tags `<exp-id>-final`, updates frontmatter status, clears `.lablock/state/current-exp`. For success: suggests `/lab-cleanup-pr` to merge worthwhile changes back to main. For failure or supersession: mandates `/lab-postmortem`. This skill writes files, may tag, modifies state; user must invoke explicitly.
disable-model-invocation: true
related-skills:
  - lab-cleanup-pr
  - lab-postmortem
---

# /lab-exp-finalize

You are closing out an experiment. The experiment's outcome is known; now LabLock needs to record it formally and route the user to the next step.

## Pre-flight

Required:

- `--exp=<exp-id>`: which experiment to finalize. Must exist with `status: active` or `status: running` in scope.lock.
- `--status=<outcome>`: `done | killed | superseded`. Ask the user which if not specified.

Verify:

- Experiment folder and `.lablock/locks/<exp-id>.scope.lock` exist. Folder-isolated experiments do not require a matching Git branch.
- If the user is on an `exp/<exp-id>-*` branch, tags will naturally point at that branch's HEAD. If not, warn that the final tag points at the current HEAD and ask for confirmation before tagging.
- Working tree clean (no uncommitted changes that should be in the final tag).

## Step 0: Confirm status meaning

Ask the user, briefly:

- **`done`**: the experiment ran to completion AND the result is interpretable (success or clean negative). The hypothesis was tested.
- **`killed`**: the experiment was aborted before producing an interpretable result. Often due to numerical issues, infrastructure failure, or the user noticed the design was wrong mid-run.
- **`superseded`**: the experiment was replaced by a fork or a redesigned exp. Its results are no longer the canonical answer.

If unclear, prompt: "Did you reach a conclusion (`done`), abort (`killed`), or replace with a successor (`superseded`)?"

## Step 1: Run the CLI

```bash
lablock exp-finalize \
  --exp=<exp-id> \
  --status=<status> \
  --tag
```

This:

- Updates `experiments/<exp-id>-*/hypothesis.md` frontmatter:
  - `status: <done|killed|superseded>`
  - `finalized_at: <ISO-date>`
- Updates `.lablock/locks/<exp-id>.scope.lock`:
  - `status: finalized` if `--status=done`
  - `status: superseded` otherwise
- Clears `.lablock/state/current-exp` (unless `--no-clear-current`)
- Creates git tag `<exp-id>-final` at HEAD

The CLI doesn't push. We'll do that explicitly.

## Step 2: Commit the status updates

```bash
git add experiments/<exp-id>-*/hypothesis.md .lablock/locks/<exp-id>.scope.lock
git commit -m "finalize <exp-id> status=<status>"
```

Hooks will add the LabLock scope/tag prefix and `LabLock-Change` trailer.

## Step 3: Push tag

```bash
git push origin <exp-id>-final
```

If an experiment branch exists and the user wants remote archival history, also push it explicitly:

```bash
git push origin exp/<exp-id>-<shortname>
```

The tag is the permanent reference for this experiment's frozen state. Branches are optional in folder-isolated workflows.

## Step 4: Branch by outcome

### Outcome: `done`

Print:

```
Experiment <exp-id> finalized as DONE.
Tag: <exp-id>-final

Next step: review what should make it back to main.

Suggested:
  /lab-cleanup-pr --exp=<exp-id>

This generates a focused PR that includes only:
- Updates to formalism.md (if any)
- Updates to claims.md (new claims supported by this exp)
- Updates to decisions/
- Reusable utility code (you'll review per-file)

Excluded from the cleanup PR:
- experiment scripts and configs (live in the experiment folder and final tag)
- debug noise

After review, run /lab-synthesize to incorporate this experiment's results into claims.
```

Tell user not to delete the experiment folder or final tag. A branch is optional and only needed when they used branch isolation.

### Outcome: `killed`

Print:

```
Experiment <exp-id> finalized as KILLED.
Tag: <exp-id>-final

Next step: write the postmortem (mandatory).

Run:
  /lab-postmortem --exp=<exp-id>

After postmortem, decide:
- Cherry-pick the postmortem.md and any learnings to main (recommended)
- Leave the rest of the branch as-is for archival
```

After the postmortem is written, suggest:

```bash
git checkout main
git cherry-pick <commit-of-postmortem>   # bring just the postmortem to main
```

### Outcome: `superseded`

Print:

```
Experiment <exp-id> finalized as SUPERSEDED.
Tag: <exp-id>-final

The successor experiment should already exist (created via /lab-fork or /lab-exp-init).

Next step: still write a brief postmortem capturing why we superseded.

Run:
  /lab-postmortem --exp=<exp-id>

Section 5 ("conditions to revive") should explain whether the original is permanently retired or could be revisited.
```

## Step 5: Final report

Print clean summary:

```
Finalized: <exp-id>
Status: <status>
Tag: <exp-id>-final
Branch: <exp branch if one was used; otherwise folder-isolated>
current-exp cleared.

Next:
  <one of the three branches above>
```

## Special cases

- **Multiple commits since last activity**: that's fine; the tag points at HEAD which captures all of them.
- **Branch-isolated experiment ahead of origin**: push before tagging so the tag is reachable from remote.
- **`--no-clear-current`**: rare, but useful if user wants to do post-finalize commits (e.g., adding the postmortem) on the same branch before switching context. Default behavior is to clear.
- **User wants to delete a branch-isolated experiment branch**: discourage until the final tag is pushed and archival policy has run.

## Don't

- Don't proceed if status is unclear. The three statuses have different downstream consequences.
- Don't skip the tag. It's the permanent reference.
- Don't auto-cherry-pick anything to main here. That's `/lab-cleanup-pr`'s job for `done` exps.
- Don't delete experiment folders or branch-isolated experiment branches as part of finalization.
- Don't allow finalization while the working tree is dirty—the tag would be ambiguous.
