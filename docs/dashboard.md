# Experiment Dashboard

`lablock dashboard` creates a local, static board for managing several experiment lines at once.

```bash
lablock dashboard
```

Default outputs:

- `.lablock/dashboard/data.json`
- `.lablock/dashboard/index.html`

Open it directly when the local environment allows browser launch:

```bash
lablock dashboard --open
```

The board is generated from the existing LabLock source of truth:

- `experiments/<exp>/hypothesis.md` for planning, status, parent/fork links, and notes
- `experiments/<exp>/results.md` for progress and next-step notes
- `.lablock/locks/<exp>.scope.lock` for controlled changes, criteria, config, and lock status

Use parent experiments to model sub-experiments:

```bash
lablock exp-init lr-sweep \
  --parent exp-001 \
  --hypothesis "Lower learning rate improves stability." \
  --config optimizer.lr=0.0005,seed=1 \
  --control-modified "learning rate schedule"
```

The generated board will show `exp-002` under `exp-001` and surface it as the next planned sub-experiment while it is still `planned` or `running`.

For AI-assisted use, invoke `/lab-dashboard`. The skill checks the current repo, refreshes the dashboard, and can guide adding a new real experiment node before reopening the board.

For machine-readable automation:

```bash
lablock dashboard --json
```

To write only `data.json`:

```bash
lablock dashboard --no-html
```
