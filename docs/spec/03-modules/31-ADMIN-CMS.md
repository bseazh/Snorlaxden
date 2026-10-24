# 模块 31｜私人管理后台与权限

## 定位

管理员用 Payload CMS 完成内容 CRUD、媒体管理、审核发布和资源收藏；第一版只有本人一个站长角色，不开发普通用户注册和多人审批。

## 后台导航

`仪表盘` · `文章 Posts` · `项目 Projects` · `预设问答 FAQ` · `资源 Resources` · `素材 Media` · `AI 生成记录 Generations` · `站点设置 Site Settings`。

## 必须建立的 Collections

1. `users`（auth）：邮箱登录，服务端会话认证；首次部署有安全创建首个管理员的流程；不提供公开注册。
2. `posts`（versions.drafts）：标题、slug、摘要、正文、封面、多图、标签、SEO、来源关联、状态、审核标记。
3. `projects`（versions.drafts）：项目背景/角色/过程/结果/反思、图文/状态、封面。
4. `faqItems`：question/answer/relatedLink/order/active。
5. `resources`：平台/原链接/平台视频 ID/标题/个人笔记/原始文字出处/可见性/解析状态/标签。
6. `sourceMaterials`：私有的活动复述、视频文字、PDF 摘要等不可变原始输入及版本。
7. `media`：附件文件名、大小、类型、储存位置、AI 来源、可见性。
8. `aiGenerations`：模型、提示词版本、消耗、状态、输出关联、错误码。
9. `tags` + `siteSettings`（Global）。具体字段参见 `../02-architecture/21-DATA-MODEL.md`。

## 后台首页（第一版）

- 统计：已发布文章数、草稿数、已收藏资源数、最近公开知识同步时间。
- 快捷按钮：`写文章`、`添加资源`、`管理 FAQ`、`查看公开站`。
- 最近编辑项目清单；需要人工审核/尚未发布的生成内容。
- 报警信息：最近一次知识同步失败、媒体容量/数据库备份异常（如接入健康状态）。

## 内容操作细节

- **新建**：创建 `draft`，不触发公开发布；保存自动更新时间。
- **预览**：管理员使用鉴权预览链接，绝不向访客暴露 Preview Token。
- **审核**：表单检查标题、正文、slug、封面版权、私密信息；确认后才发布。
- **发布**：服务器验证管理员，检查 `publishChecklist` 后修改状态，缓存失效。
- **撤回**：改回 draft/unpublished，更新 sitemap 与缓存；媒体若不再被公开文章使用，移除公开副本或禁止访客访问。
- **删除**：优先软删除/归档，设置恢复窗口；物理清理独立执行并记录日志。

## 安全要点

- 使用 Payload auth，不自行存密码；可后续加 TOTP/2FA。
- 管理 API 校验服务端身份；表单 CSRF 防护、登录限流；会话 Cookie 安全设置。
- Private Resource/Media 默认仅管理员可读，公共页面精确返回公开内容。
- Payload Local API 默认会覆盖 Access Control；在执行面向用户的操作时必须传 `overrideAccess:false` 与 `user`，或者明确完成等价的权限检查。
- 不把私人对象存储永久公开 URL 放入任何公共 JSON。

## 验收

1. 未登录 `/admin` 需要认证；登录失败受到限速。
2. 单篇文章可以保存草稿→预览→发布→撤回；撤回后公开 API 不可查询。
3. 上传 1 张本人照片（允许格式）→插入文章→发布显示；原始 EXIF 私密信息得以移除。
4. 管理员可修改个人介绍及 FAQ，无需部署新代码。
