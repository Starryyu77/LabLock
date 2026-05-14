# LabLock Skills Reference

这份文档说明 LabLock 每个 skill 的作用、适用场景、边界和典型下一步。

LabLock skills 分两类：

- **用户显式调用**：`disable-model-invocation: true`。这些 skill 会初始化项目、创建实验、改 Git 状态、更新安装、打 tag、开 PR，必须由用户明确要求。
- **分析/写作型**：`disable-model-invocation: false`。这些 skill 主要读取仓库、写计划/报告/审计文档，可以由 AI 在合适场景建议使用。

使用原则：

- 新项目用 `/lab-init`，旧项目用 `/lab-migrate`。
- 实验开始前先设计，再创建 `scope.lock` 作为研究目标和实验 frame。
- scope drift 默认是研究对齐提醒，不是本地硬阻断；需要分类时走 `/lab-guard`、`/lab-fork` 或 `lablock override`。
- 论文写作只基于 `claims.md` 和 evidence，不让 paper claim 脱离实验。

## 快速选择表

| 目标 | 应使用 |
|---|---|
| 不知道该用哪个 LabLock skill | `/lab-advice` |
| 打开、刷新或填充图形实验看板 | `/lab-dashboard` |
| 新科研仓库接入 LabLock | `/lab-init` |
| 已有科研仓库非破坏性接入 | `/lab-migrate` |
| 更新本机安装的 LabLock | `/lab-update` |
| 模糊研究想法变成计划 | `/lab-plan` |
| 单个实验设计 | `/lab-plan-exp` |
| 审计划/实验设计 | `/lab-review` |
| 四种视角完整压力测试 | `/lab-autoplan` |
| 科研品味/方向选择/故事潜力视角 | `/lab-taste` |
| 创建实验目录和 `scope.lock` | `/lab-exp-init` |
| 明确需要 Git 实验分支 | `/lab-exp-start` |
| 启动训练/实验运行 | `/lab-exp-run` |
| commit 出现 SCOPE-DRIFT warning | `/lab-guard` |
| drift 应该变成新实验 | `/lab-fork` |
| debug 时保持目标对齐和最小验证 | `/lab-debug` |
| 实验问题需要查论文/社区并结合代码诊断 | `/lab-research-debug` |
| 打包上下文或实验实现提示词给外部 AI/队友 | `/lab-handoff` |
| 多实验结果综合成 claims | `/lab-synthesize` |
| 实验失败/被 kill 后复盘 | `/lab-postmortem` |
| 更新 formalism/loss/algorithm | `/lab-formalism-update` |
| 初始化 paper 写作目录 | `/lab-paper-init` |
| 写 paper section | `/lab-paper-write` |
| 审 paper claim 是否有证据 | `/lab-paper-audit` |
| 实验结束 | `/lab-exp-finalize` |
| 成功实验整理干净 PR | `/lab-cleanup-pr` |
| 仓库清理/归档候选 | `/lab-tidy` |
| 项目健康检查/weekly audit | `/lab-audit` |

## 项目与安装

### `/lab-advice`

**作用**：当用户不知道应该使用哪个 LabLock skill 时，做只读路由建议。

**何时使用**：

- 用户问“我该用哪个 skill？”。
- 当前任务描述比较模糊，不确定是 init、migrate、plan、debug、audit 还是 paper。
- 你怀疑没有合适的 LabLock skill，需要一个明确的 no-match 判断。

**不要何时使用**：

- 已经明确知道目标 skill，例如用户直接说 `/lab-exp-init`。
- 需要直接执行有副作用的动作。`/lab-advice` 只推荐，不初始化、不提交、不改文件。
- 普通 coding、天气、新闻、通用文档编辑等明显不属于 LabLock workflow 的任务。

**会做什么**：

- 读取用户最新请求。
- 必要时轻量检查 `.lablock/config.yaml`、`PROJECT.md`、`git status`。
- 给出一个最合适的 `/lab-*` skill。
- 如果请求含混，列出 2-3 个候选 skill 并问一个澄清问题。
- 如果不属于 LabLock 范围，返回“没有合适的 LabLock skill”。

**主要输出**：

- 推荐 skill。
- confidence。
- 推荐理由。
- 可复制的下一步 prompt。

**下一步**：

