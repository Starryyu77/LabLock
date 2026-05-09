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

### 推荐：复制给 AI 自动安装

如果你正在使用 Claude Code、Codex 或其他本地 coding agent，可以直接复制下面这一段发给 AI：

```text
请在我的电脑上安装 LabLock skills。按外部用户安装路径执行，不要使用任何本地开发仓库。

目标：
- 从 GitHub 安装 https://github.com/Starryyu77/LabLock
- canonical source 使用 ~/.lablock/source
- 同时安装 Claude Code 和 Codex 的 per-skill symlink
- 安装完成后做验收

请执行：

curl -fsSL https://raw.githubusercontent.com/Starryyu77/LabLock/main/install.sh | bash -s -- --host=both --no-prompts

然后验证：

git -C ~/.lablock/source remote -v
git -C ~/.lablock/source log -1 --oneline
bun ~/.lablock/source/bin/lablock-skill-lint.ts
bun ~/.lablock/source/bin/lablock.ts doctor
~/.local/bin/lablock doctor
readlink ~/.claude/skills/lab-init
readlink ~/.agents/skills/lab-init
readlink ~/.claude/skills/lab-update
readlink ~/.agents/skills/lab-update

验收标准：
- ~/.lablock/source 是从 GitHub clone 的 LabLock 仓库。
- ~/.claude/skills/lab-* 和 ~/.agents/skills/lab-* 是逐个 skill symlink。
- lab-init 和 lab-update 都指向 ~/.lablock/source/lab-init / ~/.lablock/source/lab-update。
- ~/.local/bin/lablock 可以直接运行。
- lablock-skill-lint 通过。
- doctor 至少显示 Bun 和 git 可用。

如果缺 Bun，请先告诉我，不要静默安装。
```

只安装某一个 host，可以把命令里的 `--host=both` 改成：

```bash
--host=claude
--host=codex
```

### 手动安装

```bash
curl -fsSL https://raw.githubusercontent.com/Starryyu77/LabLock/main/install.sh | bash -s -- --host=both --no-prompts
```

安装后会把 LabLock implementation 放在：

- canonical source: `~/.lablock/source`
- CLI shim: `~/.local/bin/lablock`

同时会把每个 `lab-*` skill 目录分别 symlink 到 host 的 skill root：

- Claude Code: `~/.claude/skills/lab-init`、`~/.claude/skills/lab-exp-init`、...
- Codex: `~/.agents/skills/lab-init`、`~/.agents/skills/lab-exp-init`、...

只安装某个 host：

```bash
curl -fsSL https://raw.githubusercontent.com/Starryyu77/LabLock/main/install.sh | bash -s -- --host=claude --no-prompts
curl -fsSL https://raw.githubusercontent.com/Starryyu77/LabLock/main/install.sh | bash -s -- --host=codex --no-prompts
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
lablock update
lablock dashboard
lablock next-exp-id
lablock exp-init baseline --hypothesis "..." --config optimizer.lr=0.001 --stage
lablock migrate-node legacy-baseline --source runs/2026-05-01-baseline --source-type run --status done --hypothesis "Legacy baseline run reproduced reference accuracy." --stage
lablock exp-start --exp=exp-001
lablock exp-finalize --exp=exp-001 --status=killed
lablock postmortem --exp=exp-001
lablock cleanup-pr --exp=exp-001 --dry-run
lablock fork --from exp-001 --shortname model-fork --reason "model invariant changed" --stage
lablock override --exp=exp-001 --reason="intentional drift"
lablock github-protection check --branch=main --required-status=lablock-checks --required-reviews=1 --strict --json
lablock-map
lablock-verify-scope --exp=exp-001 --source=staged --json
lablock-frontmatter-check --strict
lablock-skill-lint
lablock-coverage --strict
lablock-drift-audit --strict
```

### 实验看板

```bash
lablock dashboard
```

默认会生成：

- `.lablock/dashboard/data.json`
- `.lablock/dashboard/index.html`

看板从 `experiments/*/hypothesis.md`、`experiments/*/results.md` 和 `.lablock/locks/*.scope.lock` 汇总实验规划、当前进度、父子实验关系、下一步子实验、success/kill criteria 和关键配置。需要纯数据时可以运行：

