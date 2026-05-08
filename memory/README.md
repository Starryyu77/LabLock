# LabLock Project Memory

## Current Task

Implement the LabLock v3 developer specification into this repository.

## Source Contract

The pasted "LabLock — Developer Implementation Specification" is the current implementation contract. The active repository started as a minimal GitHub repo containing only `README.md`.

## Status

- 2026-05-08: Repository cloned from `https://github.com/Starryyu77/LabLock.git`.
- 2026-05-08: Local `memory/` initialized because no task-memory skill is available in this Codex session.
- 2026-05-08: Phase 0 implementation scaffold completed: Bun/TypeScript project config, core `lib/`, CLI entrypoints, hooks, templates, all LabLock skill directories, docs, setup scripts, CI workflow, and focused unit tests.
- 2026-05-08: Verification passed with `bun test`, `bun run typecheck`, `lablock-frontmatter-check --strict`, `lablock-verify-scope --all-active --source=head --json`, shell syntax checks, and a temporary `lablock init-project` smoke test.
- 2026-05-08: Added scriptable experiment lifecycle automation: `lablock exp-init`, `lablock fork`, and hardened `lablock override` metadata preservation with `LabLock-Override` trailers.
- 2026-05-08: Added integration tests for init -> exp-init -> drift block -> override -> fork -> drift audit, plus protected branch/tag checks through both `lablock-check-push` and the real `pre-push` hook stdin path.
- 2026-05-08: Full verification passed: `bun test` (16 pass), `bun run typecheck`, and shell syntax checks for updated hooks.
- 2026-05-08: Added `lab-update` as the reusable software-update skill for refreshing installed LabLock skill packages from a local canonical LabLock source. It is not a repo-push skill; GitHub pull is optional via explicit `--pull`.
- 2026-05-08: Hardened alpha readiness gaps from repo review: per-skill host installation under `~/.claude/skills/lab-*` and `~/.agents/skills/lab-*`, canonical implementation at `~/.lablock/source`, portable CI that clones LabLock before running checks, stricter drift accountability binding `exp_id` + `change_id` + decision type, deterministic lifecycle CLI (`exp-start`, `exp-finalize`, `postmortem`, `cleanup-pr --dry-run`), and `apply_patch` PreToolUse coverage.
- 2026-05-08: Verification passed after alpha hardening: `bun run typecheck`, `bun test` (19 pass), hook `bash -n` checks, focused integration tests for update-skills/e2e/branch-protection/lifecycle CLI, and a temp-HOME `./setup --host=codex --no-prompts` install smoke test.

## Next Checkpoint

Next hardening target: optional live GitHub API branch-protection application/inspection after explicit permission, richer probe templates, and more complete claim/paper audit parsing.