- 用户确认后调用推荐的 skill。
- 如果 no match，走普通 AI/CLI 工作流，而不是强行套 LabLock。
- 如果是“让 AI 写当前实验代码/脚本”，推荐 `/lab-handoff --type=implementation`，生成给 coding agent 的约束提示词。

### `/lab-init`

**作用**：初始化一个全新的 LabLock 科研项目。

**何时使用**：

- 新仓库第一次接入 LabLock。
- 仓库还没有 `.lablock/config.yaml`。
- 你想一次性生成 LabLock 项目骨架、hooks、CI、`CLAUDE.md` / `AGENTS.md` 注入说明。

**不要何时使用**：

- 仓库已经有大量旧实验、旧脚本、旧结果，且还没做迁移盘点。用 `/lab-migrate`。
- `.lablock/` 已经存在。用 `/lab-audit` 或 `/lab-tidy`。

**会做什么**：

- 创建 `.lablock/` 配置、locks、changes、state。
- 创建 `.lablock/naming.yaml`、`.lablock/variables.yaml`、`.lablock/matrices.yaml`，并记录 minimal / paper-aligned / matrix-first 命名 profile。
- 创建 `PROJECT.md`、`formalism.md`、`claims.md`、`INDEX.md`、`MAP.md`。
- 创建 `experiments/`、`decisions/`、`reviews/`、`handoffs/`、`paper/` 等目录。
- 安装 git hooks。
- 写 GitHub Actions workflow。
- 注入 LabLock 使用说明到 `CLAUDE.md` 和 `AGENTS.md`。

**主要输出**：

- LabLock 项目骨架。
- `.lablock/config.yaml`。
- hooks 和 CI。

**下一步**：

- `/lab-plan` 规划方向。
- `/lab-plan-exp` 设计第一个实验。
- `/lab-exp-init` 创建第一个受控实验。

### `/lab-dashboard`

**作用**：打开、刷新或填充图形实验看板。

**何时使用**：

- 用户想看当前仓库的实验看板。
- 用户想把一个新实验或子实验加入看板。
- 用户想用图形方式理解多个实验线的规划、进度和下一步。

**不要何时使用**：

- 仓库还没有接入 LabLock。新仓库用 `/lab-init`，旧仓库用 `/lab-migrate`。
- 用户只有模糊想法，还没形成具体实验。先用 `/lab-plan-exp`。
- 想直接改生成后的 HTML。看板是派生物，应从实验文件刷新。

**会做什么**：

- 运行 `lablock dashboard --json` 读取当前实验状态。
- 运行 `lablock dashboard --open` 生成并打开 `.lablock/dashboard/index.html`。
- 当用户要添加新实验时，收集缺失字段并运行 `lablock exp-init` 创建真实 experiment node。
- 当用户要把旧 plan、旧 run、旧结果加入看板时，转到 `/lab-migrate` 或运行 `lablock migrate-node` 创建 mirror node。
- 创建后重新生成看板。

**主要输出**：

- `.lablock/dashboard/data.json`。
- `.lablock/dashboard/index.html`。
- 必要时新增 `experiments/<exp>-<shortname>/` 和 `.lablock/locks/<exp>.scope.lock`。

**下一步**：

- 审阅看板。
- 提交新实验节点。
- 默认在实验文件夹内继续；需要 Git 历史隔离时再用 `/lab-exp-start`。

### `/lab-migrate`

**作用**：把已有科研仓库非破坏性接入 LabLock。

**何时使用**：

- 仓库已经有自己的 `scripts/`、`configs/`、`runs/`、`outputs/`、`notes/`、`paper/`。
- 你不想破坏旧结构，只想从现在开始让未来实验可审计。
- 你需要先知道哪些东西是旧实验、当前活跃实验、artifact、shared code。
- 你希望旧 plan / run / result 能出现在 LabLock dashboard、audit、synthesis 或 paper workflow 里。

**不要何时使用**：

- 新空仓库。用 `/lab-init`。
- 已经初始化 LabLock 后做常规健康检查。用 `/lab-audit`。

**会做什么**：

