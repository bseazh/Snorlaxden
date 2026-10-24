# 示例｜推荐实际代码仓库目录与模块边界

```text
hehaizhao-digital-space/
├── AGENTS.md
├── README.md
├── web/
│   ├── src/
│   │   ├── app/(public)/                # 公开网站路由
│   │   ├── app/(payload)/               # 管理后台（随官方模板变化）
│   │   ├── collections/                 # Posts/Projects/FAQ/Resources/Media/Users
│   │   ├── globals/                     # SiteSettings
│   │   ├── components/                  # Header, FAQ, PostBlocks
│   │   ├── lib/ai/                      # TextProvider/ImageProvider/PromptRegistry
│   │   ├── lib/ingestion/               # PlatformAdapter / URL normalize
│   │   ├── lib/export/                  # Markdown 导出
│   │   └── payload.config.ts
│   ├── Dockerfile
│   └── package.json
├── garden/                             # 独立 Quartz 安装
│   └── content/                        # **仅导出器产生的公开副本**
├── scripts/
│   ├── export-public-notes.mjs         # 待 Sprint3 开发
│   └── publish-garden.sh               # 待 Sprint3 开发
├── infra/
│   ├── compose.yaml
│   └── nginx/
├── docs/                                # 本文档包
└── .gitignore
```

以上是**推荐实现目录，不是已生成的业务源码**。Next.js 的实际 Route Group 名称、Payload 脚手架生成的文件需以官方版本为准，不要为了符合本示意图强行改官方结构。

## API 例子

`POST /api/internal/resources/import`: `{url, titleOverride?, notes?}`，创建 private 资源。只有合法源和管理员能调用。

`POST /api/internal/ai/article`: `{sourceMaterialId, templateKey, tone, targetLength}`，生成草稿 ID、事实清单、任务信息。未配置 Key 返回 `PROVIDER_UNAVAILABLE`，不删除源稿。

`POST /api/internal/ai/image`: `{postId, brief, aspectRatio, stylePreset}`，只生成候选 private 图片，不直接插入公开文章。

`POST /api/internal/exports/markdown`: `{type, id}`，鉴权导出本人的帖子/卡片。详见 `../02-architecture/22-API-CONTRACTS.md`。
