# Content 工作区

此目录用于内容进入 Payload 前的整理，以及从 Payload 导出后的构建中间产物。它不是线上文章数据库。

## 唯一真源

- 正式文章、项目、FAQ、标签和站点配置：Payload CMS + PostgreSQL。
- 媒体元数据与可见性：Payload `media` Collection。
- 二进制媒体：开发环境 `media/`；生产环境 `/app/media` Docker volume；未来可切换对象存储。
- `content/` 中的 Markdown 不能绕过 Payload 直接发布。

## 目录

```text
content/
├── inbox/          本地待整理素材，默认全部忽略，禁止提交私人原文
├── exports/        Payload 导出的 Markdown，默认全部忽略
├── public-garden/  未来 Quartz 白名单构建目录，默认全部忽略
└── templates/      可提交的公开内容模板
```

## 使用流程

1. 将本人有权处理的 Markdown 放入 `content/inbox/`。
2. 人工确认版权、隐私、事实和公开范围。
3. 通过导入脚本或后台写入 Payload 草稿。
4. 在 Payload 完成审核和发布；此时数据库记录才是正式内容。
5. 需要 Markdown 时，从 Payload 导出到 `content/exports/`。
6. 只有明确标记公开的内容才能进入 `content/public-garden/`，再交给 Quartz 构建。

严禁把私人 Obsidian Vault、未脱敏医疗资料、API Key 或临时下载文件放进 Git。