- 只读盘点仓库结构、git history、旧实验资产和风险面。
- 把材料分成 `control-plane`、`shared-code`、`legacy-experiment`、`active-experiment-candidate`、`artifact`、`unknown`。
- 写迁移计划和 Legacy Experiment Import Table。
- 只有用户明确同意后，才用 `warn-only` 初始化 LabLock。
- 只有用户明确同意后，才用 `lablock migrate-node` 把选中的旧计划/旧实验/旧 run 导入为 LabLock mirror node。
- 推荐只导入会被 dashboard/audit 使用的旧材料，再锁一个当前活跃实验。

**主要输出**：

- `reviews/migration-YYYY-MM-DD.md` 或 `LABLOCK_MIGRATION_PLAN.md`。
- 必要时新增 `experiments/<exp>-<shortname>/` 和 `.lablock/locks/<exp>.scope.lock`。

**下一步**：

- 审阅迁移计划。
- 同意后初始化 LabLock。
- 确认导入的低置信度 legacy nodes。
- 用 `/lab-exp-init` 创建或细化第一个强约束 active experiment 的 `scope.lock`。

### `/lab-update`

**作用**：升级本机安装的 LabLock。

**何时使用**：

- LabLock GitHub 仓库有新版本。
- 本机的 Claude/Codex `lab-*` skills 需要刷新。
- 用户希望像软件更新一样一键升级，而不是手动 clone/pull。

**不要何时使用**：

- 你想更新当前科研项目内容。`/lab-update` 更新的是 LabLock 工具本身，不是项目实验文件。
- 你只想做项目健康检查。用 `/lab-audit`。

**会做什么**：

- 运行 `lablock update`。
- 可选 `--ref`：先 fetch/switch 到用户明确指定的 preview branch、tag 或 commit。
- 在 canonical source 中 `git pull --ff-only`。
- 运行 `bun install`。
- 刷新 `~/.claude/skills/lab-*` 和 `~/.agents/skills/lab-*`。

**主要输出**：

- 更新后的 source path。
- 每个 skill target 的刷新结果。

**下一步**：

- `lablock doctor` 验证安装。
- 在项目中继续使用其他 `/lab-*` skills。

## 计划与评审

### `/lab-plan`

**作用**：把模糊研究想法变成可证伪研究计划。

**何时使用**：

- 用户只有一个方向，例如“想研究长上下文”“想试 contrastive loss”。
- 还没有明确 hypothesis、metric、baseline、实验成本。
- 需要有人指出隐藏前提和替代 framing。

**不要何时使用**：

- 已经有单个明确实验，缺的是 IV/DV/control/metric。用 `/lab-plan-exp`。
- 只是想初始化文件。用 `/lab-init` 或 `/lab-migrate`。

**会做什么**：

- 重述真实研究问题。
- 找隐藏前提。
- 写 2-4 个可证伪 hypothesis。
- 给出实现备选、成本、风险和信息价值。
- 推荐最窄、最高信息价值的 wedge。

**主要输出**：

- `plans/YYYY-MM-DD-<topic>.md`。

**下一步**：

- `/lab-review` 审计划。
- `/lab-plan-exp` 设计第一个实验。

### `/lab-plan-exp`

**作用**：设计一个具体实验。

**何时使用**：

- 已经知道要测试哪个 hypothesis。
- 需要明确 independent variable、dependent variable、controls、metrics、kill/success criteria。
- 准备创建 `scope.lock` 前，需要先把实验设计写清楚。

**不要何时使用**：

- 研究问题仍很模糊。先用 `/lab-plan`。
- 已经确定设计并要写文件。用 `/lab-exp-init`。

**会做什么**：

- 确定 IV、DV、control variables。
- 询问用户是否已有变量命名；没有则提出 canonical variable、short token 和 paper label 方案。
- 选择或提出实验 matrix，并给出 registry delta。
- 确定 baseline 和 evaluation metrics。
- 写 H0/H1 下的预期结果。
- 设定 compute/time budget、kill criteria、success criteria。

**主要输出**：

- `plans/` 下的实验设计草案。

**下一步**：

- `/lab-review --as=feasibility` 或 `/lab-autoplan`。
- `/lab-exp-init` 创建实验文件和 `scope.lock`。

### `/lab-review`

**作用**：从指定视角审一个 plan 或 experiment design。

**何时使用**：

- 你已经有 `plans/*.md` 或 `experiments/*/hypothesis.md`。
- 你想知道计划是否值得做、是否会被 reviewer 打、资源是否够、是否有 novelty。

**模式**：

