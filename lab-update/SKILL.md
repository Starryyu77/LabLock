---
name: lab-update
description: |
  One-command upgrade for installed LabLock. Use for "update LabLock", "upgrade LabLock", "同步 LabLock 工具", or "自动更新仓库". Runs `lablock update` to pull the canonical source, install dependencies, and refresh Claude/Codex skills. User-invoked only.
disable-model-invocation: true
related-skills:
  - lab-audit
inputs:
  - name: source
    type: path
    required: false
    default: LABLOCK_HOME or ~/.lablock/source
  - name: ref
    type: git ref
    required: false
    default: current canonical source branch
  - name: host
    type: enum (claude, codex, both)
    required: false
    default: both
  - name: scope
    type: enum (global, project, both, auto)
    required: false
    default: global
  - name: pull
    type: boolean
    required: false
    default: false
outputs:
  - Updated LabLock skill installation paths
  - Source path used
  - Whether each target was symlinked, copied, or already current
---

# /lab-update

Use this skill from any repository where the user wants to refresh LabLock itself, not the current research project.

## Intent

LabLock should behave like reusable local software. After the LabLock GitHub repository is updated, users should be able to invoke `/lab-update` from any project and get the new local LabLock source plus refreshed Claude/Codex skills. They should not need to manually clone or pull GitHub every time.

## Default Behavior

Run:

```bash
lablock update --host=both --scope=global
```

This:

- Runs `git pull --ff-only` in the canonical LabLock source.
- Runs `bun install` in that source.
- `~/.claude/skills/lab-*`
- `~/.agents/skills/lab-*`

from the detected local LabLock source.

## Source Detection

Use this order:

1. `--source=<path>` if the user gives one.
2. `LABLOCK_HOME` if set.
3. The current working directory if its `package.json` has `"name": "lablock"`.
4. `~/.lablock/source`.

Abort if no valid LabLock source is found.

## Recommended Commands

Global update for both hosts:

```bash
lablock update --host=both --scope=global
```

Install a preview branch, tag, or commit explicitly:

```bash
lablock update --ref codex/experiment-dashboard --host=both --scope=global
```

Update only Codex:

```bash
lablock update --host=codex --scope=global
```

Update global install plus any existing project-local vendored skill folders:

```bash
lablock update --host=both --scope=auto
```

Preview without writing:

```bash
lablock update --host=both --scope=auto --dry-run
```

Refresh only skill links without pulling GitHub or reinstalling dependencies:

```bash
lablock update --no-pull --no-install --host=both --scope=global
```

## Safety Rules

- `/lab-update` means the user wants the latest LabLock release; `lablock update` pulls by default.
- Use `--ref` only when the user explicitly wants a preview branch, tag, or commit. Do not silently move users off the stable branch.
- Use `lablock update --no-pull --no-install` only when the user explicitly wants a local refresh without GitHub.
- Prefer symlinks for global installs so future LabLock repo updates are reused automatically.
- If a target is already a directory copy, update it by copying over from the source; do not delete user files manually.
- Never touch the current project’s source files except `.claude/skills/lab-*` or `.agents/skills/lab-*` when `--scope=project`, `both`, or `auto` is requested.
- Report the exact source and target paths at the end.
