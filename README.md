# LabLock

LabLock 是一个面向科研代码仓库的工作流护栏工具。它用 `scope.lock`、Git hooks、CLI、AI skills 和审计报告，把“实验在测什么、哪些东西不能漂、哪些 claim 有证据”固定成文件，而不是只留在对话里。

当前实现基于 Bun + TypeScript，面向 Claude Code / Codex 这类本地 coding agent 使用。

## 它解决什么问题

科研仓库经常会出现几类失控：

- 实验跑着跑着，baseline、config、dataloader、loss 被顺手改了，最后不知道结论到底来自哪个变量。
- paper 里写了 claim，但 evidence 分散在实验目录、commit、日志和聊天记录里。
- 多个 AI / 人类一起改仓库时，当前关注的实验、fork、drift、postmortem 没有统一状态。
- 成功实验 merge 回主线时，debug noise、临时脚本和真正要保留的改动混在一起。

LabLock 的做法是：

- 每个实验都有 `.lablock/locks/<exp>.scope.lock`，记录 config / file hash / probe 三层 invariant。
- Git hooks 在 commit 前检查 scope drift，并要求通过 fork、decision 或 override 解释。
- `changes.log`、commit trailer、change index 把每次改动连到 commit。
- `claims.md`、`formalism.md`、`paper/`、`decisions/` 让写作和证据可审计。
- `lab-*` skills 让 AI 按固定流程做计划、实验、debug、handoff、paper audit 和仓库更新。

## 安装

```bash
git clone https://github.com/Starryyu77/LabLock.git
cd LabLock
./setup --no-prompts
```

安装后会把当前仓库 symlink 到：

- Claude Code: `~/.claude/skills/lablock`
- Codex: `~/.agents/skills/lablock`

只安装某个 host：

```bash
./setup --host=claude --no-prompts
./setup --host=codex --no-prompts
```

## 初始化一个科研项目

在目标科研仓库中运行：

```bash
lablock init-project --name="My Project" --modules=gpu,data,lit --ci-mode=warn-only
```

它会创建：

- `.lablock/` 配置、locks、changes、state
- `PROJECT.md`、`formalism.md`、`claims.md`、`INDEX.md`、`MAP.md`
- `experiments/`、`decisions/`、`reviews/`、`handoffs/`、`paper/`
- Git hooks
- GitHub Actions workflow
- `CLAUDE.md` / `AGENTS.md` 的 LabLock 使用说明

## 常用 CLI

```bash
lablock doctor
lablock next-exp-id
lablock exp-init baseline --hypothesis "..." --config optimizer.lr=0.001 --stage
lablock fork --from exp-001 --shortname model-fork --reason "model invariant changed" --stage
lablock override --exp=exp-001 --reason="intentional drift"
lablock update-skills --host=both --scope=global
lablock-map
lablock-verify-scope --exp=exp-001 --source=staged --json
lablock-frontmatter-check --strict
lablock-coverage --strict
lablock-drift-audit --strict
```

## Skill 总览

LabLock skills 分两类：

- **有副作用 / 用户显式调用**：会创建文件、改 Git 状态、push、写决策记录或更新实验状态。
- **咨询 / 分析型**：读文件、写计划或报告，帮助你更清楚地做研究判断。

### 项目与仓库维护

| Skill | 什么时候用 | 它做什么 | 主要输出 |
|---|---|---|---|
| `/lab-init` | 新科研仓库第一次接入 LabLock | 初始化目录、配置、hooks、CLAUDE/AGENTS 注入和 CI | `.lablock/`、项目骨架、hooks |
| `/lab-update` | 任意项目里想更新本机安装的 LabLock skill | 从本地 canonical LabLock checkout 刷新 `~/.claude/skills/lablock` / `~/.agents/skills/lablock`，默认不拉 GitHub | 更新后的 skill 安装路径、source path、每个 target 的状态 |
| `/lab-tidy` | 仓库变乱、旧实验太多、分支/文件需要整理 | 找 stale branches、oversized files、expired handoffs、orphan files；默认 dry-run | repo health 清单，可选逐项 apply |
| `/lab-audit` | 每周检查或想知道项目哪里 stale | 聚合 frontmatter、scope、coverage、orphan、drift、weekly digest | `reviews/audit-YYYY-MM-DD.md` |

