# LabLock 使用教程

这份教程面向第一次使用 LabLock 的用户。目标是走完一个最小闭环：

```text
安装 LabLock -> 初始化/迁移科研仓库 -> 创建第一个 scope.lock -> 文件夹隔离运行 -> 处理 drift -> finalize/audit
```

如果你只想快速安装，先看第 1 节。如果你已经有旧科研仓库，直接看第 4 节。

## 0. 准备条件

你需要：

- macOS/Linux shell
- Git
- Bun >= 1.0
- Claude Code 或 Codex 本地 coding agent，至少一个即可

如果你不确定 Bun 是否安装：

```bash
bun --version
```

## 1. 安装 LabLock

推荐把下面这段话复制给你的本地 AI agent：

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
~/.local/bin/lablock doctor
readlink ~/.claude/skills/lab-init
readlink ~/.agents/skills/lab-init

验收标准：
- ~/.lablock/source 是从 GitHub clone 的 LabLock 仓库。
- ~/.claude/skills/lab-* 和 ~/.agents/skills/lab-* 是逐个 skill symlink。
- ~/.local/bin/lablock 可以直接运行。
- skill lint 和 doctor 通过。

如果缺 Bun，请先告诉我，不要静默安装。
```

你也可以自己运行：

```bash
curl -fsSL https://raw.githubusercontent.com/Starryyu77/LabLock/main/install.sh | bash -s -- --host=both --no-prompts
```

安装后常用验证：

```bash
~/.local/bin/lablock doctor
readlink ~/.agents/skills/lab-init
readlink ~/.claude/skills/lab-init
```

如果 `~/.local/bin` 已经在 `PATH`，后面可以直接运行：

```bash
lablock doctor
```

## 2. 选择入口：新仓库还是旧仓库

LabLock 有两个不同入口：

```text
新科研仓库       -> /lab-init
已有科研仓库     -> /lab-migrate
```

不要在已有复杂仓库里直接当作新项目粗暴初始化。已有仓库通常有旧脚本、旧 plan、旧实验目录、日志、结果和 paper 资产，应该先迁移盘点。

## 3. 新科研仓库：从 `/lab-init` 开始

进入你的科研仓库：

```bash
cd /path/to/your-research-repo
git status --short --branch
```

如果这是新项目，可以对 AI 说：

```text
请使用 /lab-init 初始化这个科研仓库。项目名是 <项目名>，方向是 <研究方向>，先用 warn-only CI，不要启用 enforce。命名策略选择 B: paper-aligned registry，除非我另说。
```

也可以直接跑 CLI：

```bash
lablock init-project \
  --name="My Research Project" \
  --modules=gpu,data,lit \
  --ci-mode=warn-only \
  --naming-profile=paper-aligned \
  --goal="Study whether contrastive loss improves representation quality" \
  --hypothesis="Adding contrastive loss improves downstream classification accuracy."
```

初始化后会出现：

```text
.lablock/
.lablock/naming.yaml
.lablock/variables.yaml
.lablock/matrices.yaml
PROJECT.md
formalism.md
claims.md
INDEX.md
MAP.md
experiments/
decisions/
reviews/
handoffs/
paper/
```

检查：

```bash
lablock doctor
lablock-frontmatter-check --strict
```

## 4. 已有科研仓库：从 `/lab-migrate` 开始

如果仓库已经有自己的结构，例如：

```text
scripts/
configs/
runs/
outputs/
notes/
paper/
train.py
eval.py
```

不要先改目录。对 AI 说：

```text
请使用 /lab-migrate，把这个已有科研仓库非破坏性接入 LabLock。
先只做 read-only inventory 和 migration plan，不要移动、重命名、删除、重写旧文件。
默认 ci.mode=warn-only。迁移报告写到 reviews/migration-YYYY-MM-DD.md 或 LABLOCK_MIGRATION_PLAN.md。
```

`/lab-migrate` 的合理结果不是“把旧目录搬家到 LabLock 结构里”。第一阶段要求：

```text
旧文件原地保留，
迁移报告列出哪些旧 plan / run / result 应该进入 LabLock 看板，
经用户确认后，选中的旧材料被导入为 LabLock mirror nodes，
未来 commit 能被 hooks 守住。
```

mirror node 是一个新的 `experiments/exp-NNN-*/` 加 `.lablock/locks/exp-NNN.scope.lock`。它引用旧 source path，但不移动或复制旧实验目录。这样 dashboard、audit、synthesize、paper 相关流程才能读到这些旧实验。

单个导入命令示例：

```bash
lablock migrate-node legacy-baseline \
  --source runs/2026-05-01-baseline \
  --source-type run \
  --status done \
  --hypothesis "Legacy baseline run reproduced reference accuracy." \
  --confidence medium \
  --stage
