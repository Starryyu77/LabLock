# Controlled Dogfood Protocol

LabLock v0.1 should be dogfooded on a real research repository before calling it beta. The goal is not to prove every command works in isolation; it is to find whether `scope.lock` prevents real experiment drift without making normal research work too expensive.

## Scope

Use a repository that has:

- at least one runnable experiment or training script;
- a config file that can drift accidentally;
- one source file that should stay invariant during a controlled experiment;
- a normal GitHub remote, even if branch protection is unavailable.

Do not start with a high-stakes paper deadline repo. Pick a live but recoverable project.

## Success Criteria

Dogfood passes if all of these are true:

- `/lab-init` or `lablock init-project` can initialize without manual file surgery.
- `lablock exp-init` creates a useful `scope.lock` in under 20 minutes.
- A folder-isolated experiment can run from `experiments/<exp>-<shortname>/` without creating a Git experiment branch.
- Optional `lablock exp-start` still works when branch isolation is explicitly requested for collaboration, remote CI, or archival history.
- An intentional config drift is blocked by pre-commit until override/fork accountability exists.
- `lablock override` lets an intentional drift commit pass with a valid decision and trailer.
- `lablock fork` creates a new experiment when an invariant file changes.
- `lablock exp-finalize`, `lablock postmortem`, and drift audit produce usable closeout artifacts.
- The researcher can explain at least one accident LabLock would have prevented.

## Friction Log

Keep a plain Markdown log in the target repo:

```text
reviews/lablock-dogfood-YYYY-MM-DD.md
```

Record each friction item with:

| Field | Meaning |
|---|---|
| `phase` | init, exp-init, exp-run, optional-exp-start, drift, override, fork, finalize, audit |
| `severity` | blocker, slows-work, annoyance, unclear-doc |
| `trigger` | command or workflow moment |
| `what happened` | concrete output or behavior |
| `expected` | what the researcher expected |
| `fix idea` | smallest useful change |

## Day 0: Setup

```bash
./setup --host=both --no-prompts
lablock doctor
```

In the target repo:

```bash
lablock init-project --name="<project>" --modules=gpu,data,lit --ci-mode=warn-only
git status --short
git commit -m "Initialize LabLock"
```

Record:

- whether `CLAUDE.md` / `AGENTS.md` injection was useful;
- whether hooks installed in the expected repo;
- whether CI workflow paths make sense for the target repo.

## Day 1: First Experiment

Create a root or baseline experiment:

```bash
lablock exp-init baseline \
  --hypothesis "A narrow, measurable hypothesis." \
  --config optimizer.lr=0.001,seed=1 \
  --file-invariant path/to/source.py:"baseline source should stay fixed" \
  --control-modified "baseline config" \
  --stage

git commit -m "Create baseline experiment"
```

Then invoke `/lab-exp-run --exp=exp-001` from the agent environment. This records the active experiment focus and run metadata without creating a Git experiment branch.

Record:

- which `scope.lock` fields were hard to fill;
- whether config/file invariants were obvious;
- whether folder-local paths for config, outputs, logs, checkpoints, and results were easy to understand;
- whether the command names matched user expectations.

Only run `lablock exp-start --exp=exp-001` if this dogfood pass is explicitly testing optional Git branch isolation.

## Day 2: Drift Handling

Simulate a config drift:

```bash
# edit an invariant config value
git add experiments/exp-001-*/config.yaml
git commit -m "Change lr"
```

Expected: commit is blocked with `SCOPE-DRIFT`.

Then test override:

```bash
lablock override --exp=exp-001 --reason="Intentional one-shot drift for scheduler check."
git commit -m "Accept scheduler drift"
```

Then simulate file invariant drift and fork:

```bash
# edit the invariant source file
git add path/to/source.py
lablock fork --from exp-001 --shortname source-fork --reason "Invariant source changed." --stage
git commit -m "Fork source drift"
```

Record:

- whether the block message was actionable;
- whether override/fork felt like the right mental model;
- whether generated decision files were useful or noisy.

## Day 3: Closeout

Finalize one experiment:

```bash
lablock exp-finalize --exp=exp-001 --status=killed
lablock postmortem --exp=exp-001
git add experiments/exp-001-* .lablock/locks/exp-001.scope.lock
git commit -m "Finalize exp-001"
```

Run audit commands:

```bash
lablock-drift-audit --strict --json
lablock-frontmatter-check --strict
lablock github-protection check --branch=main --required-status=lablock-checks --required-reviews=1 --strict --json
```

If branch protection is unavailable, record the exact `unavailable` output. Do not treat that as dogfood failure unless protected branches are required for this target repo.

## Final Report

At the end, write:

```text
reviews/lablock-dogfood-summary-YYYY-MM-DD.md
```

Use this structure:

```markdown
# LabLock Dogfood Summary

## Repository

## Workflow Completed

## Friction Items

## Accidents Prevented

## Commands That Felt Wrong

## Fields That Were Hard To Fill

## Must Fix Before Beta

## Nice To Have
```

Beta readiness should be judged from this report, not from unit test count alone.