- `advisor`：大方向、价值、为什么现在做。
- `reviewer2`：顶会审稿式攻击 novelty、baseline、ablation、claim strength。
- `feasibility`：算 compute/data/time/code/person resource。
- `novelty`：基于 `lit/` 检查相关工作和定位。

**不要何时使用**：

- 还没有任何 plan 文件。先用 `/lab-plan`。
- 想一次跑四种视角。用 `/lab-autoplan`。

**主要输出**：

- `reviews/YYYY-MM-DD-<target>-<mode>.md`。

**下一步**：

- 根据 review 修改 plan。
- `/lab-plan-exp` 或 `/lab-exp-init`。

### `/lab-autoplan`

**作用**：对同一个计划一次性跑 advisor、reviewer2、feasibility、novelty 四种 review。

**何时使用**：

- 准备投入较多时间/GPU 前。
- 需要完整 alignment / risk note。
- 你想把多个 review 结果合成一个 dashboard。

**不要何时使用**：

- 只想快速检查一个点。用 `/lab-review --as=<mode>`。
- 计划还没成文。先用 `/lab-plan`。

**会做什么**：

- 生成四份 mode-specific review。
- 汇总成一个 dashboard。
- 给出 ON-TRACK / NEEDS-FOCUS / HIGH-RISK alignment note 和下一步动作。

**主要输出**：

- `reviews/YYYY-MM-DD-<target>-autoplan.md`。
- 四份具体 review 报告。

**下一步**：

- 修改实验设计。
- `/lab-exp-init`。

### `/lab-taste`

**作用**：给计划、实验、结果或方向选择加一个“科研品味”视角。它关注这个具体工作是否触碰了重要问题、能否抽象成共性结构、是否有更强的研究故事，以及异常结果究竟像 bug、噪声还是值得隔离的新现象。

**何时使用**：

- 你想问“这个问题值得研究吗？”。
- 一个实验结果不符合预期，需要判断它是 bug、无意义波动，还是可能的新现象。
- 一个 plan 看起来能跑，但不知道能不能讲出更大的研究故事。
- 你想避免只追热门/高级范式，也想避免把实际问题过早贬成“只是工程”。

**会做什么**：

- 读取 `PROJECT.md`、目标 plan/experiment/result、相关 `scope.lock`、`claims.md` 和已有 `lit/` 记录。
- 用 Hamming 的重要问题与勇气、Graham 的简洁/启发性/适用范围、Bourdieu 的社会品味批判，以及 vibe-coding 时代“操作便宜、判断稀缺”的视角做分析。
- 输出重要问题、共性结构、right problem、story potential、anomaly lens、social taste check、courage check。
- 给出 1-3 个更强 reframe 和一个下一步动作。

**不要何时使用**：

- 你需要严格 novelty 检查。用 `/lab-review --as=novelty`。
- 你需要资源可行性判断。用 `/lab-review --as=feasibility`。
- 你需要正式 claim/evidence 合成。用 `/lab-synthesize`。
- 你想让系统替你做最终方向决定。`/lab-taste` 是视角，不是 gate。

**主要输出**：

- `reviews/YYYY-MM-DD-<topic>-taste.md`。

**下一步**：

- 如果 reframe 指向新实验，用 `/lab-plan-exp`。
- 如果需要把多个结果串成 claim，用 `/lab-synthesize`。
- 如果核心问题是 feasibility、novelty 或 reviewer 风险，用 `/lab-review`。

## 实验生命周期

### `/lab-exp-init`

**作用**：创建一个新实验节点和完整 `scope.lock`。

**何时使用**：

- 新实验、ablation、baseline、scope-locked investigation 要开始。
- 已经有 hypothesis 和大致设计。
- 想固定这个实验的 config/file/probe invariants。

**不要何时使用**：

- 只是创建 git branch。用 `/lab-exp-start`。
- drift 已经发生且应该成为新实验。用 `/lab-fork`。
- 实验设计还没明确。先用 `/lab-plan-exp`。

**会做什么**：

- 分配下一个 `exp-NNN`。
- 根据 `.lablock/naming.yaml` 绑定 `matrix_id`、`variable_id`、`canonical_variable`、`variant_value`、`paper_label`。
- 创建 `experiments/<exp>-<shortname>/hypothesis.md`。
- 创建 `.lablock/locks/<exp>.scope.lock`。
- 捕获 hypothesis、controlled changes、config invariants、file invariants、optional probes、kill/success criteria。

