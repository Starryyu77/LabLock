---
name: lab-formalism-update
description: |
  Bump the formalism version with echo-back protocol and cross-file stale check. Triggers: "update formalism", "change loss definition", "bump formalism", "formalism v<N>", "new equation", "redefine attention", "update math". Strict workflow: (1) AI echoes current formalism in LaTeX, user confirms; (2) user describes change; (3) AI proposes diff; (4) bump version with changelog; (5) scan all files for stale references to old version; (6) generate decisions/<date>-formalism-bump-vN.md. Echo-back is non-negotiable—drift between AI's understanding and user's mental model is the #1 cause of subtle bugs in math-heavy code. Side effects: edits formalism.md, generates decision file. User must invoke explicitly.
disable-model-invocation: true
related-skills:
  - lab-synthesize
---

# /lab-formalism-update

You are bumping the formalism version. This is a high-stakes operation because formalism is the contract between code, paper, and AI's understanding. Drift here corrupts everything downstream.

The echo-back protocol is **mandatory**. Skipping it has caused more bugs than any other shortcut.

## Pre-flight

1. **Read `formalism.md` fully**, including version history.
2. **Identify current version**: parse from frontmatter `version: vN`.
3. **Check for in-flight experiments**: any `scope.lock` with `formalism_version: v<current>` references this version. After bump, those experiments are *not* automatically migrated—they're frozen at the version they were created under.

## Step 1: Echo-back current state

Before doing anything else, restate the current formalism in LaTeX. The user must confirm or correct.

Do not paraphrase. Do not summarize. Reproduce the relevant equations and definitions exactly:

```
Current formalism is v<N>, last updated <date>.

Key definitions:
$$ L_{total} = L_{task} + \lambda L_{con} $$

where:
- $L_{task}$ is cross-entropy loss
- $L_{con}$ is the contrastive term defined as ...
- $\lambda = 0.1$ (default; an experiment may lock a different value)

Symbol table:
| Symbol | Meaning |
|---|---|
| $L_{total}$ | total loss |
| ... | ... |

Is this what you have in mind? If anything is wrong, stop me here.
```

**If the user disagrees**, do NOT proceed. Resolve the discrepancy first by re-reading `formalism.md` together. The whole point of echo-back is catching drift before the bump compounds it.

## Step 2: Capture intended change

Once echo-back is confirmed, ask:

- **What's changing?** One sentence. ("Replace cross-entropy with focal loss." "Add a stop-gradient to the projection.")
- **Why?** One sentence. (Does this fix a bug? Match a paper's definition? Extend the formalism?)
- **Backward-compatible?** Will old experiments still be valid under the new definition, or are they semantically obsolete? (Most bumps are NOT backward-compatible.)

## Step 3: Propose the diff

Show the user, in LaTeX, the before-and-after:

```
Before (v<N>):
$$ L_{task} = -\sum_i y_i \log p_i $$

After (v<N+1>):
$$ L_{task} = -\sum_i (1-p_i)^\gamma y_i \log p_i \quad \text{(focal, } \gamma=2 \text{)} $$
```

User confirms or revises. Iterate until confirmed.

## Step 4: Bump version

Update `formalism.md`:

- Bump version in frontmatter: `version: v<N+1>`, `last_updated: <date>`.
- Add a new entry to the "Version history" section:
  ```markdown
  ## v<N+1> (<date>)
  - **<short title of change>**
  - Reason: <one sentence>
  - Compatibility: <backward-compatible | not backward-compatible — old experiments remain valid as v<N> snapshots>
  - Replaced section: <which equation block>
  ```
- Update the equation in place. Keep the symbol table consistent.

## Step 5: Stale reference scan

Search the project for references to the old version:

```bash
grep -rn "v<N>" \
  --include="*.md" --include="*.py" --include="*.ts" --include="*.tex" \
  --exclude-dir=node_modules --exclude-dir=.git \
  | grep -v "experiments/"   # exp dirs are frozen at their version, that's correct
```

Also check:

- `claims.md` frontmatter `formalism_version`. If it says `v<N>`, ask: should it bump to `v<N+1>`? (Yes if claims still hold under new definition; no if they need re-evaluation.)
- Code comments referencing the old equation
- LaTeX in `paper/` if exists
- `derivations/*.md` — if any proof depends on v<N>'s form, mark it for review

Compile a "stale references" list. **Do not auto-fix**. List with locations:

```markdown
## Stale references to v<N>

- `claims.md:1` — formalism_version, may need bump after re-validation
- `src/losses/total.py:12` — comment mentions v<N>
- `derivations/proof-1.md:23` — derivation uses old L_task
- `paper/drafts/method.md:45` — equation uses old form
```

The user reviews each and decides. Some references are correct (e.g., a postmortem saying "exp-007 was run under v<N>"); others need updating.

## Step 6: Write the decision file

Render `templates/decision.md.tmpl` to:

```
decisions/<date>-formalism-bump-v<N+1>.md
```

Content:

```yaml
---
type: formalism-bump
created: <date>
exp_id: null
change_id: <generate>
---

# Decision: Bump formalism v<N> → v<N+1>

## Context
<what was wrong with v<N>, or what motivated the change>

## Decision
Bumped formalism from v<N> to v<N+1>. Specifically: <one sentence summary>.

## Diff
Before: <latex>
After: <latex>

## Compatibility
<backward-compatible | not backward-compatible>

## Stale references identified
- ... (from Step 5)

## Migration plan
- <which references will be updated, by whom, when>
- <experiments that remain at v<N> for archival reasons>
```

Stage:

```bash
git add formalism.md decisions/<date>-formalism-bump-v<N+1>.md
```

## Step 7: Commit and tag

```bash
git commit -m "[formalism] bump to v<N+1>: <one-line summary>"
```

The hooks will recognize `[formalism]` scope. After commit:

```bash
git tag formalism-v<N+1>
git push origin formalism-v<N+1>  # if remote exists
```

Tag is for audit trail and for `/lab-paper-init` to anchor paper branches.

## Step 8: Final report

Print:

```
Formalism bumped: v<N> → v<N+1>
Decision: decisions/<filename>.md
Tag: formalism-v<N+1>

<count> stale references identified.

Suggested next steps:
- Review stale references and update what needs updating
- If active experiments need re-validation: run /lab-synthesize to assess impact
- If claims need re-evaluation: review claims.md formalism_version field
```

## Failure modes

- **User says "it's fine, just bump it"** when echo-back doesn't match → refuse. Tell them: "I'm refusing to proceed because my understanding of the current formalism doesn't match yours. Please clarify which version is correct before bumping."
- **Stale scan returns hundreds of hits** → group by file/directory and ask user to triage rather than dumping the full list.
- **User wants to bump without updating any equations** → ask why. If just metadata change, that's not a real bump—it's an edit. Discourage version churn.

## Don't

- Don't skip echo-back. It is the single most important step.
- Don't bump version more than once per significant change. Multiple small fixes in one session = one bump with multiple bullets in version history.
- Don't auto-fix stale references. The user reviews and decides per-reference.
- Don't migrate completed experiments (`status: done`, `killed`, `superseded`) to the new version. They remain frozen at the version they ran under.
- Don't bump silently. The decision file and tag are the audit trail.
