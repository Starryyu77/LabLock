# LabLock vNext 工作流与 Skill 地图

这份文档记录 LabLock vNext 的重构方向。它目前是规划文档，还不是最终实现规范。

核心变化是：

> LabLock 应该从以 `lock / drift / guardrail` 为中心的实验防偏工具，转向面向 AI Agent 时代的科研工作流控制平面。

vNext 不应该按“一个阶段一个 skill”来设计。用户前面提到的是研究流程中的若干阶段，每个阶段都可能需要多个 skill：探索、评审、移交、监控、解释、迁移、整理，都可能是不同职责。

## 设计原则

1. 研究目标优先。
   系统应该帮助工作持续朝研究问题和目标效果推进，而不是让防御性流程成为主线。

2. Agent 目标优先于变量锁定。
   对 AI Agent 驱动的实验来说，最关键的设计产物不是传统变量锁，而是给 Agent 的目标：总目标、阶段目标、探索空间、产物标准、验证方式和汇报条件。

3. Handoff 是编排机制。
   Handoff 不只是导出一个 prompt。它应该支持把任务交给执行 Agent、把问题交给外部专家、回收外部回复，并把回复转化为下一步行动。

4. 实验监控是一等能力。
   用户应该随时能问：实验总目标是什么？当前阶段目标是什么？现在做到哪了？已有初步结果是什么？下一步该做什么？

5. 破除 AI 防御性膨胀，但不取消基础安全。
   LabLock 应该识别 AI Agent 生成的无关 gate、validator、fallback、抽象层和流程膨胀；但仍保留 destructive git 操作、凭证、隐私、数据删除、不可逆外部副作用等硬安全边界。

6. 保持向后兼容。
   已有 LabLock 仓库和 `scope.lock` 实验不能因为 vNext 而丢失。vNext 迁移应该以增量方式添加新文件，而不是删除旧结构。

## 全局路由入口：`/lab-advice`

vNext 会引入更多阶段和更多 skills，因此必须保留并强化 `/lab-advice`。

`/lab-advice` 的定位不是普通辅助 skill，而是整个 LabLock 的用户入口和路由层。它应该帮助用户回答：

- 我现在处于哪个阶段？
- 我应该用哪个 skill？
- 如果有多个可能 skill，应该先做哪一个？
- 这个 skill 会产出什么文件？
- 做完之后下一步是什么？

设计要求：

- `/lab-advice` 应该按 vNext 阶段路由，而不是只根据旧 skill 名称做关键词匹配。
- 当用户描述模糊时，它应该先判断阶段，再推荐一个主 skill 和最多两个备选。
- 当用户不知道怎么开始时，它应该给出最短可执行路径。
- 当任务不属于 LabLock 范围时，它仍然应该明确说“不适合用 LabLock skill”，避免强行套用。
- 它不应该自动执行有副作用的 skill；它只做路由、解释和下一步建议。

这可以防止 skill 数量变多后用户不知道如何使用。

## 阶段总览

| 阶段 | 名称 | 核心问题 | 主要产物 |
|---|---|---|---|
| 0 | 迁移与兼容 | 旧实验如何在新工作流里继续可读？ | legacy mapping、`objective.md`、`progress.md` |
| 1 | 研究方向形成 | 从 idea 到文献调研、方法论、研究叙述和计划如何形成？ | `research/literature-review.md`、`methodology.md`、`taste.md`、`story.md`、`plan.md` |
| 2 | 实验计划与 Roadmap 设计 | 如何通过交互把研究方向变成清晰、可执行、可验证的分步计划？ | `experiments/<exp>/plan.md`、`roadmap.md`、`objective.md` |
| 3 | Handoff 编排 | 任务或问题交给谁？对方需要什么上下文？回复如何被同一入口回收？ | `handoffs/outgoing/`、`incoming/`、`summaries/` |
| 4 | 实验执行监控 | 现在发生了什么？已经做到什么程度？ | `progress.md`、monitor reports、status summaries |
| 5 | 问题诊断 | 这是 bug、已知问题、环境问题、真实现象，还是方向问题？ | debug logs、research-debug reports、expert handoffs |
| 6 | 结果解释与下一步决策 | 结果意味着什么？下一步该做什么？ | `interpretation.md`、claim updates、synthesis reports |
| 7 | Agent 行为去防御化 | Agent 是否在用防御性机制偏离研究目标？ | deguard/recenter reports |
| 8 | 论文与知识沉淀 | 如何转化为 claim、论文段落或长期知识？ | `paper/`、`claims.md`、`research/story.md` |

