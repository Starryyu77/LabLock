# Architecture

LabLock separates source-of-truth files from generated projections.

- Source of truth: `.lablock/locks/*.scope.lock`, `experiments/*/hypothesis.md`, `claims.md`, `formalism.md`, `decisions/`.
- Runtime state: `.lablock/state/*` and `.git/lablock-commit-meta.json`.
- Projections: `MAP.md` and `experiments/matrix.md`.

Hooks call small `bin/` entrypoints. Those entrypoints delegate to `lib/` modules so behavior can be tested without shell scripts.

## Installed Layout

LabLock intentionally separates implementation source from host skill discovery.

- Canonical implementation source: `~/.lablock/source`
- Claude skill discovery: `~/.claude/skills/lab-*`
- Codex skill discovery: `~/.agents/skills/lab-*`

Git hooks and project templates should call the canonical source through `LABLOCK_HOME` or `~/.lablock/source`. The host skill directories should only contain per-skill symlinks or vendored copies so Claude/Codex can discover each `SKILL.md` directly.

`lab-update` is an official LabLock extension added after the original 22-skill specification. It runs `lablock update`, which pulls the canonical source with `git pull --ff-only`, runs `bun install`, and refreshes per-skill host installations. It is not a repository publish command. For offline/local refreshes, use `lablock update --no-pull --no-install` or the lower-level `lablock update-skills`.

## Commit-Time Flow

The commit pipeline is:

1. `pre-commit`: frontmatter, LFS, staged diff classification, scope verification, changelog, generated maps, commit meta.
2. `prepare-commit-msg`: prefix scope/tag and append `LabLock-Change`.
3. `commit-msg`: validate message format and trailer consistency.
4. `post-commit`: append change index, update last-commit state, clear commit meta.

When `.lablock/config.yaml` sets `drift.layers.probes` to `local` or `both`, `pre-commit` includes Layer 3 probes in local scope verification. Otherwise local commits check config and file invariants only.

## Remote Boundary

Local hooks are not the final trust boundary. Protected branches should use:

```bash
lablock github-protection check --branch=main --required-status=lablock-checks --required-reviews=1 --strict --json
```

Pattern branches such as `paper/**` should be checked through rulesets with a concrete branch example:

```bash
lablock github-ruleset check --branch=paper/draft --strict --json
```
