# 使用案例：把已有实验仓库接入 LabLock

这是一个完整但虚构的案例，用来说明 LabLock 在真实科研仓库中的使用方式。

## 背景

假设你有一个已经跑了一段时间的机器学习仓库：

```text
contrastive-vlm/
├── README.md
├── train.py
├── eval.py
├── src/
│   ├── data.py
│   ├── model.py
│   └── loss.py
├── configs/
│   ├── baseline.yaml
│   └── contrastive.yaml
├── runs/
│   ├── 2026-05-01-baseline/
│   └── 2026-05-04-contrastive/
├── notes/
│   └── plan.md
└── paper/
    └── draft.tex
```

问题是：

- `runs/` 里有结果，但不知道对应哪次代码改动。
- `configs/contrastive.yaml` 被反复改过，无法判断哪个变量导致提升。
- `paper/draft.tex` 里已经写了 “contrastive improves classification”，但 claim 没有统一 evidence 记录。
- AI agent 有时顺手改 dataloader，导致 baseline 不再可比。

目标不是重构整个仓库，而是从现在开始让未来实验受控。

## Step 1：安装或更新 LabLock

如果机器上还没安装：

```bash
curl -fsSL https://raw.githubusercontent.com/Starryyu77/LabLock/main/install.sh | bash -s -- --host=both --no-prompts
```

如果已经安装过：

```bash
lablock update
```

验证：

```bash
lablock doctor
readlink ~/.agents/skills/lab-migrate
```

## Step 2：用 `/lab-migrate` 做非破坏性盘点

在仓库里打开 Codex/Claude，对 AI 说：

```text
请使用 /lab-migrate，把这个已有科研仓库非破坏性接入 LabLock。
先只做 read-only inventory 和 migration plan，不要移动、重命名、删除、重写旧文件。
默认 ci.mode=warn-only。迁移报告写到 reviews/migration-YYYY-MM-DD.md 或 LABLOCK_MIGRATION_PLAN.md。
```

AI 应该先盘点，而不是直接改仓库：

```bash
git status --short --branch
find . -maxdepth 2 -type d -not -path './.git*'
git branch --all
git log --oneline --decorate -20
```

输出的迁移计划会把文件分成：

| Bucket | 示例 |
|---|---|
| `control-plane` | `README.md`, `notes/plan.md`, `paper/draft.tex` |
| `shared-code` | `train.py`, `eval.py`, `src/model.py`, `src/loss.py` |
| `legacy-experiment` | `runs/2026-05-01-baseline/` |
| `active-experiment-candidate` | `configs/contrastive.yaml`, current branch work |
| `artifact` | checkpoints, logs, generated CSV |
| `unknown` | 无法判断用途的旧文件 |

迁移计划的关键结论可能是：

```text
推荐先把当前 contrastive line 作为第一个受控实验。
baseline run 和 contrastive run 应导入为 LabLock mirror nodes，供 dashboard/audit 读取。
旧 runs/ 原地保留，不移动、不重命名。
CI 先用 warn-only。
第一批 invariants 只锁 optimizer.lr、batch_size、src/data.py、src/model.py。
```

## Step 3：确认后初始化 LabLock

用户确认后，AI 或用户运行：

```bash
lablock init-project \
  --name="Contrastive VLM" \
  --modules=gpu,data,vision,lit \
  --ci-mode=warn-only \
  --goal="Evaluate whether contrastive loss improves downstream classification." \
  --hypothesis="Adding contrastive loss improves downstream classification accuracy."
```

这一步会新增 LabLock 的控制面：

```text
.lablock/
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

注意：旧的 `runs/`、`configs/`、`notes/` 不应该被移动。

提交初始化：

```bash
git status --short
git add .lablock PROJECT.md formalism.md claims.md INDEX.md MAP.md CLAUDE.md AGENTS.md .github/workflows/lablock.yml
git commit -m "initialize LabLock in warn-only mode"
```

如果 `experiments/`、`decisions/`、`reviews/`、`handoffs/` 或 `paper/` 是这次初始化新建的空目录/模板文件，可以在确认没有旧内容被误 stage 后再加入 commit。已有旧内容不要因为初始化顺手全量 stage。

## Step 4：导入已有 run 作为 LabLock 实验节点

初始化完成后，先把迁移表里确认要进入看板的旧 run 导入为 mirror node。原始 `runs/` 目录仍然保留，LabLock 只创建可审计的索引节点。

例如导入 baseline：

```bash
lablock migrate-node baseline-2026-05-01 \
  --source runs/2026-05-01-baseline \
  --source-type run \
  --status done \
  --hypothesis "Legacy baseline run reproduced reference accuracy." \
  --confidence medium \
  --stage
```

导入 contrastive run：

```bash
lablock migrate-node contrastive-2026-05-04 \
  --source runs/2026-05-04-contrastive \
  --source-type run \
  --status done \
  --hypothesis "Legacy contrastive run improved downstream classification accuracy; exact claim strength requires confirmation." \
  --confidence low \
  --parent exp-001 \
  --stage
