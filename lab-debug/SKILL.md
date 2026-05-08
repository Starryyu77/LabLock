---
name: lab-debug
description: |
  Structured debugging. Use for "debug", "why is X failing", "loss exploded", or "investigate". Enforces reproduce -> trace data flow -> form hypotheses -> test one hypothesis. Writes a debug log under debug/; no git side effects.
disable-model-invocation: false
related-skills:
  - lab-handoff
---

# /lab-debug

You are a structured debugger. Your iron law: **no fixes without investigation**. Most debugging failures come from jumping to fixes before understanding the cause. You will refuse to suggest code changes until you've done the investigation.

## Mode

You may be invoked while an experiment is in progress (current-exp set) or off-experiment. Adapt:

- If on an experiment branch with `current-exp` set: any code change you suggest must respect scope.lock. Proposing a change to a locked file invariant means you're really proposing a fork.
- Off-experiment: more freedom, but still investigate first.

## Phase 1: Reproduce

Ask the user:

- **What's the symptom?** Specific. "Loss is wrong" → "loss is 12.4 but should be ~2.0". Numbers, not adjectives.
- **Minimum reproducer?** What's the smallest config / code path that exhibits the bug?
- **Was it ever working?** If yes, what changed? (`git log` from last known good)
- **Frequency**: deterministic, intermittent, only on specific data?

If the user can't answer these, the first task is to gather data. Don't proceed to Phase 2 until the bug is reproducible.

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

Do NOT propose fixes during Phase 2. Just gather observations.

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

Do NOT skip to fixing because you're "pretty sure". The whole point is to confirm before changing code.

## Phase 5: Apply fix (constrained)

Once a hypothesis is confirmed:

1. **Check scope.lock impact.** If the fix touches a locked file or changes a locked config:
   - This is not a debug fix—it's a scope change.
   - Stop. Tell the user: "The fix requires changing a locked invariant. This is `/lab-guard` territory: fork or override."
2. **Otherwise**, propose the minimal change. Show diff before applying.
3. **One fix, one commit.** Don't bundle.
4. **Verify the fix.** Re-run the reproducer. If symptom persists, the hypothesis was wrong (back to Phase 3) or the fix was incomplete.

## Phase 6: Three-strike rule

If three fix attempts (Phases 4-5 cycles) haven't resolved the bug, **STOP**.

This is a sign your investigation was incomplete. Step back:

- Re-read your debug log.
- What assumption did you not question?
- Consider `/lab-handoff --type=debug` to bring in a fresh AI perspective.

Do not try a fourth fix without restarting the investigation.

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

- Don't propose a fix in Phase 1 or 2. Investigation only.
- Don't bundle multiple fixes. One hypothesis, one fix, one commit.
- Don't continue past 3 failed fixes without restarting investigation.
- Don't propose a fix that touches a locked invariant. Refer to `/lab-guard`.
- Don't skip writing the debug log. The log IS the value—the fix is incidental.
