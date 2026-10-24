# 模块 33｜第二知识仓库 / 资源收藏 / 文档导出

## 定位

第二仓库是网站后台中**跨来源资料的资源管理层**，与 Obsidian 本地 Vault 互补而不是取代：Obsidian 擅长自由链接写作，CMS 更适合管理视频链接、文件、素材、来源、权限、生成任务和发布状态。

## 支持内容与本期动作

| 类型 | v1.0 操作 | 后续 |
|---|---|---|
| 纯文字/随手想法 | 保存、标签、转草稿、Markdown 导出 | 周报/RAG |
| B站/YouTube/视频号 | 保存链接、标题和个人评论；可选合法元数据 | 合法字幕、时间戳/章节 |
| PDF | 上传私有文件、封面/手动摘要、关联 | 文本提取/OCR/索引 |
| 书籍 | 书名/作者/来源、阅读状态、自己的笔记 | ISBN 元数据/读书模板 |
| 图片 | 私有上传、分类、关联文章 | OCR/AI 图像理解 |
| 活动 | 口述原稿、活动日期、照片、后续行动 | AI 定期复盘 |

## 后台列表布局

- 顶部：`添加资源` 按钮、搜索框、筛选器（类型/标签/私密/可公开/已处理）。
- 列表卡：缩略图/标题/来源域名/录入日期/处理状态/个人一句话收获。
- 详情：来源 URL、原始内容、个人笔记、生成知识卡、关联文章、导出按钮；明确「该内容是否已真实解析」。
- 空状态引导：粘贴链接、上传自己的文件或输入想法。

## 必须的数据语义

`resources.visibility=private` 默认；`ingestStatus`: `saved_only`（只收藏）、`metadata_ready`、`text_ready`、`card_draft`、`reviewed`、`failed`。

`sourceAccess`: `url_only|metadata|user_supplied_text|authorized_transcript|self_owned_media`。AI 输出不可超出源数据的可信度。

`resourceNote` 是站长个人理解，不直接覆盖第三方描述；`source_id` 恒定用来关联文章与知识卡。

## 搜索策略

- v1 CMS 搜索：标题/标签/手工备注/类型/日期（管理员权限过滤），Postgres GIN/trigram 可按真实需求添加。
- v1 不建全文向量索引，不承诺对未提取的 PDF/视频全文搜索。
- v1.1 开始索引已合法取得的文字；v2 才做 RAG/向量搜索。

## Markdown 导出（与 Obsidian 连接）

- 可以导出某资源为 UTF-8 Markdown，示例参见 `../06-examples/61-VIDEO-RESOURCE-EXAMPLE.md`。
- frontmatter 带 `source_id`, `resource_type`, `source_url`, `collected_at`, `visibility: private`, `exported_at`。
- `exports/resources/` 由管理员下载到本机导入 Obsidian Inbox，不能把资源自动塞入 Quartz 公开目录。
- 再次导出同一个 `source_id`：通过 ID 决定更新版本或生成冲突副本，不能静默覆盖用户已编辑的本地笔记。

## 数据采集/导入流程

`URL / 文件 / 随手记` → `校验` → `资源元数据` → `保存私密` → `[有正文才允许摘要]` → `知识卡草稿` → `人工修改` → `可选择转原创文章`。

## 验收

- 两个不同平台的资源被正确去重；同一视频含追踪参数的不同 URL 不创建多个条目。
- 无字幕时状态显示「仅收藏，未解析」，不能出现 AI 伪造“视频中提到了……”的断言。
- 从私密资源导出 Markdown 时默认 `visibility: private`；未经确认的资源无法出现在公共前台。
- 删除一张知识卡不删除原始视频链接、私人观看笔记及其来源信息。
