---
name: lab-exp-init
description: |
  Start a new experiment, ablation, or scope.lock'd investigation. Triggers: "new experiment", "start an experiment", "ablate X", "做个 ablation", "新实验", "fork experiment via init", "exp-init". Creates the experiment directory, hypothesis.md, and scope.lock as a research frame with primary intervention, planned bundle, invariants, and criteria. Does NOT create a git branch. User-invoked only.
disable-model-invocation: true
related-skills:
  - lab-plan-exp
  - lab-exp-start
  - lab-fork
---

# /lab-exp-init

You are creating a new experiment node. The user has typically already done `/lab-plan-exp` (recommended) or has a clear design in mind. The user invokes this with a shortname and a parent.

## Pre-flight

1. **Validate `<shortname>`**: lowercase letters, digits, dashes only; 3-30 chars. Reject names like `Foo Bar`, `_test`, or `eval2!`. Suggest a slugified version.
2. **Validate parent.** If the user passes `--parent=exp-NNN`:
   - Verify the parent's `experiments/<parent>-*/hypothesis.md` exists.
   - Verify the parent's `frontmatter.status` is not `superseded`. If it is, refuse: "Parent `<parent>` is superseded; pick a different parent or use `/lab-fork` from an active exp."
   - If no parent (root experiment), `--parent=none`.
3. **Tell the user the next ID.** Run `lablock next-exp-id` and announce: "This will be created as `exp-NNN`."

## Step 1: Hypothesis

Ask: "State the hypothesis in one sentence (≤ 280 chars). Make it falsifiable."

Examples to show if user is vague:
- ✅ "Adding contrastive loss term L_con (λ=0.1) improves downstream classification accuracy by ≥ 1%."
- ✅ "Replacing absolute positional embeddings with rotary improves long-context (>4k) perplexity."
- ❌ "Contrastive helps."  → push back: "What metric? On what task? What's the predicted direction and rough magnitude?"

## Step 2: Controlled changes (the variable being tested)

Ask: "What primary intervention are you testing compared to `<parent>`?"

Capture as 1-3 short bullets. If the intervention needs supporting changes, record them as a planned bundle rather than treating them as accidental drift. These map to `controlled_changes.added/removed/modified` in scope.lock. Example:

```
added:
  - "L_con (λ=0.1) added to L_total"
  - "ContrastiveHead module"
modified:
  - "loss aggregation now sums L_con + L_base"
```

## Step 3: Naming registry binding

Read `.lablock/naming.yaml`, `.lablock/variables.yaml`, and `.lablock/matrices.yaml` if present.

Ask:

1. "Do you already have expected names for the variable and variant?"
2. "Which naming option should this experiment follow?"

Use the project's selected profile:

- **Minimal**: require only a clear `shortname`; variable and matrix metadata are optional.
- **Paper-Aligned Registry**: recommend binding the experiment to `variable_id`, `canonical_variable`, `variant_value`, `paper_label`, and optionally `matrix_id`.
- **Matrix-First / Sweep-Heavy**: strongly recommend `matrix_id`, `variable_id`, and `variant_value`; shortname should reflect matrix/cell/variant.

If the needed variable or matrix is missing, propose a registry delta and ask the user to approve adding it before running `exp-init`. If approved, update `.lablock/variables.yaml` and/or `.lablock/matrices.yaml` first, then run `exp-init`. Keep the suggested names stable:

- `canonical_variable`: `snake_case`
- `shortname`: lowercase dash slug
- `paper_label`: human-readable label for tables
- `matrix_id`: `mat-NNN`
- `variable_id`: `var-NNN`

If the user declines registry metadata, continue only after noting that later paper/table synthesis may be weaker.

## Step 4: Layer 1 invariants — config

If parent has `experiments/<parent>-*/config.yaml`, parse it. Walk the user through every key and ask: "Should this stay fixed in `<new-exp-id>`?"

Anything they say YES to → `locked_invariants.config`. Anything NO → goes into `controlled_changes` if it serves the research goal, or is called out as avoidable drift if it does not.

**Minimum**: at least 3 config invariants, otherwise warn: "Few config invariants makes drift detection weak. Continue?"

Format the config string for the CLI as comma-separated dotted key=value pairs:

```
optimizer.lr=3e-4,batch_size=256,seed=42,optimizer.weight_decay=0.01
```

