# 模块 42｜交给 AI 编程 Agent 的执行指令 / 工程任务清单

> 可把本文件与仓库交给 Cursor、Claude Code、Codex 或其他具备文件/终端能力的编程工具。**不是要求 Agent 一次完成所有功能**；每次只执行一个可测试工作包。使用者需要为代码执行、密钥、部署授权把关。

## 开发者必须先理解的约束

1. 读 `README.md`, `00-product/01-MVP-PRD.md`, `02-architecture/20-ARCHITECTURE.md`, `02-architecture/21-DATA-MODEL.md`, `02-architecture/23-SECURITY-PRIVACY.md`。
2. 不修改/上传用户的原始 Obsidian Vault；任何公开知识发布先通过导出测试。
3. 不能将图片生成、字幕抓取能力虚构成已经集成；API 没配置时使用明确标识的 Mock 或禁用按钮。
4. 从 `Sprint 0` 顺序实现，每个完成后提交：变更摘要、文件列表、运行命令、测试结果、已知不足、下一步。
5. 不偷偷更改 schema/架构决定；发现冲突先记录 ADR，再实施兼容调整。

## Sprint 0｜工程脚手架

**任务**：检测 Node/Next/Payload 可兼容版本、建立 `web/` 工程、Postgres 连接、Docker 开发环境、环境变量样例、lint/typecheck/test 脚本；添加 CI。

**交付**：`/admin` 能在本地登录，seed 仅创建开发样例；README 运行说明。

**验收**：无配置的 API Key 不影响站点启动；不会在 Git 状态中出现 `.env`。

## Sprint 1｜核心内容与页面（P0）

**任务**：创建 `admins/posts/projects/faqItems/tags/siteSettings/media`；公开 read 过滤；首页/about/projects/journal/contact；可编辑 FAQ；SEO。

**交付**：文章草稿/预览/发布/撤回和项目 CRUD。

**验收**：T001–T006，公开 API 不泄露草稿。

## Sprint 2｜第二知识仓库（P0）

**任务**：`resources/sourceMaterials`、资源添加/分类/标签/URL 标准化、私人媒体/文件下载鉴权、Markdown 导出、来源关联。

**交付**：能收藏 B站和 YouTube 链接，不依赖外部解析 API。

**验收**：T011、T012、T019，资源列表仅管理员可见。

## Sprint 3｜Obsidian Quartz（P0）

**任务**：独立 `garden/` 项目、公开 Markdown 导出器（白名单、附件安全、撤回）、manifest、构建/发布流程；站点跳转链接。

**交付**：本地示例知识库 → 公开 garden；撤回重新构建。

**验收**：T007–T010 必须通过，附风险证明材料。

## Sprint 4｜AI 内容试运行（P1 可关闭）

**任务**：接口适配器 `TextProvider/ImageProvider`，本地模板版本，生成记录，文章/图片草稿；无 AI Key 优雅降级。

**交付**：口述文本→可编辑草稿；文本摘要→一张候选封面；知识卡根据用户输入文字生成。

**验收**：T013–T017，AI 未配置时正常手动发布。

## Sprint 5｜生产发布（P0）

**任务**：容器构建、Nginx、SSL、监控、DB/媒体备份、生产迁移、合规准备；小流量试运行。

**交付**：线上双域名，账户管理，备份与恢复演练记录。

**验收**：T018、T020，全链路基本流程测试通过。

## 每次给 AI 开发者的任务模板

```md
请只执行以下一个 Sprint/Issue：【编号与名称】。
先阅读 README、PRD、架构、相关模块文档和测试矩阵；检查现有代码，不覆盖已有工作。
开发开始前给出：拟修改文件、数据库迁移、依赖/风险。
实现后必须运行：typecheck、lint、适用单测和 e2e；给出运行结果。
新增接口或配置请同步更新 docs；有不确定外部 API 的能力要明确提示，不得假装已联通。
如遇密钥、域名备案或真实部署权限，停止在安全边界并说明缺项；不要猜测凭证。
不要实现本 Sprint 之外的路线图事项。
```

## 初始 Issue 拆分（可以复制到 GitHub）

- `ISSUE-001` initialize payload-postgres-next scaffold
- `ISSUE-002` implement auth + public access filtering
- `ISSUE-003` implement content collections + draft publish
- `ISSUE-004` implement brand site responsive + FAQ
- `ISSUE-005` build resource library & safe URL normalization
- `ISSUE-006` implement protected media and markdown export
- `ISSUE-007` implement safe Obsidian export and manifest
- `ISSUE-008` Quartz standalone build and publish/retract
- `ISSUE-009` implement text provider & article draft P1
- `ISSUE-010` implement image provider & prompt registry P1
- `ISSUE-011` implement video manual notes→card P1
- `ISSUE-012` production deployment + backups + monitoring

## 完成定义 DoD

有代码、有必要测试、有文档、有部署/回滚说明；所有私密场景经过真实测试；任何不支持特性都不会在 UI 中显示为已完成功能。
