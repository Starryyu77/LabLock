---
name: lab-roadmap
description: |
  Build a step-by-step AI-agent experiment roadmap from an approved plan. Use for "roadmap", "分步骤路线图", "执行路线", or when an experiment plan needs stage goals, inputs, outputs, validation points, and user checkpoints.
disable-model-invocation: false
related-skills:
  - lab-plan-exp
  - lab-handoff
  - lab-monitor
---

# /lab-roadmap

你负责把已经确认的实验计划拆成可执行 Roadmap。这个 skill 不负责重新选择研究方向，也不负责直接写实验代码。它的价值是让后续 Agent 知道先做什么、后做什么、每一步如何验证、什么时候需要回到用户。

## 何时使用

- `/lab-plan-exp` 已经形成实验计划，但还不够具体，无法直接交给 Agent。
- 用户说“帮我拆步骤”“给我 Roadmap”“我要让 Agent 执行这个实验”。
- Handoff 前需要把任务拆成明确阶段。

## 不何时使用

- 研究方向还没确定。先用 `/lab-plan` 或 Stage 1 skills。
- 用户只需要快速状态。用 `/lab-monitor` 或后续 `/lab-status`。
- 用户要另一个 Agent 写代码。先产出 Roadmap，再用 `/lab-handoff --mode=execution`。

## 输入

优先读取：

- `plans/<topic>.md`
- `experiments/<exp>/plan.md`
- `experiments/<exp>/objective.md`
- `docs/vnext-workflow-skill-map.md` 中 Stage 2 约束

如果没有文件，先向用户确认：

- 总研究目标
- 当前阶段目标
- 预期产物
- 可探索范围
- 关键验证方式
- 哪些步骤需要用户确认

## 输出

默认写入：

```text
experiments/<exp>/roadmap.md
```

如果实验目录还不存在，写入：

```text
plans/<date>-<topic>-roadmap.md
```

可用轻量草稿命令：

```bash
lablock draft roadmap --exp <exp-id> --topic <topic>
```

## Roadmap 结构

每一步都必须包含：

- Step 名称
- 目标
- 输入
- 需要做的动作
- 预期输出
- 验证方式
- 是否需要用户确认
- 是否适合自动 handoff 给 Agent
- 风险或不确定性

## 原则

- Roadmap 要具体到能进入 `/lab-handoff --mode=execution`。
- 不要把每个不确定性都变成 gate。
- 不要把防御性检查当成研究主线。
- 如果某一步只是为了“看起来稳健”，标记给 `/lab-deguard`。

## 下一步

- 如果 Roadmap 清楚：用 `/lab-handoff --mode=execution`。
- 如果目标不清楚：回到 `/lab-plan-exp`。
- 如果过度防御：用 `/lab-deguard`。
- 如果需要持续查看进度：用 `/lab-monitor`。