**主要输出**：

- `experiments/<exp>-<shortname>/`。
- `.lablock/locks/<exp>.scope.lock`。
- hypothesis frontmatter 和 scope.lock 中的 `naming` 引用。

**下一步**：

- 提交实验定义。
- 默认继续在 `experiments/<exp>-<shortname>/` 文件夹中隔离运行。
- 只有需要 Git 历史隔离、远端 CI、多人协作或归档历史时再用 `/lab-exp-start`。

### `/lab-exp-start`

**作用**：在明确需要 Git 历史隔离时创建实验分支，并设置当前实验状态。

**何时使用**：

- `/lab-exp-init` 的实验文件已经提交。
- 工作区干净。
- 明确需要独立 branch：远端 CI、多人协作、归档历史，或用户显式要求。

**不要何时使用**：

- 实验定义还没提交。
- 工作区有未提交改动。
- 想创建实验文件。用 `/lab-exp-init`。
- 只是想并行跑实验。默认用不同 `experiments/<exp>-<shortname>/` 文件夹隔离。

**会做什么**：

- 要求 clean tree。
- 从 base branch 创建 `exp/<exp-id>-<shortname>`。
- 写 `.lablock/state/current-exp`。
- 可选 push branch。

**主要输出**：

- 实验 branch。
- 当前实验状态。

**下一步**：

- `/lab-exp-run` 启动运行。
- 正常实验提交。

### `/lab-exp-run`

**作用**：开始一次实验运行。

**何时使用**：

- `scope.lock` 已创建，实验文件夹存在。
- 准备启动训练/评估命令。

**不要何时使用**：

- 还没创建实验节点或 `scope.lock`。
- 想让 LabLock 替你提交 Slurm/tmux/job。LabLock 只打印 canonical command，不拥有你的训练系统。

**会做什么**：

- 验证实验上下文和 scope。
- 设置 `.lablock/state/current-exp`。
- 更新 `infra/gpu/runs.md`。
- 打印应该运行的训练命令。

**主要输出**：

- run record。
- canonical run command。

**下一步**：

- 用户手动运行命令。
- 记录结果到 `results.md`。

### `/lab-guard`

**作用**：把 SCOPE-DRIFT warning 按研究目标分类。

**何时使用**：

- pre-commit 报 `SCOPE-DRIFT warning`。
- 你不确定 drift 是应该 fork、override、continue-with-note 还是 revert。

**不要何时使用**：

- 没有 drift，只是普通 commit。
- 只是想继续提交。默认 drift warning 不会阻断本地进度。

**会做什么**：

- 读取 drift 信息。
- 展示具体漂移：哪个 config key、哪个 file hash、expected vs actual。
- 引导用户四选一：
  - fork：新实验方向。
  - override/update lock：有理由接受 drift。
  - continue-with-note：继续推进，但把解释 caveat 记下来。
  - revert：误改。

**主要输出**：

- fork artifact、decision/override/note artifact，或撤回改动。

**下一步**：

- `/lab-fork`。
- `lablock override --exp=... --reason=...`。
- 继续实验或记录结果。

### `/lab-fork`

**作用**：把当前实验 drift 分叉成一个新实验。

**何时使用**：

- 当前改动改变了实验范围。
- 这个变化不应该混进原实验结论。
- 你需要一个新的 `exp-NNN`，而不是 `exp-007a` 这种后缀。

**不要何时使用**：

- drift 是一次小例外且你要保留原实验范围。用 override。
- 只是规划一个全新实验。用 `/lab-exp-init`。

**会做什么**：

- 分配新 `exp-NNN`。
- 创建新 experiment dir 和 `scope.lock`。
- 设置 `forked_from`、`fork_reason: scope-drift`。
- 可把 parent 标为 superseded。

**主要输出**：

- 新 experiment dir。
- 新 scope lock。
- fork relationship。

**下一步**：

- 提交 fork artifact。
- 默认在新实验文件夹继续；需要 Git 历史隔离时再用 `/lab-exp-start`。

### `/lab-exp-finalize`

**作用**：正式关闭一个实验。

**何时使用**：

