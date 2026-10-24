# 模块 30｜个人品牌公开前台

## 模块目标

在 30 秒内完成「何海钊是谁 → 能做什么 → 有哪些成果 → 如何建立联系」的信息表达。该模块不依赖 AI API，页面在 AI、资源导入服务不可用时仍可正常访问。

## 页面/路由

| 路由 | 页面 | 数据源 | 关键交互 |
|---|---|---|---|
| `/` | 首页 | `siteSettings`, `projects`, `posts`, `faqItems` | 导航/精选卡/预设 FAQ |
| `/about` | 关于我 | `siteSettings` / `experiences`（可先简化成 RichText） | 经历时间线/下载可选公开履历 |
| `/projects` | 项目列表 | `projects` | 筛选标签/分页 |
| `/projects/[slug]` | 详情 | `projects` | 项目成果/关联文章 |
| `/journal` | 文章列表 | `posts` | 标签/时间排序/分页 |
| `/journal/[slug]` | 文章详情 | `posts` | 图文显示/相关文章 |
| `/contact` | 联系 | `siteSettings` | 邮箱/社交链接（不暴露个人秘密） |
| `/garden` | 跳转到 `garden.<domain>` | Nginx 或 Next redirect | 进入 Quartz 花园 |

## 首页页面组件（由上到下）

1. **顶部导航**：Logo/网站名称、项目、文章、知识花园、联系我；后台入口不需要显眼但可通过 `/admin` 访问。
2. **Hero**：姓名、定位短句、本人照片（可选）、两个 CTA（了解我/知识花园）；文案从配置读取。
3. **预设问答**：4–8 个按钮，点击展示经过审核的回答，附相关 URL；不提供假的任意 AI 回答。
4. **精选项目**：优先 `featured=true` + 已发布项目，最多 3 张。
5. **最新文章**：按发布时间倒序取 3–6 篇已发布内容。
6. **知识花园入口**：展示概念、最近精选公开笔记链接（v1 可以人工配置）。
7. **Footer**：联系信息、版权、合规备案信息、隐私页面链接。

## 组件划分

- `SiteHeader`, `SiteFooter`, `Hero`, `FAQQuickChat`, `FeaturedProjects`, `LatestPosts`, `KnowledgeGardenCTA`, `Breadcrumbs`, `RichTextRenderer`, `ArticleGallery`。
- 设计 Token 统一放 `src/styles/tokens.css`，图文内容不写死在组件中。
- 图片处理：CMS 生成宽度变体；使用原始 `alt`；尽量 lazy-load 非首屏图片。

## 数据查询安全

- 对每个内容集合设置 public `read` 只返回 `_status=published AND visibility=public`；`projects/posts` 默认草稿禁止游客读取。
- 不能只在前端隐藏草稿：服务端 API/Local API 访问权限必须同样过滤。
- 服务端查询 Payload Local API 时显式 `overrideAccess:false` 并传入适当会话/公开条件，注意框架默认可能跳过访问检查。
- 使用 slug 唯一索引，详情页不存在/未发布返回 404。

## SEO 与体验

- 为每页生成标题/摘要/OG 图片；创建 sitemap/robots；文章 canonical URL 稳定。
- 中文字体优先系统字体，减少外部字体访问；使用本地资源避免大陆访问不稳定。
- 动画 `<1.5s`，遵循 `prefers-reduced-motion`；全程键盘可操作。
- 默认关闭第三方追踪，未来接入分析须有隐私声明。

## 实现顺序

`网站 Layout` → `数据类型/Mock` → `列表/详情` → `Hero/FAQ` → `导航/SEO` → `响应式测试`。

## 验收用例

- 访客 30 秒内可找到身份、作品、联系入口；移动端无横向溢出。
- 草稿 URL 对游客返回 404；发布文章能被正常打开和分享。
- FAQ 答案后台编辑后前台生效；回答附有可用内部链接。
- AI API 断开时公开页面仍能正常访问。
