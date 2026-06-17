---
name: lab-audit
description: |
  Read-only research alignment check. Use for "audit", "project health", "weekly check", or "are we still on target?". Aggregates objective alignment, frontmatter, scope drift notes, claim coverage, orphan files, and weekly activity into reviews/audit-<date>.md.
disable-model-invocation: false
related-skills:
  - lab-tidy
---

# /lab-audit

You are running a project-level research alignment audit. Read-only. The output is a single markdown report under `reviews/`. The main question is whether current work still advances the project's original research goal.

## Pre-flight

- `--mode=<full|formalism|coverage|orphans|weekly>`: default `full`.

The mode flag selects which checks run. `full` runs everything. The narrower modes are for fast spot-checks.

## Mode: weekly

Lightest mode. Just the week's activity:

- Commits in the last 7 days (count, authors, by branch)
- Experiments started: list of new exp-IDs with their hypothesis one-liners
- Experiments finalized: list with status
- Drift events: any `[SCOPE-DRIFT]` commits, summarized as alignment notes
- Override events: count + brief reasons
- Open handoffs (`handoffs/outgoing/*` without matching `incoming/*`)
- Formalism bumps: any `formalism-v*` tags created

This is what you'd run every Monday morning. Output is short and scannable.

## Mode: formalism

Run formalism-specific checks:

1. **Stale references**: grep for old version numbers in `.md`, `.py`, `.ts`, `.tex` outside `experiments/`. Group by version.
2. **Symbol consistency**: check `formalism.md` symbol table matches what's used in derivations and code comments.
3. **Version mismatch in claims**: any claim whose `formalism_version` doesn't match `formalism.md`'s current version → list.
4. **Active experiments running on outdated formalism**: their lock has older `formalism_version` → list (often correct, but flag for awareness).

## Mode: coverage

Run `lablock-coverage --strict --json` and parse:

- Empirical claims with insufficient evidence (< 2 done exps): list each
- Hypothesis claims that have been around > 30 days without progressing to empirical: list
- Done experiments not referenced by any claim: list (often unfinished synthesis)
- Claim strength label / evidence count mismatches: list

## Mode: orphans

Run `lablock-orphans --json` and parse:

- `.md` files in tracked directories not referenced by any index (`INDEX.md`, `MAP.md`, `experiments/matrix.md`, sub-`README.md`).
- Whitelist exempts: `templates/`, `paper/drafts/.history/`, `tests/fixtures/`, `node_modules/`, `.lablock/cache/`.

For each orphan: suggest where it should be indexed, or whether it should be archived/deleted.

## Mode: full

All of the above, plus:

5. **Frontmatter validity**: run `lablock-frontmatter-check --strict`. Any failures listed.
6. **Drift alignment notes**: run `lablock-drift-audit --json`. Unclassified SCOPE-DRIFT commits are listed as interpretation caveats, not automatic failures.
7. **All-active scope verification**: run `lablock-verify-scope --all-active --source=head`. Any active experiment whose lock disagrees with current `main` state → explain whether this likely helps, changes, or distracts from the original hypothesis.
8. **Index freshness**: check that `MAP.md` was regenerated after the latest commit affecting hypothesis or lock files. If stale, suggest running `lablock-map`.
9. **Postmortem coverage**: experiments with status `killed` or `superseded` but no `postmortem.md` → list.
10. **`.lablock/learnings.jsonl` size**: report count. If > 1000 entries, suggest archiving.

## Step 1: Run checks

For the selected mode, run the corresponding bin tools, capture JSON output, parse.

## Step 2: Compile report

Save to:

```
reviews/audit-<date>.md
```

Format (full mode):

```markdown
---
type: audit
mode: <full|formalism|coverage|orphans|weekly>
created: <date>
---

# Project Audit: <date>

## Summary

| Check | Issues |
|---|---|
| Frontmatter | <count> |
| Drift alignment notes | <count> |
| Active scope | <count> |
| Coverage | <count> |
| Formalism stale refs | <count> |
| Orphans | <count> |
| Postmortem coverage | <count> |
| Index freshness | <fresh|stale> |

**Alignment verdict**: ON-TRACK / NEEDS-FOCUS / HIGH-RISK

## Weekly digest

<commits, exps, drift events, etc.>

## Detailed findings

### Frontmatter
- ...

### Drift alignment notes
- ...

### ...
```

## Step 3: Verdict

- **ON-TRACK**: current work is coherent with the research goal.
- **NEEDS-FOCUS**: there are caveats or stale areas, but the main direction is still usable.
- **HIGH-RISK**: current work likely no longer tests the stated goal unless reframed.

High-risk triggers include:
  - frontmatter validation failures
  - repeated unclassified SCOPE-DRIFT that changes interpretation
  - active experiments with current scope drift
  - empirical claims with no evidence

Print the verdict prominently.

## Step 4: Suggestion list

For each non-empty category, suggest a follow-up:

- **Frontmatter failures** → fix or run `/lab-init --migrate` for legacy files.
- **Drift alignment notes** → `/lab-guard` per affected experiment when classification is needed.
- **Active scope drift** → decide whether to fork, override, continue-with-note, or recenter.
- **Coverage gaps** → run experiments to support claims, or weaken claims via `/lab-paper-write`.
- **Formalism stale refs** → review per file; some may be intentional (postmortems, archived experiments).
- **Orphans** → add to index or archive.
- **Missing postmortems** → run `/lab-postmortem --exp=<id>`.
- **Stale MAP** → run `lablock-map`.

## Step 5: Final report

Print:

```
Audit complete: reviews/audit-<date>.md

<summary table>

Alignment: <ON-TRACK | NEEDS-FOCUS | HIGH-RISK>

<top 3-5 suggested actions>
```

## Special cases

- **Just-initialized project**: many checks return empty. That's healthy; report ON-TRACK with note "project just initialized".
- **Audit during active scope drift**: this is normal mid-experiment; describe the alignment impact instead of failing the audit.
- **Audit on a paper branch**: skip experiment-related checks; focus on paper/audit + claims-to-evidence integrity.

## Don't

- Don't modify any files. This is read-only.
- Don't soft-pedal high-risk findings.
- Don't run all modes at once if user requested a narrow mode—respect the scope.
- Don't include the user's git credentials, tokens, or secrets in any output.
- Don't repeat-spam findings. If the same orphan appeared in last week's audit, mention "(also in last audit)" rather than acting like it's new.