- 实验已完成、被 kill 或被 supersede。
- 需要写入 final status、tag、清 current-exp。

**不要何时使用**：

- 实验还没产生可解释结果。
- 工作区不干净。
- 实验文件夹或 `scope.lock` 不存在。

**会做什么**：

- 确认 status：`done`、`killed`、`superseded`。
- 更新 `hypothesis.md` frontmatter。
- 更新 scope lock status。
- 清 `.lablock/state/current-exp`。
- 可创建 `<exp-id>-final` tag。

**主要输出**：

- finalized experiment status。
- final tag。

**下一步**：

- `done`：`/lab-cleanup-pr`。
- `killed` 或 `superseded`：`/lab-postmortem`。
- 多实验后：`/lab-synthesize`。

### `/lab-cleanup-pr`

**作用**：把成功实验中值得保留的部分整理成干净 PR。

**何时使用**：

- 实验 `status=done`。
- 你要把 formalism、claims、decision 或部分 utility code merge 回 main。
- 实验文件夹或实验 source ref 里有很多临时脚本/debug noise，不想污染 main。

**不要何时使用**：

- 实验未 finalize。
- 想把整个实验目录原样 merge 回 main。
- `gh` 不可用时仍可分类，但不能自动开 PR。

**会做什么**：

- 跑 `lablock cleanup-pr --exp=<exp> --json` 分类 diff。
- 自动 include formalism/claims/decisions。
- 排除 exp scripts、generated maps、debug noise。
- 对 utility/doc/config/other 逐文件询问。
- 创建 cleanup branch、提交、push、draft PR。

**主要输出**：

- cleanup branch。
- draft PR。

**下一步**：

- Review PR。
- Merge 后跑 `/lab-audit`。

### `/lab-postmortem`

**作用**：为实验失败、killed、superseded 或有重要教训的 done 实验写复盘。

**何时使用**：

- `/lab-exp-finalize` status 是 `killed` 或 `superseded`。
- 实验失败但你想保留可复用教训。
- 成功实验也有重要 lessons learned。

**不要何时使用**：

- 只是还没跑完。
- 没有读 `hypothesis.md`、`scope.lock`、`changes.log`、`results.md` 就泛泛总结。

**会做什么**：

- 渲染 postmortem 模板。
- 填五段：what we did、what happened、why、what learned、conditions to revive。
- 强制引用具体结果、log、commit 或 run。

**主要输出**：

- `experiments/<exp>/postmortem.md`。

**下一步**：

- `/lab-synthesize`。
- `/lab-audit`。

## Debug 与协作

### `/lab-debug`

**作用**：结构化 debugging，避免未调查就乱改。

**何时使用**：

- loss 爆炸、结果异常、hook/CI 失败、数据流不对。
- 用户说“debug”“why is X failing”“investigate”。
- 需要记录调查过程。

**不要何时使用**：

- 你已经明确知道 fix 且有证据。
- 想快速 trial-and-error 多次改代码。这个 skill 会限制无依据修复。

**会做什么**：

- 先 reproduce。
- 追踪 data flow。
- 写至少两个 hypothesis。
- 只测试一个最便宜的区分性 hypothesis。
- 确认原因后才提 fix。
- 如果 fix 触碰 locked invariant，会提示 fork/guard。

**主要输出**：

- `debug/YYYY-MM-DD-<topic>.md`。

**下一步**：

- 应用已验证 fix。
- 如果三次本地尝试仍没定位，或怀疑是论文/库/社区中已知问题，用 `/lab-research-debug`。
- 需要外部帮助时用 `/lab-handoff`。

### `/lab-research-debug`

**作用**：对实验问题做深度 research 诊断，把实验上下文、外部资料和本地代码分析合成一个非阻断结论。

**何时使用**：

- `/lab-debug` 已经做过本地复现/假设，但原因仍不清楚。
- 用户问“有没有人遇到过类似问题”“查一下 issue/forum/community”“找参考文献再看代码”。
- 结果异常可能是 bug、已知 reproduction caveat、库版本问题、环境问题或真实现象。

**不要何时使用**：

- 明显的一行错误或已经有明确 fix。用 `/lab-debug`。
- 想让 LabLock 自动写实验脚本。用 `/lab-handoff --type=implementation` 生成 coding-agent prompt。
- 只想做研究方向判断。用 `/lab-taste`。