### 研究计划与评审

| Skill | 什么时候用 | 它做什么 | 主要输出 |
|---|---|---|---|
| `/lab-plan` | 只有一个模糊研究想法 | 把想法拆成研究问题、隐藏前提、可证伪 hypothesis 和实现备选 | `plans/YYYY-MM-DD-topic.md` |
| `/lab-plan-exp` | 准备做单个实验，但还没创建 scope.lock | 明确 independent variable、controls、metrics、预期结果、kill/success criteria | `plans/` 下的实验设计草案 |
| `/lab-review` | 想审一个 plan 或 experiment design | 以 advisor / reviewer2 / feasibility / novelty 视角挑问题 | `reviews/YYYY-MM-DD-target-mode.md` |
| `/lab-autoplan` | 想一次性做完整压力测试 | 顺序跑四种 review 视角并汇总 go/no-go | `reviews/YYYY-MM-DD-target-autoplan.md` |

### 实验生命周期

| Skill | 什么时候用 | 它做什么 | 主要输出 |
|---|---|---|---|
| `/lab-exp-init` | 新实验、ablation 或新 baseline 开始前 | 分配 `exp-NNN`，创建 hypothesis、config、scope.lock、results | `experiments/<exp>-<shortname>/`、`.lablock/locks/<exp>.scope.lock` |
| `/lab-exp-start` | 实验文件创建后，要真正开始独立分支 | 从 `main` 创建 experiment branch，提交初始实验文件，设置 current-exp | `exp/<exp>-<shortname>` branch |
| `/lab-exp-run` | 准备启动训练或实验命令 | scope pre-flight，设置 `.lablock/state/current-exp`，记录 run 信息 | `infra/gpu/runs.md` 更新和 canonical command |
| `/lab-guard` | pre-commit 报 SCOPE-DRIFT | 展示 drift，要求选择 fork、update lock + decision、或 revert | accountability artifact 或中止 commit |
| `/lab-fork` | 当前实验变量漂移，应该成为新实验 | 创建新 `exp-NNN`，设置 `forked_from`，复制/更新 lock，可标记原实验 superseded | 新 experiment dir、new scope.lock、decision |
| `/lab-exp-finalize` | 实验结束、失败、killed 或 superseded | 更新 status、打 final tag、清 current-exp；成功走 cleanup PR，失败走 postmortem | final tag、frontmatter 更新 |
| `/lab-cleanup-pr` | 成功实验要 merge 回 main | 分类 diff，保留 formalism/claims/decision，排除 debug noise 和临时实验脚本，创建 PR | cleanup branch、draft PR |
| `/lab-postmortem` | 实验失败、killed 或 superseded 后 | 按 5 段模板写清楚做了什么、发生什么、为什么、学到什么、何时重启 | `experiments/<exp>/postmortem.md` |

### Debug 与外部协作

| Skill | 什么时候用 | 它做什么 | 主要输出 |
|---|---|---|---|
| `/lab-debug` | 训练、评估、hook、数据流出问题 | 先复现、追踪数据流、写 hypothesis，再限制修复尝试次数 | `debug/YYYY-MM-DD-topic.md` |
| `/lab-handoff` | 要把上下文打包给 ChatGPT web 或其他 AI | 按 debug / method / results / design / writing 模板抽取上下文 | `handoffs/outgoing/YYYY-MM-DD-topic.md` |

### 形式化、claim 与论文

