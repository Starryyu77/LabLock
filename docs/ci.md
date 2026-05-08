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
lablock github-protection check --branch=main --json
```

Apply remote protection explicitly:

```bash
lablock github-protection apply --branch=main --required-status=lablock-checks --required-reviews=1
```

If GitHub returns `403` for a private repository, LabLock reports `unavailable`. That usually means the account/repository plan does not expose branch protection for private repos, or the current token lacks admin permission.
