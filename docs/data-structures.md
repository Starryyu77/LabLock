# Data Structures

## scope.lock

Each experiment lock records:

- `naming`: optional matrix/variable/paper-label reference for paper-aligned maintenance
- `locked_invariants.config`: dotted config keys and expected values
- `locked_invariants.files`: paths and SHA256 hashes
- `locked_invariants.probes`: commands that act as contract tests
- `controlled_changes`: what the experiment is allowed to change

## Naming Registries

Project-level naming files live under `.lablock/`:

- `naming.yaml`: selected profile (`minimal`, `paper-aligned`, or `matrix-first`) and naming rules
- `variables.yaml`: canonical variable registry (`var-NNN`, `canonical_name`, `paper_label`, `code_keys`, allowed values)
- `matrices.yaml`: experiment matrix registry (`mat-NNN`, slug, primary variable, controlled axes, related experiments, paper target)

Experiment names remain readable, but paper/table synthesis should prefer registry metadata when available.

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
