---
name: lab-paper-audit
description: |
  Verify every claim in paper drafts is backed by evidence in claims.md. Triggers: "audit paper", "claim coverage", "before submission", "paper check", "verify claims", "check paper". Scans paper/drafts/, extracts every claim-like sentence (assertion of fact), matches each to claims.md and paper/claims-to-evidence.md, flags unsupported sentences with severity. Output: paper/audit-report-<date>.md. This is what you run before submission. The audit is the final gate.
disable-model-invocation: false
related-skills:
  - lab-paper-write
---

# /lab-paper-audit

You are auditing the paper drafts for claim coverage. Every sentence that asserts a fact about your method or results must trace back to evidence.

This is the final gate before submission. Do not soft-pedal findings.

## Pre-flight

Required:

- We must be on a `paper/<venue>` branch (refuse otherwise).
- `paper/drafts/` must contain at least one section file.
- `claims.md` and `paper/claims-to-evidence.md` must exist.

## Step 1: Inventory

List all files in `paper/drafts/`. For each, count word count. Print:

```
Sections found:
- intro.md (1234 words)
- method.md (2456 words)
- experiments.md (3789 words)
- ...

Total: <N> words across <M> sections.
```

## Step 2: Extract claim-like sentences

For each section, parse sentences. Identify sentences that assert facts—not all prose is a claim. Categories:

- **Strong claim**: definitive assertion. "Our method achieves X." "Y outperforms baseline by Z%."
- **Hedged claim**: "We hypothesize", "We expect", "Suggests", "Indicates". Allowed if the claim is a `hypothesis` strength in claims.md.
- **Reference claim**: cites prior work. "Doe et al. show X." Must match `lit/papers.md`.
- **Definitional / structural**: "In Section 3 we describe..." Not a factual claim, skip.

For ML/CV papers, claim-like patterns include:
- "X improves Y by N%"
- "X is more <metric> than Y"
- "X enables Y"
- "X causes Y"
- "We achieve state-of-the-art on Z"
- "Without component X, Y degrades by Z%"

Extract the list per section.

## Step 3: Match each claim to evidence

For each claim sentence:

1. Look for inline annotation `<!-- CN, exp-... -->` (left by `/lab-paper-write`).
2. If present, verify the cited claim exists in `claims.md` with sufficient strength.
3. If absent, search `paper/claims-to-evidence.md` for a matching claim by paraphrase.
4. If still no match, mark as **UNSUPPORTED**.

For matched claims, verify:

- The cited evidence exp-IDs exist in `experiments/`.
- Their `status: done`.
- The strength label matches the claim's assertion strength:
  - `empirical` claim → strong factual statement is OK
  - `hypothesis` claim → only hedged language ("we hypothesize", "may", "suggest") is allowed
  - `assumed` claim → must be explicitly attributed to prior work
  - `derived` claim → must reference the proof in `derivations/`

## Step 4: Severity-tag each issue

For each problem found:

- **CRITICAL**: strong claim with no supporting evidence in claims.md
- **HIGH**: claim cites an exp that doesn't exist or isn't done
- **MEDIUM**: hedged claim asserted as strong (e.g., "we show" used for hypothesis-strength claim)
- **MEDIUM**: claim cited from `claims.md` but not in `paper/claims-to-evidence.md` (mapping out of date)
- **LOW**: missing inline annotation but the claim does have evidence (cosmetic—`/lab-paper-write` would have added)

## Step 5: Cross-reference checks

In addition to per-claim checks, verify:

- **Formalism version consistency**: paper draft frontmatter says `formalism_version: v<X>`, but actual formalism is v<Y>. → MEDIUM.
- **Claim coverage**: every `[empirical]` claim in `claims.md` claimed_in_paper for this venue is actually used in the draft. If a claim is intended for the paper but not used → LOW (might be intentional, flag it).
- **Evidence freshness**: cited experiments not modified in last 6 months → LOW (just flag, sometimes correct).
- **Reference integrity**: every `\cite{X}` or `[Doe et al.]` resolves to `lit/papers.md` → MEDIUM if missing.

## Step 6: Write the audit report

Save to:

```
paper/audit-report-<date>.md
```

Format:

```markdown
---
type: audit
created: <date>
formalism_version: v<N>
sections_audited: [intro, method, ...]
---

# Paper Audit: <date>

## Summary

| Severity | Count |
|---|---|
| CRITICAL | <n> |
| HIGH | <n> |
| MEDIUM | <n> |
| LOW | <n> |

**Verdict**: READY-TO-SUBMIT | NEEDS-REVISION | NOT-READY

## Issues by section

### intro.md (3 issues)

#### CRITICAL — line 24
> "Our method achieves state-of-the-art on ImageNet."

No corresponding claim in claims.md. ImageNet results in `experiments/exp-005/` show 0.823 vs SOTA 0.857. **This claim is false as stated.**

Suggested fix: weaken to "our method matches recent strong baselines on ImageNet" or remove.

#### MEDIUM — line 56
> "We show that contrastive loss generalizes across domains."

Maps to claim C5 (hypothesis strength), but uses "we show" (factual). Should hedge: "we present evidence that..." or upgrade C5 to empirical with more experiments.

#### LOW — line 78
> "Component A contributes 60% of the gain."

Backed by C3 + exp-002, but inline annotation missing.

### method.md (1 issue)
...

## Cross-reference issues

- formalism_version in `paper/drafts/method.md` is v3, but `formalism.md` is v4. Bump or revise.
- Claim C7 (`[empirical]`) in `claims.md` is `claimed_in_paper: neurips-2026` but not used in any section. Intentional?

## Coverage

`claims.md` claims earmarked for this venue: <N>
Used in draft: <M>
Unused: <P> (listed above if any)
```

## Step 7: Verdict

The audit's verdict comes from a strict rule:

- **READY-TO-SUBMIT**: 0 CRITICAL, 0 HIGH, ≤ 3 MEDIUM. (LOW issues are advisory.)
- **NEEDS-REVISION**: 1+ HIGH or 4+ MEDIUM. Specific fixes required.
- **NOT-READY**: 1+ CRITICAL. Submitting would be embarrassing or false.

Do not soften this verdict. If there's a CRITICAL claim with no evidence, the paper is not ready, regardless of how polished the prose is.

## Step 8: Final report

Print to user:

```
Audit complete: paper/audit-report-<date>.md

<summary table>

Verdict: <READY | NEEDS-REVISION | NOT-READY>

<for NOT-READY or NEEDS-REVISION:>
Top 3 issues to fix:
1. <severity> in <section>: <one-line>
2. ...

<for READY:>
You can submit. Specific advisory items in audit report are LOW severity.
```

## Don't

- Don't soften the verdict. CRITICAL means CRITICAL.
- Don't assume hedged language ("could", "may") makes any claim acceptable. Even hedged claims need evidence.
- Don't fail an audit because of LOW issues. They're advisory.
- Don't overlook the formalism version check. Formalism drift between paper and code is a common silent bug.
- Don't skip the unused-claims check. Sometimes a claim was important and you forgot to put it in.
