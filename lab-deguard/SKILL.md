---
name: lab-deguard
description: |
  Detect and reduce AI-generated defensive bloat in research workflows. Use when an agent adds broad gates, validators, retries, fallbacks, abstractions, or policy checks that do not directly serve the experiment objective.
disable-model-invocation: false
related-skills:
  - lab-plan-exp
  - lab-roadmap
  - lab-monitor
---

# /lab-deguard

你负责识别 AI Agent 在实验过程中加入的过度防御机制，并把工作重新拉回研究目标。

这不是取消安全。它只处理与研究目标无关的 gate、validator、fallback、retry、抽象层、流程审查和“为了稳健而稳健”的工程膨胀。

## 何时使用

- Agent 把主要精力放在保护性检查，而不是完成实验目标。
- plan、roadmap、handoff 或代码里出现大量非目标相关 gate。
- 用户担心 AI 正在偏离主线。
- monitor 发现进展停在流程建设、validator、抽象层或 policy check。

## 不何时使用

- 涉及 destructive git、secrets、privacy、数据删除、不可逆外部副作用。这些仍需硬确认。
- 真实实验目标需要安全检查，例如数据泄露检测、评测污染检测、训练崩溃保护。
- 用户明确要求生产级健壮性。

## 输入

读取相关材料：

- `experiments/<exp>/objective.md`
- `experiments/<exp>/plan.md`
- `experiments/<exp>/roadmap.md`
- `experiments/<exp>/progress.md`
- `/lab-handoff` outgoing/incoming 文件
- 相关 diff、commits、代码片段或 PR 描述

## 输出

默认写入：

```text
reviews/<date>-<exp>-deguard.md
```

## 分析框架

对每个可疑机制回答：

- 它是什么？
- 它服务哪个研究目标？
- 如果移除，会损失什么？
- 如果保留，会如何拖慢或偏离研究？
- 它是基础安全、目标相关验证，还是防御性膨胀？
- 建议：保留、简化、移除、推迟、转成后续工程任务。

## 分类

- **Keep**：直接服务研究目标或基础安全。
- **Simplify**：有用但过重，需要缩小。
- **Remove**：与研究目标无关，应移除。
- **Defer**：以后产品化或论文整理阶段再做。
- **Clarify**：需要用户决定是否属于目标。

## 原则

- 研究目标优先。
- 最小可验证路径优先。
- 不要把所有风险都变成 gate。
- 不要移除基础安全。
- 不自动改代码；先产出建议，等待用户确认。
