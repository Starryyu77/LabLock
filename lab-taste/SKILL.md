---
name: lab-taste
description: |
  Apply a research taste lens to a plan, experiment, result, or direction choice. Use for "科研品味", "is this worth studying", "what is the bigger story", "direction choice", anomaly interpretation, or taste check. Writes an advisory note under reviews/.
disable-model-invocation: false
related-skills:
  - lab-plan
  - lab-plan-exp
  - lab-review
  - lab-synthesize
---

# /lab-taste

You are helping the researcher think about research taste: whether a concrete plan or result points to an important problem, a common structure, and a stronger research story. This is a lens, not a gate. It does not approve, block, or rank experiments.

## Pre-flight

Inputs:

- `--target=<path>`: optional path to `plans/*.md`, `experiments/*/hypothesis.md`, `experiments/*/results.md`, or another research note.
- `--exp=<exp-id>`: optional experiment ID. If given, read the experiment folder and `.lablock/locks/<exp>.scope.lock`.
- `--topic=<short-name>`: optional filename slug. Infer from target, exp, or user prompt if omitted.

If no target or exp is given, use the user's latest idea/result as the target. Ask a short clarification only when there is not enough content to identify the research question.

Read, if present and relevant:

- `PROJECT.md` for the long-term research arc
- the target file
- `experiments/<exp>/hypothesis.md`
- `experiments/<exp>/results.md`
- `.lablock/locks/<exp>.scope.lock`
- `claims.md`
- `lit/papers.md` and `lit/positioning.md`

Do not search the web unless the user explicitly asks. `/lab-taste` is not a novelty verification or literature review; use `/lab-review --as=novelty` for that.

## Reference Lenses

Use these lenses explicitly, but keep the report practical:

1. **Hamming lens**: What are the important problems in this field, and is this a reasonable attack path? Taste includes courage: are we avoiding the important version because a safer version is easier?
2. **Graham lens**: Good work tends to solve the right problem, feel simple after the fact, suggest follow-up questions, have some inevitability, and apply beyond one special case.
3. **Bourdieu lens**: Taste is shaped by field status, cultural capital, and academic hierarchy. Check whether "theoretical", "hot", or "top-venue-looking" is being confused with scientific value; also check whether practical work is being dismissed too cheaply.
4. **Vibe-coding lens**: Operational work is cheaper now. The scarce resource is judgment: choosing the right question, interpreting anomalies, and turning a run into a claim.

## Step 1: Identify the Concrete Work

Write a compact summary:

- What exact question, experiment, or result is being evaluated?
- What is the current evidence, if any?
- What claim would the researcher like this to support?

If the target is vague, state the vague part instead of filling it in with false precision.

## Step 2: Taste Axes

Evaluate the target across these axes. Use `strong`, `unclear`, or `risk` labels, but do not produce a numeric score.

### Important Problem

- What larger problem does this touch?
- Why would the result matter outside this one repo, dataset, or benchmark?
- Why now?

### Common Structure

- What class of problems could this concrete case represent?
- Can the plan be reframed from "method A on task B gives result C" into "this reveals or addresses a shared failure mode"?
- What abstraction would make the work more general without becoming vague?

### Right Problem And Attack

- Is the proposed method attacking the central bottleneck or an easy nearby proxy?
- Is the design simpler than alternatives, or is complexity hiding a weak question?
- What is the narrowest experiment that would still teach the key thing?

### Story Potential

- If the result succeeds, what is the strongest honest headline?
- If it fails, what important thing could still be learned?
- What future question would this result naturally open?

### Anomaly Lens

For surprising results, separate:

- likely bug or measurement artifact
- expected but uninteresting variance
- possible phenomenon worth isolating

Suggest the minimum validation that distinguishes these without turning defensive debugging into the research agenda.

### Social Taste Check

- Is the direction being chosen because it is fashionable, prestigious, or easier to sell?
- Is a practical or engineering-looking problem being undervalued even though it may expose a real general structure?
- Whose standards of "important" are being adopted, and are they appropriate for this project?

### Courage Check

- What important version of the problem is being avoided?
- What risk is worth taking because it could change the research story?
- What risk is merely costly noise and should be avoided?

## Step 3: Reframe

Propose 1-3 reframes. Each should be one sentence:

```markdown
- Reframe: Instead of "<specific task result>", study "<common problem>" through "<specific experiment window>".
  Next action: <smallest experiment, reading, or synthesis step>.
```

At least one reframe should preserve the user's original practical goal. Do not force every project into a purely abstract or venue-driven framing.

## Step 4: Save The Note

Write to:

```text
reviews/<date>-<topic>-taste.md
```

Use frontmatter:

```yaml
---
type: taste
target: <path-or-user-prompt>
exp: <exp-id-or-null>
created: <date>
---
```

Recommended format:

```markdown
# Research Taste Note: <topic>

## One-sentence read
<the strongest current read>

## Concrete work
- Question/result:
- Current evidence:
- Desired claim:

## Taste axes
| Axis | Read | Why it matters |
|---|---|---|
| Important problem | strong/unclear/risk | ... |
| Common structure | strong/unclear/risk | ... |
| Right problem and attack | strong/unclear/risk | ... |
| Story potential | strong/unclear/risk | ... |
| Anomaly lens | strong/unclear/risk | ... |
| Social taste check | strong/unclear/risk | ... |
| Courage check | strong/unclear/risk | ... |

## Strongest story
<one paragraph>

## Better reframes
- ...

## Next action
<one concrete step>
```

## Step 5: Report Back

Tell the user where the note was saved and give the 2-3 highest-signal findings. If the best next step is a concrete experiment, point to `/lab-plan-exp`. If the best next step is evidence synthesis, point to `/lab-synthesize`. If the core issue is novelty or feasibility, point to `/lab-review`.

## Don't

- Don't make this a gate, verdict, or taste hierarchy.
- Don't output a score.
- Don't treat fashionable, abstract, or top-venue-shaped work as automatically better.
- Don't dismiss practical work as "just engineering" when it may reveal a general structure.
- Don't replace novelty review, feasibility review, or literature search.
- Don't turn anomaly interpretation into broad defensive validation; suggest the minimum check needed to decide whether the anomaly is a bug or a phenomenon.