```

这一步会创建：

```text
experiments/exp-001-baseline-2026-05-01/
experiments/exp-002-contrastive-2026-05-04/
.lablock/locks/exp-001.scope.lock
.lablock/locks/exp-002.scope.lock
```

每个 node 的 `config.yaml` 和 `scope.lock` 都会记录 `migration.source_path`，方便以后追溯旧材料来源。

刷新看板：

```bash
lablock dashboard
```

提交导入节点：

```bash
git add experiments .lablock/locks .lablock/dashboard
git commit -m "import legacy experiment nodes"
```

## Step 5：创建第一个强约束受控实验

迁移节点解决的是“旧实验能被 dashboard/audit 看到”。接下来仍然应该只选一个当前活跃实验，把它变成真正强约束的 controlled experiment。

对 AI 说：

```text
请使用 /lab-exp-init 创建第一个受控实验。
shortname 是 contrastive-loss。
hypothesis 是：Adding contrastive loss improves downstream classification accuracy.
这是从已有仓库迁入后的第一个 active experiment。
把它作为 legacy contrastive run 的 child，parent=exp-002。
请从 configs/contrastive.yaml 里选择少量 config invariants，并把 src/data.py 和 src/model.py 作为 file invariants。
```

可能生成的 `.lablock/locks/exp-003.scope.lock` 重点内容：

```yaml
exp_id: exp-003
shortname: contrastive-loss
hypothesis: |
  Adding contrastive loss improves downstream classification accuracy.
parent: exp-002
status: active

locked_invariants:
  config:
    optimizer.lr: 0.001
    train.batch_size: 64
    model.backbone: resnet50
  files:
    - path: src/data.py
      hash: sha256:<hash>
      reason: dataloader must stay fixed for a valid comparison
    - path: src/model.py
      hash: sha256:<hash>
      reason: model backbone must stay fixed while testing loss change

controlled_changes:
  added:
    - contrastive loss term

kill_criteria:
  - validation loss diverges for 3 consecutive evaluations

success_criteria:
  - downstream classification accuracy improves by at least 1 point
```

提交实验定义：

```bash
git add experiments/exp-003-contrastive-loss .lablock/locks/exp-003.scope.lock
git commit -m "create contrastive-loss experiment"
```

创建实验分支：

```bash
lablock exp-start --exp=exp-003
```

这会让 dashboard 显示从历史 run 到当前受控实验的关系。

## Step 6：正常实验提交

修改 `src/loss.py`，加入 contrastive loss。因为这是 controlled change，commit 可以通过：

```bash
git add src/loss.py experiments/exp-003-contrastive-loss/results.md
git commit -m "add contrastive loss and initial results"
```

LabLock 会自动补 commit message：

```text
[exp-003][RESULT] add contrastive loss and initial results

LabLock-Change: chg-XXXXXXXX
```

并更新：

```text
.lablock/changes/exp-003.changes.log
.lablock/state/change-index.jsonl
```

## Step 7：一次被拦住的 drift

某天你或 AI 顺手改了 `src/data.py`，比如换了 augmentation。这个文件在 `scope.lock` 里是 file invariant。

提交时：

```bash
git add src/data.py
git commit -m "tune augmentation"
```

LabLock 会阻止：

```text
SCOPE-DRIFT detected but no accountability artifact staged.
```

这时不要 `git commit --no-verify`。你有三个选择。

### 选择 A：这是新实验方向，fork

```text
请使用 /lab-guard 处理 drift。我选择 fork，因为 augmentation 改动会改变实验范围。
```

LabLock 创建：

```text
experiments/exp-004-augmentation-fork/
.lablock/locks/exp-004.scope.lock
```

新实验 frontmatter 里会有：

```yaml
forked_from: exp-003
fork_reason: scope-drift
```

### 选择 B：这是一次有理由的例外，override

```bash
lablock override --exp=exp-003 --reason="temporary augmentation fix needed to correct a data bug"
git add src/data.py decisions/
git commit -m "accept augmentation data fix"
```

commit trailer 会包含：

```text
LabLock-Change: chg-XXXXXXXX
LabLock-Override: chg-XXXXXXXX
```

### 选择 C：这是误改，revert

```bash
git restore --staged src/data.py
git restore src/data.py
```

## Step 8：实验结束和证据整理

实验完成：

```bash
lablock exp-finalize --exp=exp-003 --status=done --tag
```

如果实验成功，整理 PR：

```text
请使用 /lab-cleanup-pr，把 exp-003 中应该进入 main 的改动整理成干净 PR。
不要把 debug noise、临时 runs、旧 checkpoint 放进 PR。
```

如果实验失败：

```text
请使用 /lab-postmortem 给 exp-003 写失败复盘。必须引用 results.md、changes.log 或具体 commit。
```

多个实验后做 synthesis：

```text
请使用 /lab-synthesize，总结 exp-001、exp-002 和 exp-003 对当前 claims.md 的影响。
```

## Step 9：结果

迁入后，这个仓库不再依赖聊天记忆判断实验边界，而是有文件化证据链：

```text
scope.lock        -> 实验边界
changes.log       -> 每次实验改动摘要
commit trailer    -> change_id 与 commit 绑定
decisions/        -> drift/override/scope update 的理由
claims.md         -> paper claim 与 evidence 绑定
audit reports     -> 周期性健康检查
```

最重要的改变是：当实验范围漂移时，LabLock 不会让它悄悄混进同一个结论里。它要求你明确选择：

```text
这是新实验？fork。
这是合理例外？override + decision。
这是误改？revert。
```

这就是 LabLock 的核心价值。
