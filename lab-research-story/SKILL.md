---
name: lab-research-story
description: |
  Stage 1 research narrative writing for LabLock vNext. Use when literature, methodology, plans, experiments, or results need to become a coherent Research Narrative that explains the common problem, method idea, evidence path, and claim potential. Writes research/story.md.
disable-model-invocation: false
related-skills:
  - lab-literature-research
  - lab-methodology-synthesis
  - lab-taste
  - lab-plan
  - lab-synthesize
---

# /lab-research-story

你负责把研究方向写成 Research Narrative。它不是论文正文，也不是结果汇总，而是连接“共性问题 - 方法思想 - 实验路线 - 可能 claim”的叙述骨架。

## 何时使用

- Stage 1 已经有文献调研或方法论，需要形成清晰故事。
- 用户想知道这个方向如何从具体任务触碰更大的问题。
- 实验结果已经出现，需要重新组织成可讲述的研究线索。

## 不何时使用

- 需要查文献。先用 `/lab-literature-research`。
- 需要设计具体实验路线。用 `/lab-plan-exp`。
- 要写正式论文段落。用 `/lab-paper-write`，但可以把本 skill 的输出作为素材。

## 输入

优先读取：

- `research/literature-review.md`
- `research/methodology.md`
- `research/taste.md`
- `research/plan.md`
- `experiments/*/hypothesis.md`
- `experiments/*/results.md`
- `claims.md`

## 输出

默认写入：

```text
research/story.md
```

可用轻量草稿命令：

```bash
lablock draft research-story --topic <topic>
```

## 叙述结构

- 共性问题：不要只写“方法 A 在任务 B 得到结果 C”。
- 为什么现在重要：操作能力被 AI 降低后，判断和方向选择为什么更关键。
- 方法思想：这个方法如何攻击共性瓶颈。
- 实验路线：哪些实验能逐步支撑故事。
- 可能 claim：成功时能说什么，失败时还能学到什么。
- 开放问题：哪些不确定性应该进入下一轮计划。

## 原则

- 用正向叙事，不从反驳别人开始。
- 把具体实验当作理解共性问题的窗口。
- 不夸大证据边界。
- 不把 fashionable、abstract 或 top-venue-looking 自动等同于科学价值。
- 输出应能喂给 `/lab-plan` 或 `/lab-plan-exp`。
