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
- 2026-05-08: Continued GitHub hardening: added `lablock github-protection check|apply` so remote branch protection can be inspected/applied deterministically and GitHub API 403 responses are reported as `unavailable` instead of being mistaken for success.
- 2026-05-08: Live verification for `Starryyu77/LabLock` ran through `lablock github-protection check --repo Starryyu77/LabLock --branch main --json`; GitHub returned API 403 and LabLock reported `status: unavailable` as intended. Full verification passed with `bun run typecheck`, `bun test` (20 pass), and hook syntax checks.
- 2026-05-08: Upgraded GitHub protection from read/apply to policy verification: `check` now reports `compliance`, `missing`, and `dangerous`; `--strict` exits nonzero on unavailable/skipped/noncompliant states; `apply` requires `--required-status` unless explicitly overridden, supports `--dry-run`, and defaults to merge-existing rather than replacement.
- 2026-05-08: `github-protection apply --dry-run` merge mode now preserves existing status contexts and stricter PR review settings while adding LabLock-required contexts/review minimums.
- 2026-05-08: Live GitHub checks after policy upgrade behaved as intended: `check --strict` for `Starryyu77/LabLock/main` exited 1 with `status: unavailable` on GitHub API 403, and `apply --replace --dry-run` printed the planned branch protection payload without writing settings.
- 2026-05-08: Tightened GitHub protection beta-candidate edges: policy verification now requires `required_status_checks.strict == true`; merge-existing preserves dismissal restrictions and bypass pull request allowances; dry-run output includes existing/planned/delta; added minimal `lablock github-ruleset check` for active rules on concrete refs like `paper/draft`.
- 2026-05-08: Live `lablock github-ruleset check --repo Starryyu77/LabLock --branch main --json` returned `status: no-rules`, confirming the active-rules endpoint is reachable and no repository rules currently apply to `main`.
- 2026-05-08: Shifted focus from GitHub protection to research-loop dogfood. Added `docs/dogfood.md` controlled dogfood protocol and `tests/integration/dogfood-rehearsal.test.ts`, which rehearses init -> exp-init -> exp-start -> drift block -> override -> finalize -> postmortem -> drift audit.

## Next Checkpoint

Next hardening target: run controlled dogfood in a real research repo for 3-5 days, then fix the highest-friction `scope.lock`, hook, and audit issues before expanding probe templates or claim/paper parsing.
