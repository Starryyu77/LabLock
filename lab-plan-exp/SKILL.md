---
name: lab-plan-exp
description: |
  vNext interactive experiment planning. Use when a research direction should become a clear, executable, verifiable plan with stage goals, roadmap, deliverables, success criteria, and anti-defensive-bloat review. Writes plans/.
disable-model-invocation: false
related-skills:
  - lab-plan
  - lab-roadmap
  - lab-deguard
  - lab-handoff
  - lab-exp-init
---

# /lab-plan-exp

你负责把 Stage 1 形成的研究方向、方法论和研究叙述，转化为一个用户可确认、Agent 可执行、过程可监控的实验计划。

这个 skill 的重点不再是传统的 IV/control 表格，也不是立刻生成 `scope.lock`。它是一个面向实际使用优化过的 Plan 功能：

1. 与用户交互，逐步澄清目标、约束、预期产物和可接受的探索范围。
2. 设计一步一步的 Roadmap，让执行 Agent 知道先做什么、后做什么。
3. 审查目标是否清晰、可执行、可验证，并且没有过度防御。

## 何时使用

- 用户已经有研究方向，但还不知道如何交给 Agent 执行。
- Stage 1 已经产出 `research/literature-review.md`、`methodology.md`、`story.md` 或 `plan.md`。
- 用户说“帮我设计实验计划”“把这个目标拆成可执行路线”“我想让 Agent 做这个实验”。
- 旧式单实验设计也可以使用本 skill，但输出应优先包含 plan / roadmap / objective。

## 不何时使用

- idea 还很模糊，缺少研究方向。先用 `/lab-plan` 或 Stage 1 skills。
- 只是要创建实验文件。用 `/lab-exp-init`，但应先确认 plan。
- 已有 plan 只需要拆步骤。用 `/lab-roadmap`。
- 用户要执行代码。先完成 plan/roadmap，再用 `/lab-handoff --mode=execution`。

## 输入

优先读取：

- `research/direction.md`
- `research/literature-review.md`
- `research/methodology.md`
- `research/story.md`
- `research/plan.md`
- existing `plans/*.md`
- related `experiments/<exp>/results.md` or `interpretation.md`

如果没有文件，直接和用户交互收集：

- 研究目标
- 当前阶段目标
- 已有依据
- 预期产物
- 可接受探索范围
- 约束和资源
- 验证方式

## Step 1: 用户交互澄清

必须先问清楚：

- 这个实验服务的总研究目标是什么？
- 当前阶段最想得到什么结果或信息？
- Agent 最终应该交付什么？
- 哪些路径可以探索？
- 哪些内容不应该变成主线？
- 哪些结果算阶段性成功？
- 哪些情况需要停下来问用户？

不要直接替用户假定目标、阶段和成功标准。

## Step 2: 计划草案

把用户回答整理成 `plan.md` 结构：

```markdown
# Experiment Plan: <topic>

## Total Research Goal
<研究总目标>

## Current Stage Goal
<当前阶段目标>

## Confirmed User Intent
- <用户明确确认的目标和约束>

## Core Idea To Test
<这个实验要验证的核心想法>

## Expected Deliverables
- <产物 1>
- <产物 2>

## Exploration Space
### Allowed
- <可以探索的路径>

### Should Not Become Mainline
- <不应该变成主线的内容>

## Success Criteria
- <可验证的阶段性成功标准>

## Stop And Report Conditions
- <需要暂停并汇报的情况>
```

## Step 3: Roadmap 草案

如果计划足够清楚，继续起草 Roadmap。也可以建议用户单独运行 `/lab-roadmap`。

Roadmap 至少包含 3 类信息：

- 阶段和步骤
- 每一步的输入、动作、输出
- 每一步的验证点和用户确认点

不要把所有不确定性都变成 gate。只保留能直接服务研究目标的验证点。

## Step 4: Objective 摘要

从 plan 和 roadmap 中提炼一个 Agent-facing objective：

- 当前阶段目标
- 允许探索范围
- 预期产物
- 验证方式
- 结果写回位置
- 避免过度防御的提醒

这个 `objective.md` 是给 `/lab-handoff --mode=execution` 使用的执行摘要，不一定替代旧 `hypothesis.md`。

## Step 5: 目标审查

审查以下问题：

- 目标是否清晰？
- 执行路径是否具体？
- 验证方式是否足够？
- 结果写回位置是否明确？
- 是否出现无关的 gate、validator、fallback、retry、抽象层？
- 是否保留了基础安全边界？

如果发现过度防御，建议 `/lab-deguard`。

## 输出位置

如果实验目录不存在，写入：

```text
plans/<date>-<topic>-vnext-plan.md
```

如果实验目录已存在，建议写入：

```text
experiments/<exp>/plan.md
experiments/<exp>/roadmap.md
experiments/<exp>/objective.md
```

## 下一步

- Roadmap 不够细：`/lab-roadmap`
- 计划可执行：`/lab-handoff --mode=execution`
- 需要创建实验目录：`/lab-exp-init`
- 发现防御性膨胀：`/lab-deguard`
- 需要监控执行：`/lab-monitor`

## 不要

- 不要把本 skill 变成写代码 skill。
- 不要直接生成 `scope.lock`；旧兼容仍由 `/lab-exp-init` 处理。
- 不要为了显得安全而加入宽泛 gate。
- 不要隐藏关键不确定性；把它写成 Roadmap 中的验证点或用户确认点。
