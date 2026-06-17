---
name: lab-init
description: |
  Initialize a new LabLock research project from scratch. Triggers: "init project", "set up LabLock", "new research repo", "新建科研项目", "start LabLock here". Creates the directory skeleton (PROJECT.md, formalism.md, claims.md, .lablock/, experiments/, decisions/, etc.), installs git hooks, writes injected sections to CLAUDE.md and AGENTS.md, generates the GitHub Actions CI workflow, and records the project config. This skill writes many files and modifies git config; user must invoke explicitly.
disable-model-invocation: true
related-skills:
  - lab-exp-init
---

# /lab-init

You are initializing a LabLock research project. Walk the user through the steps in order. Do not batch questions—ask one at a time when input is needed. Do not skip the pre-flight checks.

## Pre-flight

Before doing anything, verify:

1. **Inside a git repository.** Run `git rev-parse --git-dir`. If it fails, ask the user: "This directory is not a git repository. Run `git init` first?" If yes, run it; if no, abort.
2. **Not already initialized.** If `.lablock/config.yaml` exists, abort with: "This project is already initialized. Run `/lab-audit` for project health, or remove `.lablock/` to start over."
3. **Prerequisites.** Run `lablock doctor` and report any ✗ items. The user can proceed without `gh` (some features will be unavailable) but cannot proceed without Bun or git.

## Step 1: Project metadata

Ask the user, one question at a time:

- **Project name** — default to the current directory's basename. Used in `PROJECT.md`.
- **Research domain** — one line, e.g., "vision-language pretraining", "LLM agent reasoning", "video understanding".
- **Initial hypothesis** — one sentence. Vague is OK at this stage; the user will refine in `/lab-plan`. But push back gently on hypotheses with no measurable claim ("X works well" → "X improves Y by N%").

## Step 2: Layer 2 modules

Show the available modules with default selections based on the domain heuristic:

- vision/CV → `gpu`, `data`, `vision`
- LLM/NLP → `gpu`, `data`, `lit`
- Agents → `gpu`, `agents`
- ML systems → `gpu`

Confirm with the user. They can override with any subset of `gpu, data, agents, vision, lit`. The choice goes into `.lablock/config.yaml` under `modules:`.

## Step 3: CI mode

Explain the trade-off plainly:

- `warn-only` — CI runs but doesn't block merges. Recommended for solo work and migration.
- `enforce` — CI must pass to merge to protected branches. Recommended for teams and new projects.

Default `warn-only`. Confirm.

## Step 4: Naming profile

Ask whether the user already has expected naming for variables, experiment families, or paper tables.

Then offer three choices:

- **A. Minimal**: keep `exp-NNN-<shortname>` and light free-text naming. Best for small exploratory repos.
- **B. Paper-Aligned Registry (recommended)**: keep stable `exp-NNN`, but maintain `.lablock/variables.yaml` and `.lablock/matrices.yaml` so variables, variants, paper labels, and matrix membership stay consistent.
- **C. Matrix-First / Sweep-Heavy**: optimize for large ablations or sweeps, with matrix and cell IDs shaping experiment shortnames.

Default to **B** unless the user explicitly says this is a small throwaway repo or a large sweep-first project.

Record the choice as `--naming-profile=minimal|paper-aligned|matrix-first`. Explain:

- Experiment ID is for stable citation: `exp-007`
- Experiment shortname is for human scanning: `qkvproj-elm`
- Variable registry is for canonical naming: `var-001`, `qkv_projection_type`, paper label
- Matrix registry is for paper tables and ablation families: `mat-001`, `qkv-projection-ablation`

## Step 5: GitHub remote (optional)

Ask: "Configure a GitHub remote now?"

- `none` — skip
- `create-private` — `gh repo create <name> --private --source=. --remote=origin`
- `create-public` — same but public
- `link-existing` — ask for URL, run `git remote add origin <url>`

If a remote was created or linked, also offer to set branch protection on `main`. If yes, run `lablock github-protection apply --branch=main --required-status=lablock-checks --required-reviews=1 --dry-run --json` after the first push, then apply for real after the user reviews the payload.

## Step 6: Generate skeleton

Run:

```bash
lablock init-project \
  --name="<project-name>" \
  --modules="<csv-of-modules>" \
  --ci-mode="<warn-only|enforce>" \
  --naming-profile="<minimal|paper-aligned|matrix-first>" \
  --goal="<one-line-domain>" \
  --hypothesis="<initial-hypothesis>"
```

This single command:

- creates all directories (`.lablock/`, `experiments/`, `decisions/`, `reviews/`, `handoffs/`, `paper/`, etc.)
- creates `.lablock/naming.yaml`, `.lablock/variables.yaml`, and `.lablock/matrices.yaml`
- renders all templates (`PROJECT.md`, `formalism.md`, `claims.md`, `INDEX.md`, `MAP.md`, `experiments/matrix.md`, `.gitignore`, `.gitattributes`, `.claude/settings.json`)
- writes `.lablock/config.yaml` with the user's choices
- writes `.github/workflows/lablock.yml`
- injects `## lablock` sections into `CLAUDE.md` and `AGENTS.md`
- installs git hooks (symlinks first, copy fallback) into `.git/hooks/`

## Step 7: Initial commit

Stage and commit:

```bash
git add .
git commit -m "[main] LabLock: initialize project"
```

The pre-commit hook will run for the first time. If it complains about anything, that's a real issue—don't `--no-verify`. Resolve it.

## Step 8: Final report

Print a clean summary:

- Files created — show count, not full list
- Hooks installed — list the 5 names (`pre-commit`, `prepare-commit-msg`, `commit-msg`, `post-commit`, `pre-push`)
- CLAUDE.md / AGENTS.md status — created, appended, or replaced existing `## lablock` section
- GitHub remote — none / created / linked
- Naming profile — minimal / paper-aligned / matrix-first, plus registry file paths
- Next step: "Run `/lab-plan` to design your first research direction, or `/lab-exp-init` if you already know what to test."

## Failure modes

If `init-project` fails partway through, **do not leave the project in a half-initialized state**:

- Remove anything created under `.lablock/`, `experiments/`, etc.
- Restore `CLAUDE.md` / `AGENTS.md` from any backup (the implementation makes these idempotent—if user had existing content, the inject is reversible).
- Do not delete the user's git repository or any pre-existing files.

Print the failure reason clearly with stderr captured.

## Don't

- Don't skip Step 6 (initial commit). Without it, the project has no baseline and the first real commit will sweep up bootstrap files.
- Don't run `lablock init-project` twice in the same directory. Detect existing `.lablock/config.yaml` first.
- Don't promise GitHub branch protection without `gh` available. Check `lablock doctor` first.
