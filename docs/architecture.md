# Architecture

LabLock separates source-of-truth files from generated projections.

- Source of truth: `.lablock/locks/*.scope.lock`, `experiments/*/hypothesis.md`, `claims.md`, `formalism.md`, `decisions/`.
- Runtime state: `.lablock/state/*` and `.git/lablock-commit-meta.json`.
- Projections: `MAP.md` and `experiments/matrix.md`.

Hooks call small `bin/` entrypoints. Those entrypoints delegate to `lib/` modules so behavior can be tested without shell scripts.