## Stage 0：迁移与兼容

目标：已有 LabLock 仓库在升级到 vNext 后，旧实验状态不能丢失。

候选 skills：

| Skill | 状态 | 用途 |
|---|---|---|
| `/lab-vnext-migrate` | 新增 | 把旧实验转换为 vNext 兼容结构，补充 `objective.md` 和 `progress.md`。 |
| `/lab-legacy-audit` | 新增 | 检查旧 `scope.lock`、hypothesis、results、dashboard 数据是否仍可被新系统读取。 |
| `/lab-migrate` | 重构 | 保留旧仓库迁移能力，但为导入的 legacy node 增加 vNext 文件。 |

核心产物：

```text
experiments/<exp>/
  objective.md
  progress.md
reviews/<date>-legacy-audit.md
reviews/<date>-vnext-migration.md
```

兼容规则：

- 不删除 `.lablock/locks/*.scope.lock`。
- 将 `scope.lock` 视为 legacy experiment frame metadata。
- 新的 monitor / dashboard 必须同时读取旧结构和新结构。

## Stage 1：研究方向形成

目标：在实验开始前，帮助用户从一个 idea、模糊想法或已有观察出发，完成文献调研、方法论综合、科研品味判断、研究叙述和初步计划。

候选 skills：

| Skill | 状态 | 用途 |
|---|---|---|
| `/lab-literature-research` | 新增 | 根据用户的 idea、关键词、初步假设或已有实验线索，主动调研相关文献。 |
| `/lab-methodology-synthesis` | 新增 | 基于文献调研结果，并结合开源实现、已有实验、社区讨论和工程约束，形成一套候选创新方法论。 |
| `/lab-taste` | 保留 | 提供科研品味视角：重要性、抽象能力、故事潜力、社会性偏见。 |
| `/lab-research-story` | 保留/重构 | 把方法论和实验动机写成 Research Narrative，而不是只列事实。 |
| `/lab-plan` | 保留/重构 | 把研究方向、方法论和故事转化为可进入实验计划与 Roadmap 设计阶段的初步计划。 |

核心产物：

```text
research/
  literature-review.md
  methodology.md
  direction.md
  taste.md
  story.md
  plan.md
```

设计要点：

- 文献调研应该从用户的 idea 出发，回答“这个想法处在哪条研究脉络里”“已有工作解决了什么”“还缺什么”。
- 方法论综合不应该只是 novelty check，而应该把文献、实现资源、已有实验、社区经验和可行性约束融合成候选方法。
- `/lab-taste` 仍然是 advisory，不是 gate。
- Research Narrative 很重要：同一个实验不能只被写成“方法 A 在任务 B 得到结果 C”，而要说明它触碰的共性问题和方法论意义。
- `/lab-plan` 仍然保留，但它应该接收前面几个产物，形成下一阶段可用的研究计划。
- 输出应该帮助用户判断：这个方向是否值得进入实验计划与 Roadmap 设计阶段，以及应该把什么目标交给 Agent。

## Stage 2：实验计划与 Roadmap 设计

目标：把 Stage 1 形成的研究方向、方法论和研究叙述，转化为一个用户可确认、Agent 可执行、过程可监控的实验计划。

这个阶段本质上仍然是 Plan 功能，但需要针对 AI Agent 实验做优化：

1. 与用户交互，逐步澄清目标、约束、预期产物和可接受的探索范围。
2. 设计一套详细的、一步一步的 Roadmap，让执行 Agent 知道先做什么、后做什么。
3. 进行审查，确保目标清晰、可执行、可验证，并且没有过度防御。

候选 skills：