| Skill | 什么时候用 | 它做什么 | 主要输出 |
|---|---|---|---|
| `/lab-synthesize` | 多个实验结束后，想知道它们说明了什么 | 读 `results.md`，对照 `claims.md`，提出 claim delta 和缺口 | synthesis report、claims update proposal |
| `/lab-formalism-update` | loss、definition、algorithm 需要改版本 | echo-back 当前 formalism，确认后 bump version，扫描 stale refs，写 decision | `formalism.md`、formalism bump decision |
| `/lab-paper-init` | 准备开始写 paper 或投某个 venue | 创建 `paper/outline.md`、`claims-to-evidence.md`、drafts，可从 claim snapshot 开始 | `paper/` 写作骨架 |
| `/lab-paper-write` | 写 intro / method / results 等 section | 只基于 `claims.md` 中有证据的 claim 写，不支持就标出缺口 | `paper/drafts/<section>.md` |
| `/lab-paper-audit` | 投稿前检查 paper claim 是否有证据 | 扫 drafts，抽 claim-like sentence，对照 `claims.md` 标 unsupported | `paper/audit-report-YYYY-MM-DD.md` |

## 推荐工作流

### 开新项目

1. `/lab-init`
2. `/lab-plan`
3. `/lab-plan-exp`
4. `/lab-exp-init`
5. `/lab-exp-start`

### 实验中

1. `/lab-exp-run`
2. 正常改代码和提交
3. 如果 hook 报 drift，走 `/lab-guard`
4. drift 是新方向，用 `/lab-fork`
5. drift 是 lock 错了，用 `lablock override --exp=... --reason=...` 并补 decision

### 实验结束

1. `/lab-exp-finalize`
2. 成功：`/lab-cleanup-pr`
3. 失败或 killed：`/lab-postmortem`
4. 多个实验后：`/lab-synthesize`

### 写 paper

1. `/lab-paper-init`
2. `/lab-synthesize`
3. `/lab-paper-write`
4. `/lab-paper-audit`

### 更新本机安装的 LabLock skill

当 LabLock 的 canonical 本地仓库已经更新后，在任意使用 LabLock 的项目里运行：

```bash
lablock update-skills --host=both --scope=global
```

这会刷新：

- `~/.claude/skills/lablock`
- `~/.agents/skills/lablock`

默认 source detection 顺序是 `--source`、`LABLOCK_HOME`、当前目录、已有 Codex install、已有 Claude install。默认不从 GitHub 拉取；如果你明确想先从 GitHub 更新 canonical source，再加：

```bash
lablock update-skills --pull --host=both --scope=global
```

如果某个项目里有 vendored skill 目录，可以更新全局安装和项目本地副本：

```bash
lablock update-skills --host=both --scope=auto
```

`/lab-update` 的语义就是这套操作：像软件更新一样复用本地 canonical LabLock checkout，而不是每个项目都手工 clone / pull GitHub。

## 核心数据结构

| 文件 | 作用 |
|---|---|
| `.lablock/config.yaml` | 项目配置、CI 模式、protected branch/tag、模块开关 |
| `.lablock/locks/<exp>.scope.lock` | 实验 scope contract：config / files / probes invariant |
| `.lablock/changes/<exp>.changes.log` | 实验改动摘要 |
| `.lablock/state/current-exp` | 当前关注实验，gitignored |
| `.git/lablock-commit-meta.json` | hook 间传递 commit metadata，gitignored |
| `.lablock/state/change-index.jsonl` | `chg-XXXXXXXX` 到 commit 的索引，gitignored |
| `claims.md` | paper/research claims 和 evidence |
| `formalism.md` | 当前数学定义、算法定义和版本历史 |
| `decisions/` | scope drift、formalism bump、method pivot 等决策记录 |

## 开发与测试

```bash
bun install
bun test
bun run typecheck
```

当前测试覆盖：

- unit tests：schema、frontmatter、lock、changes、classify、meta、change-index、ulid
- integration tests：init -> exp-init -> drift block -> override -> fork -> drift audit
- branch protection tests：protected branch/tag deletion、force-push 拒绝、真实 `pre-push` hook stdin 路径

## 状态

当前版本：`0.1.0`

实现目标：LabLock v3 Phase 0 可运行骨架。后续重点是更完整的 probe templates、更强的 claim/paper parser、真实 GitHub branch protection API 配置和更多迁移场景。
