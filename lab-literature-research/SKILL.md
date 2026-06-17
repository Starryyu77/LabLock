---
name: lab-literature-research
description: |
  Stage 1 literature research for LabLock vNext. Use when a research idea, keyword, anomaly, or early hypothesis needs related papers, research lineages, missing gaps, and positioning before experiment design. Writes research/literature-review.md or lit/.
disable-model-invocation: false
related-skills:
  - lab-methodology-synthesis
  - lab-taste
  - lab-research-story
  - lab-plan
---

# /lab-literature-research

你负责把一个早期 idea、关键词、观察或初步假设放进已有研究脉络中。目标不是做论文列表，而是回答：这个想法属于哪条问题线？已有工作解决了什么？还缺什么？哪些参考真正影响下一步实验目标？

## 何时使用

- 用户提出一个研究想法，但还不知道相关文献和研究脉络。
- 用户有异常实验结果，想判断是否已有类似现象。
- Stage 1 需要先形成 `research/literature-review.md`，再进入方法论综合或计划。

## 不何时使用

- 已经有明确方法和实验目标，只缺执行路线。用 `/lab-plan-exp` 或 `/lab-roadmap`。
- 需要本地代码诊断和社区 issue 搜索。用 `/lab-research-debug`。
- 只是要判断一个方向的品味或故事潜力。用 `/lab-taste`。

## 输入

优先读取：

- 用户 idea、关键词、初步假设或异常结果描述
- `PROJECT.md`
- `research/direction.md`
- `research/plan.md`
- `lit/papers.md`
- 相关 `experiments/<exp>/results.md`

如果需要联网检索，先说明检索范围：论文、综述、开源实现、作者项目页、benchmark 文档。不要把未经核实的引用写成确定事实。

## 输出

默认写入：

```text
research/literature-review.md
```

也可以按主题写入：

```text
lit/<date>-<topic>-literature-review.md
```

可用轻量草稿命令：

```bash
lablock draft literature-review --topic <topic>
```

## 报告结构

- 研究问题脉络：这个 idea 属于哪类共性问题。
- 关键文献簇：每个簇解决什么、没有解决什么。
- 方法线索：哪些方法可能启发当前项目。
- 数据集 / benchmark / 实现线索：只列与目标相关的资源。
- 缺口与机会：哪些缺口可能转化为创新点。
- 下一步：进入 `/lab-methodology-synthesis`、`/lab-taste` 或 `/lab-plan`。

## 原则

- 优先解释研究脉络，不堆 citation。
- 明确区分已验证事实、作者 claim、你的推断。
- 不把 novelty check 变成 gate；只提供方向选择证据。
- 不要求用户先有完美 hypothesis。Stage 1 的任务就是帮助形成它。
