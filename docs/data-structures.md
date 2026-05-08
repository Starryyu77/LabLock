# Data Structures

## scope.lock

Each experiment lock records:

- `locked_invariants.config`: dotted config keys and expected values
- `locked_invariants.files`: paths and SHA256 hashes
- `locked_invariants.probes`: commands that act as contract tests
- `controlled_changes`: what the experiment is allowed to change

## Commit Meta

`.git/lablock-commit-meta.json` bridges pre-commit, commit-msg, and post-commit. It is gitignored.

## Change Index

`.lablock/state/change-index.jsonl` maps `chg-XXXXXXXX` IDs to commits. It is append-only and gitignored.

## Dashboard

`lablock dashboard` generates a static experiment board from existing LabLock files:

- source: `experiments/*/hypothesis.md`
- source: `experiments/*/results.md`
- source: `.lablock/locks/*.scope.lock`
- output: `.lablock/dashboard/data.json`
- output: `.lablock/dashboard/index.html`

The dashboard does not introduce a second database. Edit the experiment files, rerun `lablock dashboard`, and the board refreshes from the file-backed source of truth.