```bash
lablock dashboard --json
```

如果本机允许打开浏览器：

```bash
lablock dashboard --open
```

## Skill 总览

完整 skill reference 见 [`docs/skills-reference.md`](docs/skills-reference.md)。下面是快速索引。

LabLock skills 分两类：

- **有副作用 / 用户显式调用**：会创建文件、改 Git 状态、push、写决策记录或更新实验状态。
- **咨询 / 分析型**：读文件、写计划或报告，帮助你更清楚地做研究判断。

### 项目与仓库维护

| Skill | 什么时候用 | 它做什么 | 主要输出 |
|---|---|---|---|
| `/lab-advice` | 不知道当前任务该用哪个 LabLock skill | 读用户意图，推荐最合适的 `/lab-*`，或明确说没有合适 skill | 推荐 skill、理由、可复制调用语句 |
| `/lab-init` | 新科研仓库第一次接入 LabLock | 初始化目录、配置、hooks、CLAUDE/AGENTS 注入和 CI | `.lablock/`、项目骨架、hooks |
| `/lab-migrate` | 已有科研仓库想非破坏性接入 LabLock | 先盘点旧脚本/plan/实验/结果，写迁移计划；经确认用 warn-only 初始化，并把选中的旧计划/旧实验导入为 LabLock mirror nodes | `reviews/migration-YYYY-MM-DD.md`、`experiments/exp-*`、`.lablock/locks/*.scope.lock` |
| `/lab-dashboard` | 想打开、刷新或填充实验看板 | 运行 `lablock dashboard`；新实验用 `exp-init`，旧实验/旧 run 用 `/lab-migrate` 或 `migrate-node` 导入后刷新 | `.lablock/dashboard/index.html`、实验状态摘要 |
| `/lab-update` | 任意项目里想一键升级本机 LabLock | 运行 `lablock update`：从 GitHub fast-forward 更新 canonical source，重装依赖，刷新 Claude/Codex skills | 更新后的 source、CLI、skill 安装路径 |
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
| `/lab-exp-start` | 明确需要 Git 历史隔离/协作/远端 CI 时 | 要求 clean tree，从 base 创建 experiment branch，设置 current-exp，可选 push；不是默认实验隔离方式 | `exp/<exp>-<shortname>` branch |
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

完整入门教程见 [`docs/tutorial.md`](docs/tutorial.md)。已有科研仓库迁入案例见 [`docs/use-case.md`](docs/use-case.md)。

### 开新项目

1. `/lab-init`
2. `/lab-plan`
3. `/lab-plan-exp`
4. `/lab-exp-init`
5. `/lab-exp-run`

需要 Git 历史隔离、远端 CI、多人协作或 cleanup PR 时，再插入 `/lab-exp-start`。

### 接入已有科研仓库

1. `/lab-migrate`
2. 审阅迁移报告
3. 同意后用 warn-only 初始化 LabLock
4. 按迁移表把选中的旧 plan / run / result 用 `lablock migrate-node` 导入为 LabLock mirror nodes
5. 选择一个当前活跃实验，用 `/lab-exp-init` 创建或细化第一个强约束 `scope.lock`
6. 跑 `lablock dashboard` 和 `/lab-audit`，确认看板和审计能读到真实实验节点

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

### 一键更新本机安装的 LabLock

当我们在 GitHub 上发布了新的 LabLock 版本，其他用户在本机任意目录运行：

```bash
lablock update
```

如果 `~/.local/bin` 还没进 `PATH`，也可以直接运行：

```bash
~/.local/bin/lablock update
```

它会按顺序执行：

1. 在 `~/.lablock/source` 执行 `git pull --ff-only`。
2. 在 `~/.lablock/source` 执行 `bun install`。
3. 刷新 `~/.claude/skills/lab-*` 和 `~/.agents/skills/lab-*`。

预览但不写入：

```bash
lablock update --dry-run
```

安装一个明确的预览分支 / tag / commit：

```bash
lablock update --ref codex/experiment-dashboard
```

`--ref` 会先在 canonical source 中执行 `git fetch origin <ref>` 并切到该 ref，再继续 `git pull --ff-only`、`bun install` 和 skill 刷新。不传 `--ref` 时，`lablock update` 仍然只更新当前 stable 分支。

