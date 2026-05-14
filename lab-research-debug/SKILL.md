---
name: lab-research-debug
description: |
  Deep research diagnosis for experiment failures. Use after local debugging stalls or when a symptom may be known in papers, repos, forums, or community threads. Gathers experiment context, external evidence, local code analysis, and writes a non-gating diagnostic report.
disable-model-invocation: false
related-skills:
  - lab-debug
  - lab-handoff
  - lab-taste
---

# /lab-research-debug

You are doing deep research for a broken or confusing experiment. Your job is not to add defensive gates or keep debugging forever. Your job is to connect three evidence streams:

1. What this LabLock experiment was trying to test.
2. What papers, docs, issue trackers, and open-source communities say about similar failures.
3. What the local code actually does.

The output is a diagnostic report with a next action, not a blocking verdict.

## When To Use

Use this skill when:

- `/lab-debug` has not isolated the cause after a reasonable local pass.
- The symptom may be a known issue in a library, benchmark, dataset, model family, optimizer, distributed setup, or reproduction repo.
- A surprising result might be a bug, an expected phenomenon, or a known paper/reproduction caveat.
- The user asks for "deep research", "查社区", "有没有人遇到过", "参考文献", or "结合代码诊断".

Do not use it for ordinary one-line breakages where `/lab-debug` can fix the problem directly.

## Pre-flight

Resolve the experiment:

- Prefer `--exp=<exp-id>` if provided.
- Otherwise read `.lablock/state/current-exp`.
- If no experiment is active, continue only if the user clearly gave a code path or symptom.

Read, when available:

- `PROJECT.md`
- `formalism.md`
- `experiments/<exp>-*/hypothesis.md`
- `experiments/<exp>-*/config.yaml`
- `experiments/<exp>-*/results.md`
- `.lablock/locks/<exp>.scope.lock`
- `.lablock/changes/<exp>.changes.log`
- existing `debug/*.md` logs related to the symptom
- relevant source files and logs named by the user

If there is no report yet, create a skeleton:

```bash
lablock research-debug --exp=<exp-id> --topic=<short-topic> --symptom="<exact symptom>"
```

Write the final report to:

```text
reviews/<date>-<exp-id>-<topic>-research-debug.md
```

## Phase 1: Build The Local Evidence Pack

Summarize the local problem before searching:

- Research objective and hypothesis.
- Controlled changes and naming/matrix context if present.
- Exact symptom: error text, unexpected metric, regression, divergence, missing output, or anomalous qualitative behavior.
- Minimum reproducer or closest known command.
- Relevant run/log paths.
- Last known good state, if any.
- Relevant local code path: entry point -> config parsing -> data/model/loss/eval path -> symptom.

Keep this short and concrete. If a detail is unknown, write `unknown` rather than inventing it.

## Phase 2: External Research

Use web research when available. Search broadly enough to avoid overfitting to one forum post, but prefer high-quality sources.

Source priority:

1. Official docs, release notes, changelogs, and maintainer-authored issue comments.
2. Papers, benchmark repos, reproduction reports, and method-specific technical notes.
3. GitHub issues/discussions, Discourse, Stack Overflow, Hugging Face discussions, PyTorch/JAX/TensorFlow forums, dataset/model repo threads, and similar open-source community threads.
4. Blog posts or social posts only when they contain reproducible commands, logs, or links to primary evidence.

Search query patterns:

- `<library/model/dataset> <exact error>`
- `<method/task> <unexpected metric or failure mode>`
- `<config key/function/class> bug issue discussion`
- `<paper/repo name> reproduction issue`
- `<symptom> <framework version> <hardware/distributed/runtime>`

For each useful source, record:

- Link.
- Source type.
- How similar it is to the local symptom.
- What it suggests.
- Confidence.

Avoid long quotations. Paraphrase and cite links.

## Phase 3: Local Code Analysis

Now inspect the local implementation against the external evidence.

Look for:

- Config key mismatch or default drift.
- Data preprocessing, split, tokenizer, label, sampling, or batching mismatch.
- Shape/range/NaN/Inf/gradient path issues.
- Optimizer/scheduler/update path not touching the intended parameters.
- Evaluation script not measuring the same thing as the paper/baseline.
- Distributed, mixed precision, cache, seed, environment, or version-specific behavior.
- A planned intervention that silently changed more than the research variable.

Keep the analysis tied to the research goal. Do not recommend broad validators, retries, or abstractions unless the evidence shows they are the shortest path to answering the research question.

## Phase 4: Diagnosis

Choose exactly one primary classification:

- **Confirmed local bug**: local evidence reproduces and explains the symptom.
- **Likely local bug**: strong code evidence but one confirming test remains.
- **Known upstream/library issue**: external evidence closely matches and local versions/configs line up.
- **Expected phenomenon**: papers/community evidence suggests the result is real or common under these conditions.
- **Environment issue**: hardware, distributed runtime, dependency, filesystem, auth, or data staging is the dominant cause.
- **Inconclusive**: evidence is insufficient; next action must narrow the reproducer.

For the diagnosis, include:

- Evidence supporting it.
- Evidence against it.
- What would falsify it.
- Confidence: high / medium / low.

## Phase 5: Next Action

Pick one next action:

- A minimal target-aligned fix.
- A minimal reproducer/probe to confirm the diagnosis.
- `/lab-guard` if the fix would change experiment meaning or locked invariants.
- `/lab-handoff --type=debug` if another AI/teammate should inspect a packaged context.
- `/lab-postmortem` if the experiment should be killed, paused, or marked superseded.

If the next action is a fix, keep it narrow. Do not turn the research-debug report into a new workflow gate.

## Report Shape

Use this structure:

```markdown
---
type: research-debug
exp_id: <exp-id or null>
created: <date>
status: investigating | diagnosed | inconclusive
---

# Research Debug: <topic>

## Symptom
<exact issue>

## Experiment Context
<goal, hypothesis, controlled changes, results/log paths>

## Local Evidence
<reproducer, logs, code path, observations>

## External Evidence
| Source | Type | Similarity | Takeaway | Confidence |
|---|---|---|---|---|

## Local Code Analysis
<code-backed analysis with file/path references>

## Diagnostic Conclusion
<classification, confidence, evidence, falsifier>

## Next Action
<one action>
```

## Don't

- Don't treat forum consensus as proof without checking local code.
- Don't treat local code suspicion as proof without checking known upstream/community issues when the symptom is common.
- Don't add broad defensive gates by default.
- Don't let the research detour become the research agenda.
- Don't overwrite `/lab-debug`; this is the heavier evidence-gathering path.
