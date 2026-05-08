---
name: lab-update
description: |
  Update the installed LabLock skill package from a reusable local LabLock source. Triggers: "更新 LabLock skill" / "自动更新仓库" / "update LabLock" / "refresh lablock skill" / "同步 LabLock 工具".
  Use this from any project that already uses LabLock. It refreshes the global Claude/Codex LabLock skill installation, and optionally project-local vendored skill folders, from a local canonical LabLock source. It does not pull from GitHub unless explicitly requested.
  Side effects: updates per-skill symlinks or copies under ~/.claude/skills/lab-*, ~/.agents/skills/lab-*, and optionally .claude/.agents project skill folders.
disable-model-invocation: true
related-skills:
  - lab-audit
inputs:
  - name: source
    type: path
    required: false
    default: LABLOCK_HOME or ~/.lablock/source
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

LabLock should behave like reusable local software. After the canonical LabLock source has been updated once, other projects should be able to invoke `/lab-update` and refresh their installed LabLock skills from that local source. They should not need to manually clone or pull GitHub every time.

## Default Behavior

Run:

```bash
lablock update-skills --host=both --scope=global
```

This updates:

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
lablock update-skills --host=both --scope=global
```

Update only Codex:

```bash
lablock update-skills --host=codex --scope=global
```

Update global install plus any existing project-local vendored skill folders:

```bash
lablock update-skills --host=both --scope=auto
```

Preview without writing:

```bash
lablock update-skills --host=both --scope=auto --dry-run
```

Only when the user explicitly wants to refresh from GitHub first:

```bash
lablock update-skills --pull --host=both --scope=global
```

## Safety Rules

- Do not run `git pull` unless the user explicitly asks for `--pull` or says they want the latest from GitHub.
- Prefer symlinks for global installs so future LabLock repo updates are reused automatically.
- If a target is already a directory copy, update it by copying over from the source; do not delete user files manually.
- Never touch the current project’s source files except `.claude/skills/lab-*` or `.agents/skills/lab-*` when `--scope=project`, `both`, or `auto` is requested.
- Report the exact source and target paths at the end.