**会做什么**：

- 读取当前实验的 hypothesis、config、results、scope.lock、changes 和 debug log。
- 搜索官方文档、论文、reproduction repo、GitHub issue/discussion、论坛和开源社区相似案例。
- 对本地问题代码做入口、配置、数据流、模型/loss/eval、环境版本等诊断。
- 给出 `confirmed local bug / likely local bug / known upstream issue / expected phenomenon / environment issue / inconclusive` 分类、证据和下一步。

**主要输出**：

- `reviews/YYYY-MM-DD-<exp>-<topic>-research-debug.md`。

**下一步**：

- 最小修复或最小 reproducer/probe。
- 影响实验意义时走 `/lab-guard`。
- 需要外部 AI 时走 `/lab-handoff --type=debug`。
- 实验应暂停/失败时走 `/lab-postmortem`。

### `/lab-handoff`

**作用**：把上下文或实验实现提示词打包给外部 AI、队友或另一个工具。

**何时使用**：

- 要问 ChatGPT web、同事或另一个 agent。
- 需要 self-contained context，而不是让对方翻整个 repo。
- debug/method/results/design/writing/implementation 任一场景。

**不要何时使用**：

- 只是项目内继续工作，不需要外部上下文包。
- 不想暴露敏感代码/数据时，先删敏感内容。

**会做什么**：

- 选择 handoff type：debug、method、results、design、writing、implementation。
- 抽取 project background、formalism、claims、experiment、code/log/traceback/results。
- `implementation` 类型会生成给 coding agent 的提示词，要求它读取实验文档、围绕研究目标写代码，并避免额外加入防御性 gate。
- 写成单一 Markdown bundle。

**主要输出**：

- `handoffs/outgoing/YYYY-MM-DD-<topic>.md`。

**下一步**：

- 发送给外部 AI/队友。
- 回来后把答复放入 `handoffs/incoming/` 或写 decision。

## Claim、Formalism 与 Paper

### `/lab-synthesize`

**作用**：跨实验综合结果，提出 claim 变化。

**何时使用**：

- 多个实验已完成。
- 用户问“这些实验说明了什么”“story 是什么”。
- 需要把 results 转成 `claims.md` 的候选更新。

**不要何时使用**：

- 只有一个还没完成的实验。
- 想直接改 `claims.md` 不经用户确认。该 skill 只提出 delta。

**会做什么**：

- 读 done experiments 的 hypothesis/results/postmortem/scope lock。
- 建 experiment × metric 表。
- 找 consistent effects、inconsistent effects、non-effects、anti-effects。
- 提出 candidate claims，标 strength、evidence、confidence、gap。

**主要输出**：

- `reviews/` 下 synthesis report。
- `claims.md` 更新建议。

**下一步**：

- 用户审查 claim delta。
- `/lab-paper-write`。

### `/lab-formalism-update`

**作用**：更新数学定义、loss、algorithm 或 formalism version。

**何时使用**：

- `formalism.md` 里的定义需要改。
- loss / algorithm 语义变了。
- paper 或 claims 依赖的版本需要 bump。

**不要何时使用**：

- 只是改实验 config。
- 用户不能确认当前 formalism 的含义。该 skill 有 echo-back 协议。

**会做什么**：

- AI 先复述当前 formalism。
- 用户确认后才改。
- bump version。
- 扫 stale references。
- 写 formalism bump decision。

**主要输出**：

- 更新后的 `formalism.md`。
- `decisions/<date>-formalism-bump-*.md`。

**下一步**：

- `/lab-audit --formalism`。
- 更新 claims/paper。

### `/lab-paper-init`

**作用**：初始化 paper 写作结构。

**何时使用**：

- 准备开始写 paper。
- 要投某个 venue。
- 需要 `paper/outline.md`、`claims-to-evidence.md`、drafts。

**不要何时使用**：

- claims 还没有任何 evidence，且你只是想写 speculative paper。先做 `/lab-synthesize` 或实验。

**会做什么**：

- 询问 venue。
- 可基于 claim snapshot。
- 创建 paper outline、claims-to-evidence、drafts 目录。

**主要输出**：

- `paper/` 写作骨架。

**下一步**：

- `/lab-paper-write`。
- `/lab-paper-audit`。

### `/lab-paper-write`

