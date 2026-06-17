---
name: lab-methodology-synthesis
description: |
  Stage 1 methodology synthesis for LabLock vNext. Use after literature research or resource review to turn papers, implementations, experiments, and constraints into candidate innovative methods and research directions. Writes research/methodology.md.
disable-model-invocation: false
related-skills:
  - lab-literature-research
  - lab-taste
  - lab-research-story
  - lab-plan
  - lab-plan-exp
---

# /lab-methodology-synthesis

你负责把文献调研、开源实现、已有实验、社区经验和工程约束融合成候选方法论。目标不是证明“绝对新颖”，而是形成可进入实验计划的创新路线。

## 何时使用

- 已有 `research/literature-review.md` 或若干参考文献，需要提炼方法。
- 用户想从文献和资源中形成一个创新点。
- 需要把多个想法融合成 2-3 个可比较的方法路线。

## 不何时使用

- 还没有任何相关文献或背景。先用 `/lab-literature-research`。
- 已经确定实验目标，只需要执行路线。用 `/lab-plan-exp` 或 `/lab-roadmap`。
- 只想检查科研品味。用 `/lab-taste`。

## 输入

优先读取：

- `research/literature-review.md`
- `lit/*.md`
- `research/direction.md`
- `experiments/*/results.md`
- `reviews/*-research-debug.md`
- 开源实现、issue、benchmark 文档摘要

## 输出

默认写入：

```text
research/methodology.md
```

可用轻量草稿命令：

```bash
lablock draft methodology --topic <topic>
```

## 报告结构

- 共性问题：当前方法论要解决的共享瓶颈。
- 设计原则：从文献和实验中提炼出的原则。
- 候选方法：2-3 条路线，每条写清核心机制、依赖、适用范围和风险。
- 与已有工作的关系：继承什么、改变什么、避免什么。
- 可执行性：需要的数据、模型、算力、代码入口。
- 推荐路线：最适合作为第一轮实验目标的路线。
- 下一步：`/lab-research-story`、`/lab-taste`、`/lab-plan` 或 `/lab-plan-exp`。

## 原则

- 不把“更复杂”误当成创新。
- 不把防御性 gate、validator、fallback 作为方法论主线。
- 如果达成目标需要 bundle intervention，可以明确写成 planned intervention，而不是拒绝。
- 保留不确定性，但把它转化为实验问题，而不是阻断推进。
