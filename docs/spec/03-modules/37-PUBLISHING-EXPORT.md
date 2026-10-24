# 模块 37｜内容发布、导出、预览与知识资产闭环

## 为什么要分离三个仓库

1. **原始私有 Obsidian Vault**：本机知识笔记的权威版本，严禁直接公开。
2. **CMS 内容仓库**：网站文章、项目、资源、AI 工作流的权威版本。
3. **Public Garden 输出仓库**：从 Obsidian 过滤后的发布副本，采用静态文件构建。

这个区分可以让“第二仓库→公开文章→再导出知识卡”自由流转而不导致双向编辑冲突。

## 发布前检查表

- 文章标题、slug、摘要/SEO/封面不为空；至少有一段人工审核正文。
- 文章引用视频或外部资料时具备来源 URL，并标识内容采用的是标题/简介还是完整合法文字。
- 真实经历/事实数字核对；AI 虚构内容删除或改为明确假设。
- AI 配图审查：是否可能被误认为真实新闻/活动现场？必要时说明为示意图。
- 附件权限：关联每个媒体 ID 均确认批准公开；私有 PDF/素材不可跟文章一起泄露。
- 无外链到 `localhost`, 内部管理后台或限时预览 URL。

## 文章发布状态

- `draft` → `ready_for_review`（业务状态）→ `published`（CMS 原生发布状态）→ `unpublished/archived`。
- 发布时记录审阅时间、审核者和版本哈希；更改已发布文章先生成草稿版本再二次发布。
- 公开端使用稳定 URL `/journal/[slug]`；旧 slug 改动需永久重定向防止死链。
- 资源卡默认不公开，仅明确 `visibility=public` 的精选资源才能进入前台（可作为 v1.1 页面功能）。

## 内容导出为 Markdown

- `posts` 转 Markdown：Frontmatter 有 `title`, `date`, `source_id`, `canonical_url`, `visibility`, `tags`, `exported_at`；正文 Markdown，图片链接采用受控相对路径或明确 URL。
- 私有 `resources` 导出：保留 `visibility: private`；不直接进入 garden-public-content。
- 导出文件名使用 slug+稳定 ID，避免中文/符号造成跨平台问题。
- 每次导出前计算 `content_hash`；如果目标存在且由用户修改，输出冲突文件或明确询问，不覆写本地笔记。

## 发布事务与失败处理

- 先保存 CMS 文章状态 → 失效缓存 → 更新 sitemap；失败支持重试且操作幂等。
- 附件 publicize 必须有引用计数/可查关系；撤回文章后先更新访问控制，再异步清理不再公开引用的副本。
- 静态 Quartz 发布通过构建新目录并原子切换软链，失败保留旧版本；撤回被批准的旧文件需确保重新全量替换而不是增量追加。
- 所有导出/发布记录 `published_at`, `artifact_hash`, `initiator`, `result`, `error`。

## 验收

- 一篇文章可发布、编辑后再发布、撤回且不留下公开草稿或私有附件。
- 文章导出后可在 Obsidian 打开，保留标题、段落、基本图片引用和来源元数据。
- 网站原始文章编辑不会静默修改本地 Obsidian 同名笔记。
- 资源卡→AI 原创草稿→公开文章有可回溯的 `source_id`。