**作用**：基于 `claims.md` 写 paper section。

**何时使用**：

- 要写 intro、method、results、discussion 等 section。
- 当前 claims 已经有 evidence。
- 需要每个句子可追溯到 claim。

**不要何时使用**：

- 想写未被 `claims.md` 支持的强 claim。
- claims 证据不足。先用 `/lab-synthesize` 或补实验。

**会做什么**：

- 读 `claims.md` 和 `paper/outline.md`。
- 只写被 empirical/derived claims 支持的内容。
- 对 unsupported claim 标出缺口。

**主要输出**：

- `paper/drafts/<section>.md`。

**下一步**：

- `/lab-paper-audit`。

### `/lab-paper-audit`

**作用**：检查 paper draft 里的 claim 是否有 evidence 支撑。

**何时使用**：

- 投稿前。
- 分享 paper draft 前。
- 用户担心 paper 写过头。

**不要何时使用**：

- 没有 `paper/drafts/`。
- 只是想写初稿。用 `/lab-paper-write`。

**会做什么**：

- 扫 paper drafts。
- 抽 claim-like sentences。
- 对照 `claims.md`。
- 标 unsupported / weakly supported / supported。

**主要输出**：

- `paper/audit-report-YYYY-MM-DD.md`。

**下一步**：

- 降低 unsupported claim 语气。
- 补 claims/evidence。

## 仓库维护与审计

### `/lab-tidy`

**作用**：仓库卫生检查和可选清理。

**何时使用**：

- 分支、实验、handoff、artifact 变多。
- 想找 stale branches、oversized non-LFS files、orphan files。
- 想归档旧实验。

**不要何时使用**：

- 想做只读健康报告。用 `/lab-audit`。
- 没有明确许可时做 destructive cleanup。默认 dry-run。

**会做什么**：

- 扫 orphan branches、dangling commits、stale tracking branches。
- 找 oversized non-LFS files。
- 找 expired handoff branches。
- 找 dead experiments needing archive。
- `--apply` 时逐项征求用户同意。

**主要输出**：

- repo hygiene report。
- 可选逐项 cleanup。

**下一步**：

- `/lab-audit` 验证状态。

### `/lab-audit`

**作用**：项目级健康检查。

**何时使用**：

- 每周检查。
- 想知道项目哪里 stale。
- merge 前、paper 前、dogfood 期间。

**模式**：

- `full`：完整审计。
- `weekly`：最近一周活动。
- `formalism`：formalism consistency。
- `coverage`：claim-evidence coverage。
- `orphans`：orphan markdown/indexing。

**不要何时使用**：

- 想自动清理。用 `/lab-tidy --apply`。
- 想创建新实验。用 `/lab-exp-init`。

**会做什么**：

- 聚合 frontmatter、scope verification、coverage、orphans、drift accountability。
- 检查 postmortem coverage、index freshness、handoff 状态。
- 写审计报告。

**主要输出**：

- `reviews/audit-YYYY-MM-DD.md`。

**下一步**：

- 按报告修复。
- 若发现 repo hygiene 问题，用 `/lab-tidy`。

## 常见流程组合

### 新项目

```text
/lab-init -> /lab-plan -> optional /lab-taste -> /lab-plan-exp -> /lab-exp-init -> /lab-exp-run
```

`/lab-exp-start` is optional when a Git branch is needed for collaboration, remote CI, or archival history isolation.

### 已有项目

```text
/lab-migrate -> review migration plan -> /lab-exp-init -> /lab-audit
```

### 实验 drift

```text
pre-commit warns -> /lab-guard -> /lab-fork OR lablock override OR continue-with-note OR revert
```

### 成功实验进入 main

```text
/lab-exp-finalize --status=done -> /lab-cleanup-pr -> /lab-audit
```

### 失败实验沉淀经验

```text
/lab-exp-finalize --status=killed -> /lab-postmortem -> /lab-synthesize
```

If the failure cause is unclear, diagnose before finalizing:

```text
/lab-debug -> /lab-research-debug -> minimal fix OR /lab-guard OR /lab-postmortem
```

When a surprising result may be more than a bug, insert `/lab-taste` before deciding the next experiment.

### 写 paper

```text
/lab-synthesize -> /lab-paper-init -> /lab-paper-write -> /lab-paper-audit
```
