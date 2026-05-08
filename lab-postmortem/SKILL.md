---
name: lab-postmortem
description: |
  Write a 5-section experiment postmortem. Use for "postmortem", "experiment failed", "killed exp", or "what went wrong". Captures what happened, why, lessons, and revive conditions in experiments/<exp>/postmortem.md.
disable-model-invocation: false
related-skills:
  - lab-exp-finalize
---

# /lab-postmortem

You are writing a postmortem for an experiment that didn't succeed. The format is strict, the goal is institutional memory.

The user typically arrives here because:

- `/lab-exp-finalize` with `status=killed` or `status=superseded` triggered this skill.
- They want to document a failure they already finalized.

## Pre-flight

Required:

- `--exp=<exp-id>`: which experiment to write the postmortem for. Auto-detected from `.lablock/state/current-exp` if available.

Verify:

- `experiments/<exp>-*/` exists.
- `experiments/<exp>-*/postmortem.md` does NOT exist (or `--overwrite` was passed).
- The experiment's `status` is `killed`, `superseded`, or `done` (postmortems for `done` exps capture lessons learned even if successful).

Read `experiments/<exp>-*/hypothesis.md`, `.lablock/locks/<exp>.scope.lock`, `.lablock/changes/<exp>.changes.log`, and `experiments/<exp>-*/results.md` for context.

## Step 1: Render template, then fill

Run:

```bash
lablock postmortem --exp=<exp-id> --status=<final-status>
```

This renders `templates/postmortem.md.tmpl` to `experiments/<exp-id>-*/postmortem.md` with the 5-section skeleton. Then your job is to fill each section, walking the user through one at a time.

## Section 1: What we did

In one paragraph, restate the experiment:

- The hypothesis (verbatim from hypothesis.md)
- The independent variable
- The setup: dataset, baseline, evaluation
- Pointer to scope.lock for invariants

Don't editorialize. Just facts.

## Section 2: What happened

This is where most postmortems go wrong by being vague. Force specifics:

- **Numbers, not adjectives.** "Loss didn't decrease" → "Loss plateaued at 4.5 from step 1k onward; baseline reaches 2.8 by step 5k"
- **Reference logs/runs.** Cite specific commits in changes.log, specific run IDs, specific log paths.
- **Failure mode.** Was it numerical (NaN), behavioral (degenerate outputs), correctness (loss_contract failed), or evaluative (metric below baseline)?

Show, don't tell. Include a results snapshot if `results.md` had numbers.

## Section 3: Why we think it happened

At least **2** candidate explanations. If you only have one, you haven't thought hard enough.

For each candidate:

- What evidence supports it?
- What evidence is inconsistent?
- How confident? (high / medium / low)

The strongest candidate often involves an interaction: "It's not just X, it's X under Y conditions." Push for that level of specificity.

If the user says "we don't know", that's an honest answer—write it explicitly: "Cause unknown. Best candidate is X but evidence is weak."

## Section 4: What we learned

This is the **highest-value section** for future work. It must be a generalizable lesson, not just specific to this experiment.

Bad: "exp-007 didn't work because we used lr=3e-4."

Good: "Contrastive loss with λ=0.1 destabilizes training when paired with high lr. For lr ≥ 3e-4, λ should be ≤ 0.05, OR warmup should be added for the first 1k steps."

Each lesson should be:

- One or two sentences.
- Specific enough to be checked against future experiments.
- Generalizable beyond just this one run.

After writing, append the lesson to `.lablock/learnings.jsonl`:

```jsonl
{"date":"2026-05-08","exp":"exp-007","lesson":"Contrastive loss with λ≥0.1 destabilizes training under lr≥3e-4 without warmup","tags":["contrastive","lr","stability"]}
```

This makes the lesson visible to `/lab-exp-init` next time someone uses contrastive loss.

## Section 5: Conditions to revive

When (if ever) would this experiment be worth re-running?

Possibilities:

- "Once we have ≥ 2 GPUs more, scale up to confirm whether failure was instability or not enough capacity."
- "Once we have a working warmup schedule (see exp-008's postmortem), retry with λ=0.1."
- "Never. The hypothesis is fundamentally wrong; supersession to exp-008 captures the corrected version."

Be honest. "Never" is a valid answer.

## Step: Verify and commit

After all 5 sections are filled:

```bash
git add experiments/<exp-id>-*/postmortem.md .lablock/learnings.jsonl
git commit -m "postmortem for <exp-id>"
```

Hooks will add the LabLock scope/tag prefix and `LabLock-Change` trailer.

## Step: Final report

Print to user:

```
Postmortem written: experiments/<exp-id>-*/postmortem.md
Lesson added to learnings: .lablock/learnings.jsonl

Suggested next steps:
- If superseded: continue work on the descendant experiment
- If killed: run /lab-plan-exp to design a follow-up that addresses the cause
- If done with surprising results: run /lab-synthesize to incorporate into claims
```

## Special cases

- **Postmortem for a successful experiment**: still valuable—captures "what made this work" lessons. Skip Section 5 ("conditions to revive") or rename it "lessons for similar future experiments".
- **Postmortem before all results are in** (e.g., killed mid-run): Section 2 ("what happened") may be incomplete. That's OK; document what's known.
- **Postmortem for a long-running experiment** with multiple killed/restarted phases: structure as a timeline in Section 2.

## Don't

- Don't write a postmortem in fewer than 5 sections. Skipping sections defeats the format.
- Don't be vague in Section 2. Numbers, run IDs, commit hashes.
- Don't blame people in Section 3. Blame conditions.
- Don't skip Section 4 or write a non-generalizable lesson. The lesson is the deliverable.
- Don't skip the `learnings.jsonl` append. The format only matters if the future-self can grep it.
