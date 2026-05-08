# CI

The bundled GitHub Actions workflow runs:

- frontmatter validation
- scope verification for active locks
- claim coverage
- drift accountability audit
- probes on `main`

`ci.mode: warn-only` keeps failures non-blocking. `ci.mode: enforce` blocks merges.

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

With `--strict`, unavailable, inaccessible, skipped-pattern, and noncompliant branches exit 1.

Dry-run a remote protection update:

```bash
lablock github-protection apply --branch=main --required-status=lablock-checks --required-reviews=1 --dry-run --json
```

Apply remote protection explicitly after reviewing the payload:

```bash
lablock github-protection apply --branch=main --required-status=lablock-checks --required-reviews=1
```

`apply` refuses to run without `--required-status` unless `--allow-no-required-status` is explicitly set. By default it merges with existing known protection settings; use `--replace` only when you want LabLock's minimum payload to replace the existing branch protection rule.

If GitHub returns `403` for a private repository, LabLock reports `unavailable`. That usually means the account/repository plan does not expose branch protection for private repos, or the current token lacks admin permission.