| Skill | 状态 | 用途 |
|---|---|---|
| `/lab-plan-exp` | 重构 | 作为 Stage 2 的主入口，通过交互把研究方向转成实验计划、阶段目标和执行路线。 |
| `/lab-roadmap` | 新增或作为 `/lab-plan-exp` mode | 把计划拆成详细 Roadmap：阶段、步骤、输入、输出、验证点和汇报点。 |
| `/lab-objective-review` | 新增 | 审查目标是否清晰、可执行、可验证，并且没有过度防御。 |
| `/lab-agent-objective` | 可选新增或作为 plan 输出 | 从计划中提炼 Agent-facing objective，供 handoff 和执行 Agent 使用。 |
| `/lab-exp-init` | 重构 | 接收已确认的 plan / roadmap，创建实验目录结构和初始进度文件。 |

核心产物：

```text
experiments/<exp>-<shortname>/
  plan.md
  roadmap.md
  objective.md
  progress.md
  results.md
  interpretation.md
```

`plan.md` 应该回答：

- 实验总研究目标是什么？
- 当前阶段目标是什么？
- 用户已经确认的目标和约束是什么？
- 实验要验证的核心想法是什么？
- 预期产物是什么？
- 如何判断阶段性成功？
- 哪些内容可以探索，哪些内容不应该变成主线？

`roadmap.md` 应该回答：

- Step 1 / Step 2 / Step 3 分别做什么？
- 每一步的输入是什么？
- 每一步的预期输出是什么？
- 每一步如何验证？
- 哪一步需要用户确认？
- 哪一步可以交给 Agent 自动推进？

`objective.md` 可以作为执行摘要，从 `plan.md` 和 `roadmap.md` 中提炼给 Agent 的目标：

- 当前阶段目标。
- 允许探索范围。
- 预期产物。
- 验证方式。
- 结果写回位置。
- 避免过度防御的提醒。

设计要点：

- Stage 2 不需要变成复杂的新体系。它应该是面向实际使用优化过的 Plan。
- 用户交互是核心：不要直接替用户假定目标、阶段和成功标准。
- Roadmap 要足够具体，能直接进入 handoff；但不要把所有不确定性都变成 gate。
- 审查重点不是“能不能阻止错误”，而是“目标是否清晰、执行路径是否合理、验证是否足够、是否出现 AI 防御性膨胀”。

## Stage 3：Handoff 编排

目标：把 Handoff 变成正式工作流，支持执行、专家咨询、回复回收和下一步综合。

Handoff 应该有两个顶层模式：

1. Execution handoff。
   接收者是执行 Agent，它要完成具体任务。

2. Expert consultation handoff。
   接收者是外部专家、导师、reviewer、社区或外部 AI，它要提供判断、诊断或解决方案。

候选 skills：

| Skill | 状态 | 用途 |
|---|---|---|
| `/lab-handoff` | 重大重构 | 成为统一 handoff 入口，覆盖 execution、expert consultation、incoming response ingestion 和 consultation summary。 |

核心产物：

```text
handoffs/
  outgoing/
  incoming/
  summaries/
experiments/<exp>/progress.md
```

设计决定：

- 不单独设计 `/lab-handoff-ingest`。
- 不单独设计 `/lab-consultation-summarize`。
- 不单独设计 `/lab-execution-handoff` 或 `/lab-expert-handoff`，除非后续实现证明一个统一入口过重。
- incoming 回复回收、专家回复总结、下一步行动提炼，都作为 `/lab-handoff` 的 mode 或 subcommand 处理。

Execution handoff 应该包含：

- 需要保留的研究目标。
- 当前阶段目标。
- source-of-truth 文件。
- 允许改动范围。
- 预期产物。
- 验证命令或证据。
- 结果写回位置。
- 明确说明：除非目标本身需要，否则不要添加宽泛防御性 gate。

Expert consultation handoff 应该包含：

- 我们需要专家判断什么。
- 简短研究背景。
- 当前问题是什么。
- 已收集的证据。
- 候选解释。
- 约束和假设。
- 具体问题列表。
- 希望的输出格式：诊断、下一步、风险、参考资料。

关键区别：

- Execution handoff 是：“请完成这个任务。”
- Expert consultation handoff 是：“请判断这个问题，并给出解决路线。”

## Stage 4：实验执行监控

目标：让用户在实验进行中和结束后都能看清楚进展。

候选 skills：

