# 模块 38｜预设问答、站内搜索和未来 AI 个人助手

## 第一版问答框（不是自由生成 AI）

`faqItems` Collection：`question`, `answer`（支持安全 RichText）, `relatedLink`, `sortOrder`, `active`, `category`, `updatedAt`。

公开首页渲染 4–8 个问题；点击显示维护过的回答，带 `查看经历/项目/知识花园` 相关链接。所有内容通过后台维护。保证访客不需要任何 API Key 就能获得准确回答。

## 搜索设计

- 第一版 `/journal` 对已发布文章的标题、标签、摘要做筛选。
- Quartz 自身负责公开知识花园搜索；不强求首期跨两个站点统一搜索。
- 后台 `Resources` 可按类型/标签/标题/个人笔记查询，遵守 private 读权限。
- 后续 v1.2 添加 Postgres FTS 与统一搜索索引；v2 才做 RAG。

## 未来 RAG 必须预留

1. `document_visibility`: `public|private`，内容提取后严格按来源权限进入不同索引。
2. 每个分段 `source_id`, `source_url`, `revision`, `deleted_at`；撤回时及时删除对应 embedding 与缓存。
3. 输出必须附可以打开的引用；无结果时承认不知道，不虚构个人经历。
4. 公共 AI 只搜索 public 数据；私人 AI 要登录鉴权，不能只靠提示词约束隔离。
5. 增加速率/费用限制与机器人滥用防护后再开放公共自由问答。

## 验收

- FAQ 后台更新后展示正确内容，不会直接发起模型请求。
- 草稿文章/私有资源永远不进入公开搜索结果。
- 未来上线 RAG 前必须完成“同问双账号”越权测试。
