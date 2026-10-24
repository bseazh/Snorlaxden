# 何海钊 · 个人数字空间｜开发交付文档包

> 版本：`v1.0-spec` · 更新：2026-10-24 · 文档性质：**实施规格，不是已完成代码**  
> 面向：AI 编程代理 / 前后端开发者 / 运维人员 / 产品负责人

## 0. 一句话产品定义

在已有**中国大陆云服务器 + 域名**基础上建设「公开个人品牌站 + Obsidian 可控公开知识花园 + 私人第二知识仓库/素材台 + 可扩展 AI 创作流水线」。内容资产需可导出、可追溯、可撤回，避免一次性博客。

## 1. 先读什么（给 AI 开发者）

1. [MVP 范围与阶段划分](00-product/01-MVP-PRD.md)
2. [系统架构与源数据原则](02-architecture/20-ARCHITECTURE.md)
3. [数据模型](02-architecture/21-DATA-MODEL.md)
4. [API 契约](02-architecture/22-API-CONTRACTS.md)
5. [首期任务拆解/Agent 交接指令](04-delivery/42-AGENT-HANDOFF.md)
6. [国内服务器部署](04-delivery/40-DEPLOYMENT-CN.md)
7. [验收测试](04-delivery/41-TEST-ACCEPTANCE.md)

## 2. 文档地图

| 路径 | 说明 |
|---|---|
| `00-product/` | 目标、MVP 范围、阶段路线图、决策与风险 |
| `01-ux/` | 页面信息架构、交互与视觉规范 |
| `02-architecture/` | 总体架构、数据模型、API、安全权限 |
| `03-modules/` | 各模块逐个实现说明：前台、后台、Obsidian、第二仓库、文章、图片、视频、发布 |
| `04-delivery/` | 部署运维、验收、开发任务与迭代流程 |
| `05-prompts/` | 可版本化的系统提示词：写作、配图、视频、知识卡片 |
| `06-examples/` | 示例输入输出、端到端业务用例 |

## 3. 优先级与“第一版”的准确含义

- **MVP 1.0 / P0，必须上线**：品牌前台、项目/文章、后台登录、资源收藏/第二知识仓库入口、Obsidian 安全单向公开、预设问答、草稿/预览/发布/撤回、备份。
- **MVP 1.0 / P1，可开关试运行**：口述文本→AI 文章草稿；单张 AI 配图→媒体库；视频链接→元数据/本人补充材料→知识卡片草稿。无 API Key 也必须能完成正常发布流程。
- **1.1**：完整文章多图编排、可重试生成任务、原文 PDF 摘要、合法字幕导入/转录、知识卡片自动导出、资源全文检索。
- **1.2 / 2.0**：ComfyUI/“CU”可插拔工作流、实时任务队列、私密在线知识查看、RAG 私人助手、统一全文/语义搜索、自动周报。

“CU”的准确含义尚未确认：本规格同时区分 **ComfyUI 工作流接口**与 **Computer Use（操作软件 UI）**。默认用**直接模型 API**完成图片生成；如果 CU 指 ComfyUI，则接 `ImageProvider` 适配器；如果指 Computer Use，则仅作为后续实验性自动化，不作为生产主链路。详见 [AI 图片](03-modules/35-AI-IMAGE-PROMPTS.md)。

## 4. 内容资产的唯一权威来源

| 内容类型 | 唯一编辑源 | 网站呈现 | 导出策略 |
|---|---|---|---|
| Obsidian 原始知识笔记 | 本地 Obsidian Vault | 只发布明确筛选后的副本 | Markdown 白名单发布 |
| 博客/项目案例 | CMS / PostgreSQL | 网站文章及项目页 | 导出 Markdown 到独立 Export/Inbox；不覆盖 Vault |
| 视频/PDF/链接收藏 | CMS `resources`（私密默认） | 后台资源卡 / 批准公开的精选资源 | 可导出含 `source_id` 的 Markdown 卡片 |
| 图片与媒体 | 媒体存储（本地私有或对象存储） | 审核公开后得到公开 URL | 元数据归档，文件备份 |
| AI 草稿 | CMS `ai_generations` + `posts` 草稿 | 管理员预览 | 不自动公开，不改写原始来源 |

## 5. 项目第一批验收点

- 管理员登录，手动写一篇文章并发布、撤回；访客只看到发布态。
- 本地公开的 Obsidian 笔记发布至 `garden.example.com`，一篇私密笔记和私密附件未出现在产物中。
- 粘贴 B站/YouTube 链接能保存来源卡片；拿不到字幕时仍可填写自己的笔记并入库。
- 输入口述笔记可手动编辑成草稿；配置 AI Key 后可生成文本草稿；图片生成失败时不阻碍发布。
- “资源卡片→写作草稿→公开文章”具有来源追踪、审核与撤回路径。

## 6. 开发纪律

1. 先检查当前代码仓库，不要擅自重构或删除已有功能；在每一任务开始前列出拟修改文件。
2. **绝不**将 Obsidian 原始 Vault、`.env`、私密 PDF、服务密钥提交至公开仓库。
3. 所有对外写入均需管理员验证；Payload Local API 的 `overrideAccess` 默认可能跳过访问校验，必须明确设置或先完成认证。
4. 使用迁移、测试及锁定依赖版本；不要将本文档当作已经验证过的可执行项目。
5. 以 [测试清单](04-delivery/41-TEST-ACCEPTANCE.md) 的可观察结果作为完成标准。

## 7. 官方技术资料（开发前重新核对版本）

- Payload 安装：https://payloadcms.com/docs/getting-started/installation
- Payload Local API：https://payloadcms.com/docs/local-api/overview
- Payload PostgreSQL：https://payloadcms.com/docs/database/postgres
- Quartz 5 私密页面与附件警告：https://quartz.jzhao.xyz/features/private-pages
- Quartz Hosting：https://quartz.jzhao.xyz/hosting
- ComfyUI 自托管 API：https://docs.comfy.org/development/comfyui-server/comms_routes
- YouTube 视频元数据：https://developers.google.com/youtube/v3/docs/videos/list
- YouTube 字幕权限：https://developers.google.com/youtube/v3/docs/captions/download
- B站开放平台：https://open.bilibili.com/doc

> 请从 `04-delivery/42-AGENT-HANDOFF.md` 的 **Sprint 0** 开始实现；不要一次性把路线图所有版本写完。