| Skill | 状态 | 用途 |
|---|---|---|
| `/lab-status` | 新增 | 快速状态回答：总目标、当前目标、进度、初步结果、下一步。 |
| `/lab-monitor` | 新增 | 生成单个实验或整个项目的详细监控报告。 |
| `/lab-progress-digest` | 新增 | 按时间窗口汇总 commits、handoffs、results、logs 和 notes。 |
| `/lab-exp-run` | 保留/重构 | 记录 run intent 和 canonical command，不变成训练调度器。 |

核心产物：

```text
experiments/<exp>/progress.md
reviews/<date>-<exp>-monitor.md
```

`/lab-status` 应该快速、对话式。

`/lab-monitor` 应该更完整，并写入文件。

两者都应该回答：

- 实验总目标是什么？
- 当前阶段目标是什么？
- 已经完成了什么？
- 有哪些初步结果？
- 现在可以得出什么阶段性结论？
- 下一步是什么？

## Stage 5：问题诊断

目标：帮助用户判断实验问题到底是本地 bug、已知上游问题、环境问题、真实现象，还是研究方向本身有问题。

候选 skills：

| Skill | 状态 | 用途 |
|---|---|---|
| `/lab-debug` | 保留/重构 | 本地复现、假设测试、最小目标对齐修复。 |
| `/lab-research-debug` | 保留/重构 | 查论文、文档、issue、论坛、社区，并结合本地代码诊断。 |
| `/lab-handoff --mode=expert-consultation` | `/lab-handoff` mode | 将难以判断的问题升级给外部专家或外部 AI。 |
| `/lab-result-anomaly` | 新增 | 判断异常结果是 bug、噪声，还是可能有研究价值的现象。 |

核心产物：

```text
debug/*.md
reviews/*-research-debug.md
handoffs/outgoing/*expert-consultation.md
```

诊断分类：

- Confirmed local bug。
- Likely local bug。
- Known upstream/library issue。
- Expected phenomenon。
- Environment issue。
- Inconclusive。
- Direction mismatch。

## Stage 6：结果解释与下一步决策

目标：把实验输出转化为解释、claim、下一轮实验选择或 postmortem。

候选 skills：

| Skill | 状态 | 用途 |
|---|---|---|
| `/lab-result-interpret` | 新增 | 对单个实验结果进行目标对齐解释。 |
| `/lab-synthesize` | 保留/重构 | 跨实验综合，并提出 claim delta。 |
| `/lab-claim-update` | 新增 | 把解释转成结构化 `claims.md` 更新 proposal。 |
| `/lab-next-step` | 新增 | 决定继续、fork、咨询、停止或进入写作。 |
| `/lab-postmortem` | 保留/重构 | 记录失败、暂停、killed 或 superseded 实验的经验。 |

核心产物：

```text
experiments/<exp>/interpretation.md
claims.md
reviews/*-synthesis.md
experiments/<exp>/postmortem.md
```

这个阶段应该分清：

- 发生了什么。
- 它意味着什么。
- 它不能证明什么。
- 下一步决策是什么。

## Stage 7：Agent 行为去防御化

目标：识别 AI Agent 是否在添加与实验目标无关的保护性、防御性、流程性机制。

候选 skills：

| Skill | 状态 | 用途 |
|---|---|---|
| `/lab-deguard` | 新增 | 识别并建议移除与目标无关的 gate、validator、retry、fallback layer 和抽象层。 |
| `/lab-objective-recenter` | 新增 | 把当前执行重新拉回研究目标和阶段目标。 |
| `/lab-agent-behavior-review` | 新增 | 审查 Agent 行为到底是在服务任务，还是在做流程膨胀。 |
| `/lab-guard` | legacy/重构 | 保留为 drift helper，但不再作为主线工作流。 |

核心产物：

```text
reviews/*-deguard.md
reviews/*-recenter.md
```

边界：

- 应该移除：与研究目标无关的防御性膨胀。
- 不应该移除：destructive git 操作、secrets、privacy、数据删除、不可逆操作、用户可见外部副作用相关的硬安全。

去防御化的核心问题：

> 这个机制是否直接帮助达成当前研究目标？还是 AI 生成的流程膨胀？

## Stage 8：论文与知识沉淀

目标：把研究过程和结果转化为论文段落、长期 claim 和可复用知识。

候选 skills：

