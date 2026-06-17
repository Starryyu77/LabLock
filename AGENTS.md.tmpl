## lablock

This project uses LabLock for research-objective alignment. Skills are installed as `~/.agents/skills/lab-*`; implementation lives at `~/.lablock/source`.

### Available skills

User-invoked skills:
- `/lab-init`
- `/lab-migrate`
- `/lab-dashboard`
- `/lab-exp-init`
- `/lab-exp-start`
- `/lab-exp-run`
- `/lab-guard`
- `/lab-fork`
- `/lab-exp-finalize`
- `/lab-cleanup-pr`
- `/lab-paper-init`
- `/lab-formalism-update`
- `/lab-update`

Advisory skills:
- `/lab-advice`
- `/lab-plan`
- `/lab-plan-exp`
- `/lab-review`
- `/lab-autoplan`
- `/lab-taste`
- `/lab-debug`
- `/lab-handoff`
- `/lab-synthesize`
- `/lab-postmortem`
- `/lab-paper-write`
- `/lab-paper-audit`
- `/lab-tidy`
- `/lab-audit`

### Conventions

- Commit messages: `[exp-NNN][TAG] message`
- Experiment IDs: `exp-NNN`
- Primary experiment isolation is folder-based: keep each experiment's plan, config, notes, results, run scripts, and local artifacts under `experiments/<exp-NNN>-<shortname>/`.
- Use Git branches/worktrees only for explicit collaboration, cleanup branches, paper branches, release work, or other cases where history isolation is required. Do not make a new branch/worktree the default way to run every experiment.
- Parallel experiments should use separate experiment folders, not shared `outputs/`, `runs/`, `wandb/`, or checkpoint directories.
- Shared code changes should be deliberate and interpreted against the active research objective; experiment-specific glue belongs inside the experiment folder.
- `.lablock/state/current-exp` is a focus pointer for hooks and dashboards, not the isolation boundary.
- `scope.lock` records the intended experimental frame. Drift events are research alignment notes by default; use `/lab-guard`, `/lab-fork`, or `lablock override` when you want to classify the drift.
- Use `/lab-update` from any project to refresh the installed LabLock skill package from the local canonical LabLock checkout.

### Do not

- Do not manually edit `MAP.md`, `experiments/matrix.md`, or `.lablock/state/*`.
- Do not skip `scope.lock` creation; it is the shared reference for the research goal, not a local progress gate.
- Do not put run outputs, checkpoints, caches, or environment directories in shared top-level folders when they belong to one experiment.
- Do not require a new Git branch/worktree just to run a parallel experiment.
- Do not turn defensive checks into the research agenda. If a check fires, explain how it affects the original goal and keep the next action centered on the experiment.
