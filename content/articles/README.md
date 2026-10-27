# 文章 Markdown 副本

AI 工作台点击“保存为文章草稿”后，会在此目录生成 `<slug>.md`。

- 本地实际位置：`content/articles/`。
- 生产容器实际位置：`/app/content-data/articles/`，由 `content_data` volume 持久化。
- 文件是 Payload 草稿的可读、可迁移副本，不是公开页面的直接数据源。
- 生成的文章文件默认被 Git 忽略，审核后如需版本管理，应通过正式导出流程处理。
- 删除 Markdown 不会删除 Payload 草稿；删除 Payload 草稿也不会自动删除 Markdown，批量清理需先核对 `generationId` 和 `payloadPostId`。
- `curated/` 保存经过人工策划、可进入版本控制的正式文章源稿；它们通过显式导入命令进入 Payload，不属于 AI 工作台自动发布链路。
