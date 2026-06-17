---
name: lab-debug
description: |
  Research-aligned debugging. Use for "debug", "why is X failing", "loss exploded", or "investigate". Keeps fixes tied to the active experiment goal: reproduce when needed, test a hypothesis, apply minimal target-aligned fixes, and write a debug log.
disable-model-invocation: false
related-skills:
  - lab-research-debug
  - lab-handoff
---

# /lab-debug

You are a research-aligned debugger. Your default is: keep the experiment moving toward its original goal, while gathering enough evidence that a fix is not random thrashing. Do not make debugging discipline more important than the research objective.

## Mode

You may be invoked while an experiment is in progress (current-exp set) or off-experiment. Adapt:

- If `current-exp` is set or the debug target is under `experiments/<exp>-...`: interpret changes against the active hypothesis and `scope.lock`. Touching a locked invariant is allowed when it is the most direct path to the research goal, but it should be classified via `/lab-guard` if it changes the experiment meaning.
- Off-experiment: more freedom, but still investigate first.

## Phase 1: Reproduce

Ask the user:

- **What's the symptom?** Specific. "Loss is wrong" → "loss is 12.4 but should be ~2.0". Numbers, not adjectives.
- **Minimum reproducer?** What's the smallest config / code path that exhibits the bug?
- **Was it ever working?** If yes, what changed? (`git log` from last known good)
- **Frequency**: deterministic, intermittent, only on specific data?

If the user can't answer these, gather the cheapest useful data first. For obvious one-line breakages, a small target-aligned fix is acceptable after stating the hypothesis.

## Phase 2: Trace data flow

Walk forward from the input, or backward from the symptom. Pick one direction and stick with it.

For ML training bugs:

- Check shapes at each module boundary
- Check value ranges (NaN, Inf, exploding/vanishing)
- Check that the optimizer is actually updating the parameters you think it is
- Check that the loss reaches `loss.backward()` and gradients flow

For data bugs:

- Check the loader's first batch by hand
- Check sampling distribution if relevant
- Check label encoding

For evaluation bugs:

- Compare to a known-good reference run (different seed, baseline, etc.)
- Check that train/val/test splits are what you think

Avoid speculative fixes during Phase 2. If the cause is already isolated, move to a minimal fix rather than adding process.

## Phase 3: Hypotheses

Form at least **2** hypotheses for what's wrong. If you only have one, you're not thinking hard enough—at least add "I'm wrong about X being correct" as a second hypothesis.

For each hypothesis:

- What evidence supports it?
- What evidence is inconsistent with it?
- What's the simplest test that would distinguish?

## Phase 4: Test ONE hypothesis

Pick the hypothesis with the cheapest distinguishing test. Run that test. Either:

- **Confirmed**: hypothesis is the cause. Now (and only now) propose a fix.
- **Refuted**: rule out, return to Phase 3 with remaining hypotheses.
- **Inconclusive**: design a better test.

Do not make large fixes because you're "pretty sure". The point is to get enough evidence for the smallest useful change.

## Phase 5: Apply fix (constrained)

Once a hypothesis is confirmed:

1. **Check scope.lock impact.** If the fix touches a locked file or changes a locked config:
   - Explain whether the change still serves the original hypothesis or changes the experiment meaning.
   - If it changes the experiment meaning, route to `/lab-guard` for fork, override, continue-with-note, or revert.
2. **Otherwise**, propose the minimal change. Show diff before applying.
3. **One fix, one commit.** Don't bundle.
4. **Verify the fix.** Re-run the reproducer. If symptom persists, the hypothesis was wrong (back to Phase 3) or the fix was incomplete.

## Phase 6: Three-strike rule

If three fix attempts (Phases 4-5 cycles) haven't resolved the bug, recenter before more code changes.

This is a sign your investigation was incomplete. Step back:

- Re-read your debug log.
- What assumption did you not question?
- Use `/lab-research-debug` if the symptom may already be discussed in papers, library issues, reproduction repos, or open-source communities.
- Consider `/lab-handoff --type=debug` to bring in a fresh AI perspective.

Do not try a fourth fix without either narrowing the reproducer or explicitly changing the research plan.

## Step: Write the debug log

Throughout, maintain:

```
debug/<date>-<short-topic>.md
```

Structure:

```markdown
---
type: debug
exp_id: <if applicable>
created: <date>
status: investigating | resolved | escalated
---

# Debug: <symptom>

## Reproducer
<minimum repro>

## Observations
- <observation 1>
- <observation 2>
...

## Hypotheses
- **H1**: <statement>
  - Evidence for: ...
  - Evidence against: ...
- **H2**: ...

## Tests
### Test 1
- Hypothesis: H1
- Method: ...
- Result: confirmed / refuted / inconclusive

## Fix (if any)
- Change: ...
- Commit: <hash>
- Verified: yes/no

## Outcome
<resolved | open | escalated to handoff>
```

The log is a record of *what you investigated*, not just *what fixed it*. This is how the user (and future you) avoids repeating debugging cycles.

## Step: Add to learnings

If a non-trivial bug was resolved, append a one-line entry to `.lablock/learnings.jsonl`:

```jsonl
{"date":"2026-05-08","topic":"debug","lesson":"On 4-GPU NCCL, batch_size>=512 causes deadlock with persistent_workers=True","tags":["nccl","dataloader"]}
```

This shows up in `/lab-exp-init` recommendations later, helping users avoid past mistakes.

## Don't

- Don't let debugging process become the research agenda.
- Don't bundle multiple fixes. One hypothesis, one fix, one commit.
- Don't continue past 3 failed fixes without narrowing the reproducer or recentering on the research goal.
- Don't silently change a locked invariant. Classify the impact with `/lab-guard`.
- Don't skip writing the debug log. The log IS the value—the fix is incidental.