```

低置信度导入是允许的，但必须保守描述，并在后续 review 中确认。

## 5. 创建第一个受控实验

设计实验时，优先使用 skill：

```text
请使用 /lab-exp-init 创建一个新实验。
shortname 是 contrastive-baseline。
hypothesis 是：Adding contrastive loss improves downstream classification accuracy.
父实验可以是 none。
请帮我选择少量 config invariants、1-2 个关键 file invariants，并写 kill/success criteria。
```

如果你想用 CLI 快速演示：

```bash
lablock exp-init contrastive-baseline \
  --hypothesis "Adding contrastive loss improves downstream classification accuracy." \
  --parent none \
  --config optimizer.lr=0.001,model.hidden_dim=256 \
  --control-added "contrastive loss term" \
  --file-invariant src/data.py:"dataloader must stay fixed" \
  --kill "validation loss diverges for 3 consecutive evaluations" \
  --success "classification accuracy improves by at least 1 point" \
  --stage
```

提交这个实验定义：

```bash
git commit -m "create first LabLock experiment"
```

默认继续在实验文件夹中运行；如果明确需要 Git 历史隔离、远端 CI 或多人协作，再创建实验分支：

```bash
lablock exp-start --exp=exp-001
```

## 6. 日常开发：正常提交

在对应实验文件夹中正常改代码、跑训练、记录结果。提交时 hook 会自动：

- 校验 frontmatter
- 检查大文件/LFS
- 分类 staged diff
- 检查 `scope.lock` 的 config/file invariants
- 写 `changes.log`
- 补 commit message prefix 和 `LabLock-Change`

你通常只需要：

```bash
git add <files>
git commit -m "train contrastive variant"
```

## 7. 遇到 SCOPE-DRIFT 怎么办

如果你改了 `scope.lock` 里锁住的 config 或 file，commit 会被拦住。不要直接 `--no-verify`。

让 AI 处理：

```text
请使用 /lab-guard 处理这个 SCOPE-DRIFT。先解释 drift 是什么，然后让我在 fork / override / revert 之间选择。
```

三种处理：

- **fork**：这个 drift 实际上是新实验方向，使用 `/lab-fork`。
- **override**：这是一次明确接受的例外，使用 `lablock override --exp=... --reason=...`。
- **revert**：这是误改，撤回 offending changes。

override 示例：

```bash
lablock override --exp=exp-001 --reason="learning rate change is intentional for this ablation"
git add experiments/exp-001-contrastive-baseline/config.yaml
git commit -m "adjust lr for ablation"
```

## 8. 实验结束

实验结束后：

```bash
lablock exp-finalize --exp=exp-001 --status=done --tag
```

如果成功，走 cleanup PR：

```text
请使用 /lab-cleanup-pr，把这个成功实验中应该进入 main 的改动整理成一个干净 PR。
```

如果失败或 killed：

```text
请使用 /lab-postmortem，为 exp-001 写 postmortem。必须写清楚 what we did、what happened、why、what learned、conditions to revive。
```

如果失败原因不清楚，先做深度诊断：

```text
请使用 /lab-research-debug，对 exp-001 的 <症状> 做深度 research：查相关论文/文档/issue/forum/community，并结合本地代码给出诊断结论。
```

最后跑一次 audit：

```bash
lablock-drift-audit --strict
lablock-coverage --strict
```

或让 AI 做项目级检查：

```text
请使用 /lab-audit 做一次 weekly health check。
```

## 9. 更新 LabLock 本身

当 LabLock GitHub 仓库发布新版本后，本机升级：

```bash
lablock update
```

如果 `lablock` 不在 PATH：

```bash
~/.local/bin/lablock update
```

预览：

```bash
lablock update --dry-run
```

## 10. 最小心智模型

LabLock 的重点不是“多生成一些文件”，而是让科研过程有可审计边界：

```text
scope.lock 定义这个实验到底在测什么
hooks 阻止无解释的 scope drift
fork/override/decision 解释为什么边界变化
claims.md 和 paper audit 阻止 paper claim 脱离证据
```

第一次使用时，不要试图一次性管理所有历史实验。先锁住一个当前活跃实验，把未来工作变得可追踪。
