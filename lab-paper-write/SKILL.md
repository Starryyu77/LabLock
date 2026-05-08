---
name: lab-paper-write
description: |
  Draft a paper section strictly from claims.md and paper/claims-to-evidence.md. Use for "write section", "draft paper", "write intro", or "method section". Refuses unsupported claims and writes paper/drafts/<section>.md.
disable-model-invocation: false
related-skills:
  - lab-paper-audit
  - lab-synthesize
---

# /lab-paper-write

You are drafting a paper section. Your hard constraint: every claim in the draft must trace back to a row in `paper/claims-to-evidence.md` with sufficient evidence (`empirical` or `derived`).

If the user wants to claim something not yet supported, you do not write it. You tell them what experiment would support the claim, and they decide whether to run it.

## Pre-flight

Required:

- `--section=<name>`: which section. Common: `intro`, `related-work`, `method`, `experiments`, `discussion`, `limitations`, `conclusion`.
- We must be on a `paper/<venue>` branch (run `/lab-paper-init` first if not). If not on one, refuse: "Paper writing should happen on a paper/<venue> branch. Run /lab-paper-init or git checkout paper/<venue>."

Read:

- `paper/outline.md` — the section structure
- `paper/claims-to-evidence.md` — the claim → exp mapping
- `claims.md` — full claim list
- `formalism.md` — current formalism (especially for `method` section)
- `experiments/*/results.md` — for `experiments` section
- existing `paper/drafts/<section>.md` if present (we may be revising)

## Step 1: Section-specific framing

Each section has different rules.

### intro

- Open with the problem (1 paragraph).
- State why existing approaches fall short (1 paragraph). Cite from `lit/`.
- State your contribution. Each contribution must map to a claim with `empirical` or `derived` strength. List 3-5.
- Roadmap (1 sentence): "Section 2 introduces..., Section 3 reports..."

### related-work

- Group prior work into 2-4 themes from `lit/positioning.md` if it exists.
- For each, 1-2 sentences naming key papers and what they did.
- End each theme with one sentence on how this work differs.
- Be honest. If a paper does most of what you do, acknowledge it.

### method

- State formalism explicitly. Use LaTeX. The equations come from `formalism.md` v<current>.
- Walk through the algorithm. Use the symbol table from `formalism.md`.
- If derivations exist, cite them: "See Appendix A or `derivations/proof-1.md`".
- Don't introduce notation that isn't in `formalism.md`.

### experiments

- Setup paragraph: datasets, baselines, evaluation, # of seeds, GPU specs (cite `infra/gpu/runs.md`).
- Main results paragraph: state what `claims-to-evidence.md` rows you're supporting. Reference table numbers.
- Ablations: each ablation must isolate exactly one factor.
- Analysis: only include analysis backed by experiments. "We hypothesize X" is OK if you also explicitly note "untested".

### discussion

- Discuss why your method works (only what's supported by ablations / analyses).
- Connect findings back to broader context.
- Don't speculate beyond the evidence.

### limitations

- Read `experiments/*/postmortem.md` and `learnings.jsonl`. Pull out generalizable limitations.
- Be specific. "Our method may not scale" is weak. "Our evaluation is on 3 datasets all from a single domain; cross-domain generalization is untested" is concrete.

### conclusion

- Restate contributions (echo intro).
- One sentence on future work.
- No new claims here.

## Step 2: Walk through the section, claim by claim

For each paragraph you propose to write:

1. Identify the claim being asserted.
2. Look up the claim in `paper/claims-to-evidence.md`.
3. Verify the evidence exists and is sufficient.

If a claim is not in the table → STOP. Tell the user:

> I want to write "<assertion>" but I don't see this claim in `paper/claims-to-evidence.md`. Options:
>   (a) The claim is supported but I missed it — point me to the row
>   (b) The claim is supported but not yet in the table — add it via `/lab-synthesize`
>   (c) The claim is not yet supported — what experiment would support it?
>   (d) Drop the claim from the section

Don't soldier on past unsupported claims. The whole point is the discipline.

## Step 3: Write the section

Once all claims are mapped, write the section. Conventions:

- Annotate each claim sentence with the supporting evidence inline as a comment (the user can keep or remove for the final draft):
  ```markdown
  Our method outperforms the baseline by 2.1% on ImageNet val.<!-- C1, exp-005, exp-007 -->
  ```
  This makes `/lab-paper-audit` easy to run later.
- Use LaTeX from `formalism.md` verbatim, don't re-derive.
- Cite from `lit/papers.md` rather than making up references.

## Step 4: Save the draft

Save to:

```
paper/drafts/<section>.md
```

Frontmatter:

```yaml
---
section: <name>
draft_version: <N>  # increment on revision
based_on:
  formalism_version: v<N>
  claims_snapshot: <claim-frozen-tag if available>
  evidence: [exp-...]
created: <date>
---
```

## Step 5: Commit and report

```bash
git add paper/drafts/<section>.md
git commit -m "[paper] draft <section>"
```

Print to user:

```
Section drafted: paper/drafts/<section>.md

Claims used:
- C1 (empirical, exp-005 + exp-007)
- C3 (empirical, exp-002)
- ...

Claims wanted but unavailable:
- (none) | <list>

Suggested next steps:
- Read and revise the draft
- Run /lab-paper-audit to verify all claim-evidence chains
- For each unavailable claim, decide: run more experiments, weaken the claim, or drop
```

## Step 6: If user wants to revise

Re-running `/lab-paper-write --section=<name>` doesn't blow away the existing draft. It's an iterative process:

- Read current draft
- Walk through what changed (new claims? new section structure?)
- Rewrite affected paragraphs
- Bump `draft_version` in frontmatter

## Special cases

- **First draft of a section with sparse claims**: the section will be short. That's accurate. Don't pad with speculation.
- **Method section before formalism is stable**: refuse: "Formalism is currently being modified (last bump <N> days ago). Stabilize first or accept that this draft will need rework."
- **Discussion section requesting unsupported speculation**: rewrite as "Future work" and move it.

## Don't

- Don't write a claim that isn't in `paper/claims-to-evidence.md`.
- Don't make up citations. If `lit/papers.md` doesn't have it, tell the user to add it first.
- Don't reproduce equations without citing `formalism.md` version. The version IS the source.
- Don't pad. Short sections grounded in evidence > long sections with speculation.
- Don't auto-promote `hypothesis` claims to factual statements in the prose. If the table says hypothesis, write "we hypothesize", not "we show".
