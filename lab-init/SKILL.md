---
name: lab-init
description: |
  Initialize a new LabLock research project. Triggers: "init project", "new research repo", "set up LabLock", "start a new research repo".
  User-invoked only: this skill creates files, installs Git hooks, writes host settings, and may configure GitHub.
disable-model-invocation: true
related-skills:
  - lab-exp-init
  - lab-update
---

# /lab-init

Use this skill only when the user explicitly asks to initialize a repository with LabLock.

## Pre-flight

1. Verify this is a Git repository with `git rev-parse --git-dir`.
2. If it is not a Git repository, ask before running `git init`.
3. Abort if `.lablock/` already exists. Tell the user the project appears initialized.
4. Run `lablock doctor` when available and report missing prerequisites.
5. Confirm the canonical LabLock source is available at `~/.lablock/source` or `LABLOCK_HOME`.

## Collect Inputs

Ask one question at a time:

1. Project name. Default to the directory name.
2. One-line research domain.
3. Initial hypothesis in one sentence.
4. Enabled modules: `gpu`, `data`, `agents`, `vision`, `lit`.
5. CI mode: `warn-only` for solo/dogfood, `enforce` for protected team branches.
6. Optional GitHub remote setup: none, create private/public, or link existing.

## Execute

Run the deterministic initializer:

```bash
lablock init-project --name="<name>" --modules=<csv> --ci-mode=<warn-only|enforce>
```

If GitHub remote setup was requested, use `gh` only after confirming authentication. For branch protection, prefer a dry-run first:

```bash
lablock github-protection apply --branch=main --required-status=lablock-checks --required-reviews=1 --dry-run --json
```

## Verify

1. Confirm `.lablock/config.yaml`, `PROJECT.md`, `formalism.md`, `claims.md`, `INDEX.md`, `MAP.md`, and `experiments/matrix.md` exist.
2. Confirm hooks exist under `.git/hooks/`.
3. Confirm `CLAUDE.md` and `AGENTS.md` contain a LabLock section.
4. Run `lablock-frontmatter-check --strict`.

## Final Report

Report the created project name, CI mode, enabled modules, hook status, GitHub status, and next step:

```text
Next: run /lab-exp-init to create the first experiment.
```
