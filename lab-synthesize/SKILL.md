---
name: lab-synthesize
description: |
  Cross-experiment synthesis: find patterns, propose new claims, identify gaps. Triggers: "synthesize", "what do these experiments tell us", "summary across experiments", "promote claims", "synthesize results", "what's the story". Reads multiple experiments' results.md and frontmatter, compares against current claims.md, proposes new candidate claims with strength labels and evidence pointers, identifies which claims need more experiments to strengthen. Output: synthesis report in reviews/ + a proposed update to claims.md (the user must apply via `/lab-paper-write` or manual edit). This skill writes a markdown report and may suggest claims.md changes; no git side effects.
disable-model-invocation: false
related-skills:
  - lab-formalism-update
  - lab-paper-write
---

# /lab-synthesize

You are doing synthesis: looking at the body of experiments and asking "what story do they tell?". This is the bridge from "we ran a bunch of experiments" to "here are our claims".

The output is a report and a proposed claims.md delta. **You do not edit claims.md directly**—the user reviews and applies.

## Pre-flight

Optional inputs:

- `--exp=<csv>`: list of exp-IDs to synthesize. Default: all experiments with `status=done` in the last 30 days.
- `--theme=<topic>`: focus the synthesis on a specific topic (e.g., "long-context", "ablation"). Default: all done experiments.
- `--since=<date>`: lower bound on completion date.

Read:

- `experiments/<each>/hypothesis.md` (frontmatter for status, parent, hypothesis)
- `experiments/<each>/results.md` (free-form, but parse for tables and metric numbers)
- `experiments/<each>/postmortem.md` if exists (failed/killed exps still inform)
- `.lablock/locks/<each>.scope.lock` (for invariants and IV)
- Current `claims.md`
- `formalism.md` for current formalism version

## Step 1: Tabulate

Build a table: experiment × metric. Columns are key metrics (the most-cited primary metric across exps), rows are exps.

```markdown
| Exp | Status | Hypothesis | Metric A | Metric B | Notes |
|---|---|---|---|---|---|
| exp-001 | done | baseline | 0.808 | - | reference |
| exp-002 | done | +component A | 0.829 | - | +2.1% |
| exp-003 | done | +component B | 0.804 | - | -0.4% |
| exp-007 | done | A+B+lr fix | 0.823 | - | +1.5% |
| exp-009 | killed | OOD eval | - | 0.451 | killed: see postmortem |
```

## Step 2: Find patterns

Look across the table for:

1. **Consistent effects**: components that help across multiple variants
2. **Inconsistent effects**: components that help in some configs but not others (interesting—needs explanation)
3. **Non-effects**: things that didn't matter
4. **Anti-effects**: things that hurt

Don't over-claim. "Component A helps in 3/3 setups" is meaningful; "Component A helps" is not (without bounds).

## Step 3: Propose candidate claims

For each pattern with sufficient evidence, propose a claim with strength:

- **`empirical`**: ≥ 2 done experiments support, no contradicting evidence. Cite specific exp-IDs.
- **`hypothesis`**: 1 supporting experiment, plausible but not strong. Needs more evidence.
- **`derived`**: follows from a proof in `derivations/`, not just empirics.
- **`assumed`**: taken from prior work without verification.

Propose each claim as:

```markdown
## C<N>: <statement>
- **strength**: <empirical | hypothesis | derived | assumed>
- **evidence**: [<exp-ids> | <proof-ids>]
- **confidence**: <low | medium | high>
- **rationale**: <one sentence why this strength label>
- **gap**: <what would strengthen this claim, or "(none)">
```

If the proposed claim is inconsistent with existing claims.md, flag it: "C5 in claims.md says X, but exp-009 contradicts. Resolution required."

## Step 4: Identify gaps

For each existing claim in claims.md (especially `[empirical]`):

- Is the evidence still sufficient given new exps?
- Are there gaps that new experiments could fill?

For each candidate claim from Step 3:

- What experiment would promote `hypothesis` → `empirical`?
- What ablation would isolate the effect?

Express gaps as concrete experiment proposals:

```markdown
## Gaps to address
- **C3** (component A primary contribution): needs single-component ablation isolating A from B. Suggest exp-010: A only.
- **Candidate C7** (OOD generalization): only one OOD dataset. Need ≥ 2 more.
```

These gaps are actionable—the user can convert them into `/lab-plan-exp` sessions.

## Step 5: Identify failed-but-informative experiments

Read `postmortem.md` files. Failed experiments often reveal that a hypothesis is wrong, which is itself a claim:

```markdown
## What we ruled out
- exp-004 attempted loss v2; killed for NaN. We learned that L_total without warmup is unstable. (Captured as `[empirical]` claim in `learnings.jsonl`.)
```

This is valuable for the paper's "limitations" or "discussion" section.

## Step 6: Story arc check

Step back. Imagine writing the abstract today. Does the body of work tell a coherent story?

- **Best case**: 3-5 strong empirical claims + 1-2 negative results + 1 derived claim. Coherent narrative.
- **Yellow**: Lots of running, 1-2 weak claims, no clear narrative. Need more focused experiments.
- **Red**: Nothing replicates, or contradictions everywhere. The hypothesis may be wrong.

Be honest. Don't bend findings to fit a desired narrative.

## Step 7: Write the report

Save to:

```
reviews/<date>-synthesis.md
```

Format:

```markdown
---
type: synthesis
created: <date>
exps_synthesized: [exp-001, exp-002, ..., exp-009]
formalism_version: v<N>
---

# Synthesis: <theme or "All recent">

## Tabulation
<table>

## Patterns
- ...

## Candidate claims
### C<N>: <statement>
- strength: ...
- evidence: ...
- ...

## Gaps
- ...

## What we ruled out
- ...

## Story arc
<GREEN | YELLOW | RED with brief justification>

## Suggested claims.md delta
\`\`\`diff
+ ## C7: ...
+ - strength: empirical
+ - evidence: [exp-002, exp-007]
+ ...

  ## C3: <existing>
- - strength: hypothesis
+ - strength: empirical
+ - evidence: [exp-002, exp-007]
\`\`\`

## Recommended next experiments
- exp-XXX: <what, to address which gap>
```

## Step 8: Suggest follow-up

Print:

```
Synthesis complete. <N> candidate claims proposed, <M> gaps identified.

Suggested next steps:
1. Review reviews/<date>-synthesis.md
2. Apply the claims.md delta if you agree (or use /lab-paper-write to draft sections)
3. For each gap, run /lab-plan-exp to design the next experiment

Story arc verdict: <GREEN | YELLOW | RED>
```

## Don't

- Don't auto-edit claims.md. Propose, don't impose.
- Don't promote a claim to `[empirical]` based on 1 experiment. Two minimum.
- Don't ignore failed experiments. Postmortems contain rule-outs that are claims too.
- Don't bend findings to fit a desired story arc. If story is RED, say RED.
- Don't make up patterns. If 3 experiments don't show a pattern, the answer is "no signal", not "weak signal".
