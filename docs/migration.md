# Migration

For an existing research project:

1. Run `lablock init-project` in `warn-only` CI mode.
2. Add experiments incrementally.
3. Start with config invariants and one or two file invariants.
4. Run `lablock-map` and inspect generated projections.
5. Switch CI to `enforce` only after drift audit output is clean.
