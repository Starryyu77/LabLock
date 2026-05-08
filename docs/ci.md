# CI

The bundled GitHub Actions workflow runs:

- frontmatter validation
- scope verification for active locks
- claim coverage
- drift accountability audit
- probes on `main`

`ci.mode: warn-only` keeps failures non-blocking. `ci.mode: enforce` blocks merges.