## Step 5: Layer 2 invariants — files

Ask: "Which source files MUST stay byte-identical for this experiment to be valid?"

Suggest based on domain conventions:
- Dataloader / sampler files
- Base model definition
- Base loss implementation (the version your contrastive term is added to)
- Reference baseline (if reproducing)

For each path the user names:
- Verify the file exists.
- Compute its current SHA-256. The `lablock exp-init --file-invariant` path hashes files internally when creating the lock.
- Capture a one-sentence reason.

Format for CLI: comma-separated `path:reason` entries.

```
src/data/sampler.py:sampling distribution must not change,src/models/resnet.py:base model is fixed
```

If the user lists 0 files, warn explicitly: "Without file invariants, semantic drift in dataloader / loss can silently change your conclusion. Recommend at least 1-2."

## Step 6: Layer 3 invariants — probes (optional)

Ask: "Do you have any contract tests that must pass for this experiment to be considered valid?"

Suggest common templates:
- `dataloader_contract` — pytest checking sampling distribution and batch shape
- `loss_contract` — pytest checking that base loss equals previous version when ablation knobs are zero
- `model_forward_contract` — smoke test that model forward pass matches a reference

For each probe collected: `name`, `command`, `requires` (cpu/gpu/data/network), `timeout_sec`, `run_on` (default `["ci-main", "manual"]`).

Probes are optional. If the user has none, that's fine; rely on Layer 1 + Layer 2.

## Step 7: Kill and success criteria

Ask:

- **Kill criteria** (`--kill`): "Under what conditions should you abandon this experiment?" Defaults to suggest:
  - "Val loss diverges after 5k steps"
  - "GPU hours exceed N"
  - "Downstream metric drops > X% vs baseline"
- **Success criteria** (`--success`): "What's a clear success?" Tie back to the hypothesis from Step 1.

Both must have ≥ 1 entry. CLI accepts comma-separated.

## Step 8: Run the CLI

Compose the full command and run:

```bash
lablock exp-init "<shortname>" \
  --parent="<exp-NNN | none>" \
  --hypothesis="<one-sentence hypothesis>" \
  --config="<dotted.key=value,...>" \
  --control-added="<csv>" \
  --control-modified="<csv>" \
  --matrix-id="<mat-id>" \
  --variable-id="<var-id>" \
  --canonical-variable="<snake_case>" \
  --variant-value="<value>" \
  --paper-label="<label>" \
  --file-invariant="<path:reason,...>" \
  --kill="<csv>" \
  --success="<csv>" \
  --stage
```

`--stage` adds the new experiment dir and lock to the index, ready to commit.

## Step 9: Verify and report

Print to the user:

- Path to `.lablock/locks/<exp-NNN>.scope.lock`
- Path to `experiments/<exp-NNN>-<shortname>/hypothesis.md`
- Naming reference: matrix ID, variable ID, canonical variable, variant value, and paper label if provided
- A reminder: "scope.lock is the shared research frame. Later drift is a signal to recenter, fork, override, or continue with a note."
- Next step: "Continue in `experiments/<exp-NNN>-<shortname>/` by default. Run `/lab-exp-run --exp=<exp-NNN>` when ready to launch a run. Use `/lab-exp-start` only if you explicitly need a Git branch for collaboration, remote CI, or archival history isolation."

Then commit. The hook will treat this as a project bookkeeping commit when no experiment focus is active:

```bash
git commit -m "create <exp-NNN>"
```

The hooks will add the LabLock prefix and `LabLock-Change` trailer.

## Failure modes

- **Parent superseded** → refuse with explanation. Don't silently allow.
- **Shortname invalid** → propose slugified version, ask if acceptable.
- **`exp-init` exits non-zero** → the lock or hypothesis file may be partial. Tell the user to delete `.lablock/locks/<exp-NNN>.scope.lock` and `experiments/<exp-NNN>-*` if they exist, then retry.

## Don't

- Don't create probes you don't understand. If the user has no contract tests yet, leave Layer 3 empty.
- Don't accept fewer than 1 kill criterion or 1 success criterion. The CLI will reject this anyway.
- Don't create a git branch in this skill. Folder isolation is the default; `/lab-exp-start` is optional.
- Don't accept hypotheses without a measurable claim.
