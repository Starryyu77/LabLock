# Archived LabLock Skills

这些 skill 已从 active `lab-*` 根目录移出，因此 `lablock update-skills` 不会默认安装它们。

归档不是删除历史能力，而是把 vNext 不再作为主线入口的旧流程移出默认路由。旧仓库如确实依赖这些说明，可以手动参考本目录内容，或在项目内复制对应 skill。

## Archived

- `lab-dashboard`: 旧图形看板入口。vNext 监控主线改为 `/lab-monitor`、`progress.md` 和后续 status/digest。
- `lab-guard`: 旧 `scope.lock` drift helper。vNext 默认是 objective alignment note，不把 drift 处理作为研究主线。
- `lab-fork`: 旧 drift fork skill。CLI `lablock fork` 和旧 `scope.lock` 数据结构仍保留，skill 不再默认安装。
- `lab-autoplan`: 旧多视角压力测试 bundle。vNext 更倾向按阶段使用 `/lab-review`、`/lab-taste`、`/lab-plan-exp`。

## Active Replacements

- 进度查看：`/lab-monitor`
- 防御性机制清理：`/lab-deguard`
- 计划和路线：`/lab-plan-exp`、`/lab-roadmap`
- 方向形成：`/lab-literature-research`、`/lab-methodology-synthesis`、`/lab-research-story`
- 旧仓库迁移：`/lab-migrate`
