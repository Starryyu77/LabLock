# CI

The bundled GitHub Actions workflow runs:

- frontmatter validation
- scope verification for active locks
- claim coverage
- drift accountability audit
- probes on `main`

`ci.mode: warn-only` keeps research-alignment failures non-blocking. `ci.mode: enforce` is still available when a project explicitly wants merge-time enforcement.

## GitHub Branch Protection

LabLock has two layers:

- local `pre-push` checks reject protected branch deletion, protected tag deletion, and non-fast-forward pushes;
- GitHub branch protection can enforce the same boundary on the remote when the repository plan and permissions allow it.

Check remote protection:

```bash
lablock github-protection check --branch=main --required-status=lablock-checks --required-reviews=1 --strict --json
```

The command reports:

- `compliance: passed | failed`
- `missing`: required policy entries that are absent
- `dangerous`: enabled settings that violate LabLock policy, such as force pushes

LabLock's default policy requires the requested status contexts, strict status checks, the requested review count, admin enforcement, no force pushes, and no branch deletion. With `--strict`, unavailable, inaccessible, skipped-pattern, and noncompliant branches exit 1.

Dry-run a remote protection update:

```bash
lablock github-protection apply --branch=main --required-status=lablock-checks --required-reviews=1 --dry-run --json
```

The dry-run output includes `existing_summary`, `planned_payload`, and a `delta` with `added`, `changed`, `preserved`, and `possibly_dropped` keys.

Apply remote protection explicitly after reviewing the payload:

```bash
lablock github-protection apply --branch=main --required-status=lablock-checks --required-reviews=1
```

`apply` refuses to run without `--required-status` unless `--allow-no-required-status` is explicitly set. By default it merges with existing known protection settings, including existing status contexts, stricter PR review counts, code owner review, dismissal restrictions, and bypass allowances. Use `--replace` only when you want LabLock's minimum payload to replace the existing branch protection rule.

For pattern branch coverage such as `paper/**`, use active rules/ruleset lookup on a concrete ref:

```bash
lablock github-ruleset check --branch=paper/draft --strict --json
```

If GitHub returns `403` for a private repository, LabLock reports `unavailable`. That usually means the account/repository plan does not expose branch protection for private repos, or the current token lacks admin permission.
