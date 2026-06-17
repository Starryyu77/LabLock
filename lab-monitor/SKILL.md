---
name: lab-monitor
description: |
  Report experiment progress from objective, roadmap, progress notes, handoffs, results, logs, and commits. Use for "status", "monitor", "现在做到哪了", "进展如何", or "阶段性结论". Writes monitor reports when useful.
disable-model-invocation: false
related-skills:
  - lab-roadmap
  - lab-handoff
  - lab-deguard
---

# /lab-monitor

你负责让用户随时看清楚实验进展。重点不是生成看板，而是回答：总目标是什么、当前阶段目标是什么、现在完成了什么、初步结果是什么、下一步是什么。

## 何时使用

- 用户问“现在进展如何”“做到哪了”“有什么初步结论”。
- Agent 执行中，需要阶段性汇报。
- Handoff 返回后，需要把结果挂接到实验进展。
- 实验结束前，需要确认是否继续、暂停、咨询或进入解释阶段。

## 不何时使用

- 需要图形化看板。旧 `/lab-dashboard` 仍可作为 legacy/optional 工具，但不是 vNext 监控主线。
- 需要设计实验计划。用 `/lab-plan-exp` 或 `/lab-roadmap`。
- 需要查论文/社区诊断问题。用 `/lab-research-debug`。

## 读取范围

按轻到重读取：

1. `experiments/<exp>/objective.md`
2. `experiments/<exp>/plan.md`
3. `experiments/<exp>/roadmap.md`
4. `experiments/<exp>/progress.md`
5. `experiments/<exp>/results.md`
6. `handoffs/outgoing/` 和 `handoffs/incoming/`
7. `reviews/*monitor*.md`、`reviews/*research-debug*.md`
8. 最近 commits 和相关 logs
9. legacy `hypothesis.md`、`scope.lock`、`changes.log`

缺失信息写 `unknown`，不要猜。

## 输出

快速回答可以直接在对话里给出。

需要沉淀时写入：

```text
reviews/<date>-<exp>-monitor.md
```

## 报告必须回答

- 实验总目标
- 当前阶段目标
- 当前阶段完成度
- 已完成动作
- 初步结果或观察
- 当前结论边界
- 阻塞点
- 下一步建议
- 是否需要 handoff、deguard、debug、research-debug 或 postmortem

## 判断标准

- 进度不是“改了多少文件”，而是相对 Roadmap 和研究目标推进了多少。
- 初步结论必须区分事实、解释和猜测。
- 如果发现 Agent 把防御性机制变成主线，建议 `/lab-deguard`。
- 如果发现目标不清楚，建议回到 `/lab-plan-exp` 或 `/lab-roadmap`。

## 不要

- 不要把 `/lab-dashboard` 作为默认路径。
- 不要为了显得完整而读全仓库。
- 不要把没有证据的结果写成结论。
- 不要自动修改实验文件；先报告，再等用户确认。
