# AI Agent 运行指引（文档交接版）

本目录是**PRD/设计规格文档包**，不是可运行的 Next.js 仓库。

## 任务入口

1. 阅读 `README.md` 和 `04-delivery/42-AGENT-HANDOFF.md`。
2. 从 Sprint 0 搭建**单独的代码项目**，完成认证/内容系统，再实现同步/AI 等模块。
3. 始终以 `00-product/01-MVP-PRD.md` 的 P0/P1 边界为准；后续迭代 `00-product/02-ROADMAP-AND-ITERATIONS.md` **只预留接口，不一次开发**。
4. 检查官方 Next.js/Payload/Quartz/ComfyUI/API 版本与合法可用性，冻结依赖；本文档方案不替代实际测试。

## 不可违反的硬约束

- Obsidian 原始 Vault 不提交代码仓库或公开服务器，不通过公开 Quartz 构建原目录。
- 用户资料和模型 API Key 不能泄露到前台；Media/Resources 默认 private。
- AI 产物只能进草稿，发布必须人工确认。
- B站/YouTube/视频号没有授权字幕时只做收藏/元数据，不虚构完整视频解析。
- 提示词必须版本化，模型服务使用 Adapter，可以关闭而不影响其他内容功能。
- 数据库变更必须迁移和回滚策略，发版后要做安全和隐私测试。

## 每次任务的交付格式

- 任务编号：
- 现有代码检查：
- 计划修改的文件：
- 实际变更：
- 数据库和 API 影响：
- 测试命令和结果：
- 未解决问题/下一步：
