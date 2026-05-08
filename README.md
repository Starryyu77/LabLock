# LabLock

LabLock is a Bun/TypeScript toolkit for research workflow guardrails:

- experiment `scope.lock` files with config, file, and probe invariants
- commit metadata and changelog trailers
- pre-commit drift detection
- claim/evidence and paper-writing audit commands
- Claude/Codex skill scaffolds for experiment planning, guardrails, handoffs, and cleanup

## Install

```bash
git clone https://github.com/Starryyu77/LabLock.git
cd LabLock
./setup --no-prompts
```

## Initialize A Research Project

From inside a target research repo:

```bash
lablock init-project --name="My Project" --modules=gpu,data,lit --ci-mode=warn-only
```

This creates `.lablock/`, `PROJECT.md`, `formalism.md`, `claims.md`, `experiments/`, hooks, and a GitHub Actions workflow.

## Core Commands

```bash
lablock doctor
lablock next-exp-id
lablock override --exp=exp-002 --reason="intentional drift"
lablock-map
lablock-verify-scope --exp=exp-002 --source=staged --json
lablock-frontmatter-check --strict
lablock-coverage --strict
```

## Development

```bash
bun install
bun test
bun run typecheck
```

The implementation follows the LabLock v3 developer specification.
