# Snorlaxden 日志中心

本目录是项目日志的统一入口，但不同日志按用途采用不同的权威存储。

## 日志位置

| 类型 | 权威位置 | 用途 | 是否进入 Git |
|---|---|---|---|
| 操作审计日志 | Payload `audit-logs` / PostgreSQL | 登录、AI 调用、草稿保存、内容创建、发布、撤回、删除 | 否 |
| AI 生成记录 | Payload `ai-generations` / PostgreSQL | Provider、模型、Prompt 版本、调用结果、关联草稿 | 否 |
| 开发日志 | `logs/development/YYYY-MM-DD.md` | 需求、实现、迁移、测试、commit 和部署痕迹 | 是 |
| 运行日志 | Docker `local` logging driver | Web、migration、seed、PostgreSQL 的启动与异常 | 否 |
| 审计导出 | `logs/runtime/audit-*.jsonl` | 排障、离线归档和备份 | 否 |

## 安全规则

- 不记录密码、Cookie、Authorization、Token、API Key 或对象存储密钥。
- 不在审计元数据中保存文章正文、AI 原始素材、Prompt 全文或模型完整输出。
- IP 地址只保存加盐 SHA-256 摘要，盐来自 `AUDIT_IP_HASH_SALT`。
- `audit-logs` 对匿名用户不可读，对管理员只读；应用层禁止更新和删除。
- 运行日志采用 10MB x 5 文件轮转，避免占满服务器磁盘。

## 查看与导出

- 后台查询：`/admin/collections/audit-logs`
- AI 调用记录：`/admin/collections/ai-generations`
- 服务器运行日志：`sudo docker compose -f compose.production.yaml logs --since 24h web migrate seed db`
- 导出审计日志：`pnpm logs:export`

导出文件只用于受控排障和备份，不提交 GitHub。生产环境的长期恢复仍以 PostgreSQL 备份为准。
