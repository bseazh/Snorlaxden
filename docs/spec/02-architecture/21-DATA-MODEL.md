# 数据库模型（Payload Collections / PostgreSQL）

> 本文是**逻辑数据模型**。Payload 自动派生的版本表、上传字段、关系表和认证字段随版本生成；避免手工建与 CMS 冲突的表。主键使用 Payload 生成的 ID（不要先假设一定是 UUID）。

## 1. `users` 管理员认证

- `email` unique；Payload `auth:true` 管理密码哈希及会话；`role: 'admin'`。
- 访问：游客不可查用户列表；只有已认证管理员可操作。
- 强密码、登录限速、双因素认证可后续补齐；上线最好先由反代/IP 限制后台（不替代登录）。

## 2. `posts` 博客文章

| 字段 | 类型/约束 | 说明 |
|---|---|---|
| `title` | text required | 人工可编辑 |
| `slug` | text unique, indexed | URL，公开后修改需 301 跳转 |
| `summary` | textarea | 摘要 |
| `content` | richText Lexical | 图文块（非任意 HTML） |
| `cover` | relation `media` nullable | 封面 |
| `contentType` | select | `reflection`, `essay`, `knowledge`, `project-note` |
| `tags` | hasMany relation `tags` | 标签 |
| `sourceResourceIds` | hasMany relation `resources` | 可溯源的参考资源 |
| `isFeatured` | boolean | 首页展示 |
| `publishedAt` | date nullable | 发布时生成 |
| `reviewState` | select | `editing`, `needs_review`, `approved`, `archived`（与 Payload `_status` 分开） |
| `_status` | Payload versions drafts | `draft` / `published` |
| `author` | relation `users` | 管理员 |
| `aiDisclosure` | boolean | 使用 AI 图片/大量合成内容的展示标签策略 |

`versions.drafts = true`；公开读取限定 `_status = published`。在 Payload `access.read` 中区分认证者和公众；不能让 `draft=true` 暴露给游客。

## 3. `projects` 项目案例

`title, slug, cover, overview, background, myRole, actions, results, reflections, startedAt, endedAt, links[], tags[], isFeatured, _status`；与 posts 共用媒体和 SEO 模块；初版可用 Payload richText 分节展示。

## 4. `resources` 私人知识资源卡（重点）

| 字段 | 类型/约束 | 说明 |
|---|---|---|
| `kind` | enum | `bilibili`,`youtube`,`wechat_channel`,`web`,`pdf`,`book`,`other` |
| `sourceUrl` | URL nullable | 原始来源链接（PDF 可为空） |
| `normalizedUrl` | URL nullable indexed | 归一化去跟踪参数的来源 |
| `externalId` | text nullable | BV / video ID 等，组合去重 |
| `title` | text required | 自动拉取失败可手填 |
| `creator` | text nullable | 原作者 / 频道 |
| `description` | text nullable | 来源介绍，仅合法获得 |
| `myNotes` | richText | 站长观看后的原创笔记 |
| `transcriptText` | longText private nullable | **仅有权限使用时**的字幕/文字 |
| `transcriptOrigin` | enum | `none`,`manual`,`authorized_api`,`owned_media_asr` |
| `extractionStatus` | enum | `link_only`,`metadata_ready`,`text_ready`,`failed` |
| `sourceFetchedAt` | date nullable | 来源数据获取时间 |
| `knowledgeSummary` | richText | 审核过的个人知识卡 |
| `tags` | relation | 标签 |
| `visibility` | enum | **默认 `private`**；`review`, `public` |
| `licenseNote` | textarea | 授权/版权状况说明 |
| `sourceMedia` | relation media nullable | 已获授权上传的文件 |

`sourceUrl` 原始值供审计，但永远只向安全经过校验的 URL 进行请求；一条资源可关联多篇文章。`kind+externalId` 可尝试唯一去重，对通用链接采用 normalizedUrl + 用户判断。

## 5. `media` 图片/附件

Payload upload collection，补充 `purpose` (`original_photo`,`ai_image`,`pdf`,`thumbnail`,`other`)、`visibility` (`private` 默认 / `public`)、`sourceResource`、`licenseNote`、`generatedById`、`alt`、`imageWidth/height`（由上传自动处理）、`storageKey`、`sha256`。私有上传不得使用公共静态目录无鉴权直链。

## 6. `faqItems` & `siteSettings`

- `faqItems`: `question`, `answer`, `sortOrder`, `relatedUrl`, `enabled`, `_status`（可选），网站只取可用的预设答案。
- 全局 `siteSettings`: `displayName`, `tagline`, `bioShort`, `bioLong`, `contactEmail`, `socialLinks[]`, `heroMedia`, `seoTitle`, `seoDescription`, `gardenUrl`, `icpNumber`（若适用）。
- `tags`: `name`, `slug`, `description`，唯一 slug、避免大小写重复。

## 7. `sourceMaterials` 原始口述/输入

`kind` (`typed`,`voice_transcript`,`uploaded_text`), `text`, `mediaIds[]`, `sourceDate`, `privacy:'private'`, `author`, `linkedPost`, `createdAt`。当站长明确删除原始材料时，应能清理引用和存储。不要把原始素材写入公开文章元信息。

## 8. `aiGenerations`（至少要保留记录结构）

`kind` (`article`,`image`,`resource_summary`,`image_brief`), `status` (`queued`,`running`,`succeeded`,`failed`,`cancelled`), `inputRefType`, `inputRefId`, `outputPostId`, `outputMediaIds[]`, `provider`, `model`, `promptKey`, `promptVersion`, `inputHash`, `rawErrorCode`, `tokenOrUnitUsage`, `estimatedCost`, `requestedBy`, `createdAt`, `finishedAt`, `retryCount`。不要持久化 API Key；敏感 prompt 与原文需权限隔离和保留策略。

v1 可以只留 records、同步执行少量任务；v1.1 可把任务队列扩展为 `aiJobs`，且应保证唯一幂等键 `requester + jobType + inputHash + promptVersion`。

## 9. `knowledgeExports`（可选）

用于记录 CMS 导出的 MD：`contentType`, `contentId`, `exportedAt`, `markdownSha256`, `fileName`, `formatVersion`, `status`。不要把这个表作为“已成功同步本地 Obsidian”的证据：只有站长手动导入后才算完成。

## 10. 索引与约束

- `posts.slug`, `projects.slug`, `tags.slug`: unique；`posts._status+publishedAt`: 列表查询。
- `resources.visibility`, `resources.kind`, `resources.normalizedUrl`: 管理视图与去重。
- `aiGenerations.status+createdAt`: 后台任务和超时恢复。
- 删除 Media 前检查资源/文章引用（禁止误删或软删除）；删除资源时仅解除引用，不级联删除公开文章。
- 数据库迁移在 CI 或部署前备份并测试；不得在生产直接运行破坏性 `push`。

## 11. 访问矩阵

| Collection | 访客 read | 访客 write | 管理员 read/write |
|---|---|---|---|
| posts / projects | 仅 published | 否 | 是 |
| faqItems / siteSettings | 仅启用且公开字段 | 否 | 是 |
| resources | 仅 visibility=public 的白名单字段 | 否 | 是 |
| media | 仅 public 且有鉴权安全 URL | 否 | 是 |
| sourceMaterials / aiGenerations / users | 否 | 否 | 是 |

Payload `Local API` 在服务器内部可能默认 `overrideAccess:true`；自定义 API 的读写必须显式认证和过滤，必要时 `overrideAccess:false` 并传入用户上下文。