只刷新本地 skill 链接、不拉 GitHub、不重装依赖：

```bash
lablock update --no-pull --no-install --host=both --scope=global
```

底层刷新命令仍然可用；当 LabLock 的 canonical 本地仓库已经由别的方式更新后，可以运行：

```bash
lablock update-skills --host=both --scope=global
```

这会刷新：

- canonical source：`~/.lablock/source`
- Claude Code skill symlinks：`~/.claude/skills/lab-*`
- Codex skill symlinks：`~/.agents/skills/lab-*`

默认 source detection 顺序是 `--source`、`LABLOCK_HOME`、当前目录、`~/.lablock/source`。`update-skills` 默认不从 GitHub 拉取；如果你明确想先从 GitHub 更新 canonical source，再加：

```bash
lablock update-skills --pull --host=both --scope=global
```

如果某个项目里有 vendored skill 目录，可以更新全局安装和项目本地副本：

```bash
lablock update-skills --host=both --scope=auto
```

`/lab-update` 的默认语义就是 `lablock update`：像软件更新一样复用本地 canonical LabLock source，而不是每个项目都手工 clone / pull GitHub。

### 检查 GitHub branch protection

本地 hook 会阻止 protected branch/tag 的危险 push；GitHub 远端保护可以用 CLI 检查：

```bash
lablock github-protection check --branch=main --required-status=lablock-checks --required-reviews=1 --strict --json
```

输出会包含 `compliance`、`missing`、`dangerous`。LabLock policy 默认要求指定 status context 存在、`required_status_checks.strict == true`、review 数量达标、admin enforcement 开启、禁止 force push / branch deletion。`--strict` 下，只要 GitHub protection 不可访问、不存在、跳过 pattern branch，或保护规则不符合 LabLock policy，命令就会退出 1。

如果权限允许，可以先 dry-run：

```bash
lablock github-protection apply --branch=main --required-status=lablock-checks --required-reviews=1 --dry-run --json
```

dry-run 会输出 `existing_summary`、`planned_payload` 和 `delta`，其中 `delta` 标出 `added`、`changed`、`preserved`、`possibly_dropped`。确认 planned payload 后再显式 apply：

```bash
lablock github-protection apply --branch=main --required-status=lablock-checks --required-reviews=1
```

`apply` 必须传 `--required-status`，除非显式写 `--allow-no-required-status`。默认是 `merge-existing`，会尽量保留已有 GitHub protection 的已知设置，包括已有 status contexts、更严格的 review 数量、code owner review、dismissal restrictions 和 bypass allowances；如果你要用 LabLock 最小策略替换现有配置，必须显式加 `--replace`。

`paper/**` 这类 pattern branch 不走 classic branch protection endpoint。可以用 active rules 读取命令检查某个具体 ref 会命中哪些 rulesets/rules：

```bash
lablock github-ruleset check --branch=paper/draft --strict --json
```

私有仓库在免费账号下可能会返回 GitHub API `403`；LabLock 会把这种状态报告成 `unavailable`，而不是误判为已保护。

## Controlled dogfood

当前版本的下一步不是继续扩展 GitHub protection，而是在真实科研仓库里试跑完整闭环：

```text
lab-init -> exp-init -> exp-start -> drift -> override/fork -> finalize -> audit
```

执行协议见 [`docs/dogfood.md`](docs/dogfood.md)。dogfood 期间重点记录 friction：哪些 hook 太烦、哪些 lock 字段难填、哪些 audit 输出没有用、哪一次 drift 被正确拦住。

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
- integration tests：init -> exp-init -> exp-start -> drift block -> override/fork -> finalize -> postmortem -> drift audit
- branch protection tests：protected branch/tag deletion、force-push 拒绝、真实 `pre-push` hook stdin 路径

## 状态

当前版本：`0.1.0 beta-candidate`

实现目标：LabLock v3 Phase 0 可运行骨架，进入 controlled dogfood。后续重点是用真实科研项目验证 `scope.lock -> drift -> fork/override -> finalize -> audit` 闭环，再补 probe templates 和 claim/paper parser。