| Skill | 状态 | 用途 |
|---|---|---|
| `/lab-paper-init` | 保留/重构 | 从当前 research story 和 claim snapshot 创建 paper workspace。 |
| `/lab-paper-write` | 保留/重构 | 只基于有证据的 claim 写论文段落。 |
| `/lab-paper-audit` | 保留/重构 | 检查 paper claim 是否有 evidence。 |
| `/lab-research-story` | 新增 | 维护连接研究方向、实验和 claim 的研究故事。 |
| `/lab-knowledge-capture` | 新增 | 沉淀长期经验、可复用方法和失败模式。 |

核心产物：

```text
paper/
  outline.md
  drafts/
  claims-to-evidence.md
research/story.md
claims.md
```

## 现有 Skill 处理策略

| Existing Skill | vNext 处理 |
|---|---|
| `/lab-advice` | 保留并强化为全局路由入口，按 vNext 阶段推荐 skill，防止用户被过多 skill 淹没。 |
| `/lab-init` | 重构为初始化 vNext 目录和模板。 |
| `/lab-migrate` | 重构以支持 vNext 兼容。 |
| `/lab-plan` | 重构为早期研究方向规划。 |
| `/lab-plan-exp` | 重构为交互式实验计划、Roadmap 和目标审查入口。 |
| `/lab-exp-init` | 重构为创建 objective / progress / interpretation 等新产物。 |
| `/lab-exp-run` | 保留，但限制为 run intent 和 progress 记录。 |
| `/lab-dashboard` | 保留为 legacy/optional 可视化工具，但不作为 vNext Stage 4 的核心监控入口。 |
| `/lab-debug` | 保留/重构，继续负责本地、证据驱动的 debugging。 |
| `/lab-research-debug` | 保留/重构，作为问题诊断阶段的一部分。 |
| `/lab-handoff` | 重大重构，成为支持 execution 和 expert consultation 的编排入口。 |
| `/lab-taste` | 保留，作为研究方向和异常结果意义判断视角。 |
| `/lab-review` | 重构为 objective / design / research-story review modes。 |
| `/lab-autoplan` | 重构或替换为按阶段组合的 review bundles。 |
| `/lab-guard` | 降级为 legacy drift helper。 |
| `/lab-fork` | 降级或重构为 next-step decision flow 的一部分。 |
| `/lab-synthesize` | 保留/重构，用于 claim synthesis 和 interpretation。 |
| `/lab-paper-*` | 保留/重构，围绕 story 和 claim evidence。 |
| `/lab-tidy` | 保留为 repo hygiene，不作为研究主线。 |
| `/lab-audit` | 重构为 workflow health 和 artifact coverage audit。 |

## 建议的第一批实现

第一批实现不要一次性重写所有旧 skill。应该先建立新骨架。

建议第一批：

1. 增加 vNext architecture docs。
2. 增加模板：
   - `objective.md.tmpl`
   - `progress.md.tmpl`
   - `interpretation.md.tmpl`
   - `monitor.md.tmpl`
   - `deguard.md.tmpl`
3. 新增或草拟核心 skills：
   - `/lab-advice` vNext 阶段路由
   - `/lab-plan-exp` vNext 版本
   - `/lab-roadmap`
   - `/lab-monitor`
   - `/lab-deguard`
4. 重构 `/lab-handoff` 设计文档，支持：
   - execution handoff
   - expert consultation handoff
   - incoming response ingestion
   - consultation summary
5. 先设计 `lablock vnext-migrate --dry-run`，再考虑写入式迁移。

## 待决问题

1. `/lab-status` 和 `/lab-monitor` 应该是两个 skill，还是一个 skill 的 fast / verbose mode？
2. 新实验是否还默认生成 `scope.lock`，还是只在 legacy-compatible 项目中生成？
3. `objective.md` 是否替代 `hypothesis.md`，还是两者保留不同语义？
4. `lab-vnext-migrate` 应该默认只写 migration plan，还是可以直接 apply？

## 当前工作假设

vNext 应该以增量方式引入：

- 保持现有仓库可用。
- 添加新产物，而不是删除旧产物。
- 新 skill 同时读取旧结构和新结构。
- 在用户可见流程中弱化 lock / drift 语言。
- 在真实迁移项目证明新工作流稳定之前，不删除旧命令。
