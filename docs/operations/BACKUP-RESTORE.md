# 生产备份、恢复与回滚手册

相关文档：[项目 README](../../README.md)｜[DX 标准](../DX.md)｜[凭证登记](CREDENTIALS.md)｜[TODO](../../TODO.md)

## 1. 数据边界

每个备份批次使用同一个 `YYYYMMDDTHHMMSSZ-<commit>` 标识，包含：

| 组件 | 备份形式 | 恢复目标 |
|---|---|---|
| PostgreSQL | `pg_dump --format=custom` | 隔离 PostgreSQL 后再决定是否切换生产 |
| Payload 公开媒体 | `media_data.tar.gz` | `app_media_data` |
| AI 草稿与私有导出 | `content_data.tar.gz` | `app_content_data` |
| local 回滚原件 | `private_media_data.tar.gz` | `app_private_media_data` |
| 公开花园 | `public-garden.tar.gz` | 重新执行公开边界检查后发布 |
| COS 私有原件 | key、大小、ETag、SHA-256 元数据清单 | 原 Bucket 或灾备 Bucket |

数据库与本地文件打包后使用 AES-256-CBC、PBKDF2-SHA256 和 200000 次迭代加密，明文临时目录在退出时清理。加密包与不含正文的 manifest 同时保留在服务器受限目录和 COS 私有 `private/backups/<batch>/` 前缀；所有对象使用 private ACL 与 `no-store`。

```text
PostgreSQL ─┐
Docker 卷 ─┼─ 同批次临时目录 ─ SHA-256 ─ 加密包 ─┬─ 服务器保留 14 天
公开花园 ─┤                                      └─ 私有 COS 备份前缀
COS 清单 ──┘
```

当前 COS 备份和原件仍属于同一腾讯云账号与 Bucket，能覆盖服务器磁盘损坏，但不能覆盖账号级或 Bucket 级灾难。达到正式业务连续性要求前，应再配置不同权限主体控制的第二 Bucket 或另一云存储，并启用对象版本控制/保留策略。

## 2. 密钥和权限

- 备份口令固定存放于服务器与运维本机 `.secrets/backup/backup.env`，目录权限 `700`、文件权限 `600`。
- 文件只包含 `BACKUP_ENCRYPTION_PASSPHRASE=...`，不得进入 Git、Issue、截图、普通日志或备份包。
- 丢失口令后加密备份不可恢复；修改口令不会重加密历史批次。
- COS、数据库与备份口令应分别轮换，不复用控制台密码。

## 3. 定时任务

```bash
sudo systemctl status snorlaxden-backup.timer snorlaxden-health.timer
sudo journalctl -u snorlaxden-backup.service -n 100 --no-pager
sudo journalctl -u snorlaxden-health.service -n 100 --no-pager
```

- 每日北京时间 03:20 执行加密备份，并增加最多 10 分钟随机延迟。
- 每 15 分钟检查 Web、DB、Web 重启次数、COS 真实私有对象读写边界、磁盘、证书和最近备份新鲜度。
- 备份超过 26 小时、磁盘可用低于 20%、证书少于 21 天或任一依赖失败时服务返回非零，状态写入 `/home/ubuntu/Project/snorlaxden/ops-state/health.json`，详细信息进入 journald。
- 当前没有用户指定的短信、邮件或企业微信接收端，因此只启用服务器本地告警状态；外部通知渠道配置前不能声称已具备无人值守告警送达。

## 4. 手动备份与隔离恢复

```bash
sudo /home/ubuntu/Project/snorlaxden/app/infra/operations/backup.sh
sudo /home/ubuntu/Project/snorlaxden/app/infra/operations/restore-drill.sh
```

恢复演练会：

1. 校验加密包 SHA-256。
2. 在临时目录解密并校验全部明文组件。
3. 启动一次性隔离 PostgreSQL 容器，不挂载生产卷。
4. 执行 `pg_restore`，核对 users、posts、projects、media、source_materials 数量。
5. 解压四类文件归档，并确认至少存在一位管理员。
6. 写入不含正文和凭证的演练报告，然后删除临时容器与明文目录。

任何一步失败都不得覆盖生产数据库、生产卷或公开花园。

## 5. 故障恢复

1. 先冻结写入并记录故障时间、当前 commit、镜像和最后有效批次。
2. 下载/选择目标批次，先执行 `restore-drill.sh <batch>`。
3. 为数据库和文件创建新的恢复卷；不要直接清空现有生产卷。
4. 在候选端口启动恢复后的服务，验证管理员登录、文章/项目、媒体、私有附件鉴权和撤回内容 404。
5. 通过后切换 Caddy 上游或 Compose 卷；保留旧卷到人工确认结束。
6. 写审计与事故记录，确认后再按保留策略清理旧数据。

## 6. 应用回滚

应用回滚和数据回滚必须分开：

```bash
sudo docker tag app-web:rollback-pre-issue013 app-web:latest
sudo docker compose -f compose.production.yaml up -d --no-deps --force-recreate web
```

- 只有数据库 schema 与旧应用兼容时才能直接回滚镜像。
- 不自动回滚数据库迁移；先从隔离恢复验证兼容性。
- `content/public-garden/` 是当前公开状态的权威副本。即使回滚应用，也不得从旧镜像或旧备份恢复已经撤回的公开笔记、附件、搜索索引或 sitemap 条目。
- 回滚后必须复验首页、`/garden`、管理员登录、T009、T019 和容器 restart count。

## 7. T020 边界

自动检查覆盖 DNS 解析、HTTPS 链路、证书域名与剩余有效期。ICP备案属于站点所有者和腾讯云控制台/工信部记录的合规事实；没有正式备案号或查询结果时，只能标记为“待所有者确认”，不能从网站可访问推断已经备案。
