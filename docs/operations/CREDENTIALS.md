# 凭证与外部服务登记

> 本文只登记凭证用途、私密文件位置和验证状态，不保存用户名、密码、SecretId、SecretKey、Token 或完整登录 URL。

相关文档：[项目 README](../../README.md)｜[DX 与存储标准](../DX.md)｜[腾讯云私密索引](../../.secrets/tencent-cloud/README.md，仅本机存在)

## 腾讯云 COS 子账号

| 项目 | 当前值 |
|---|---|
| 用途 | Snorlaxden 私有来源材料的腾讯云 COS 专用子账号 |
| Bucket | `digital-1486267453` |
| Region | `ap-guangzhou` |
| 本机凭证文件 | `.secrets/tencent-cloud/tencent-cloud-cos-api-credentials.xlsx`；运行片段为同目录 `cos-runtime.env` |
| 服务器凭证文件 | `/home/ubuntu/Project/snorlaxden/app/.secrets/tencent-cloud/` 下的同名文件 |
| 文件权限 | `600` |
| Git/构建策略 | `.secrets/` 被 Git、Docker context 和 Next standalone 排除 |
| API 凭证 | 已写入本机与服务器 `.env`，不在本文记录真实值 |
| COS API 测试 | 2026-10-25 本机和服务器通过基础 API；2026-10-26 官方 Adapter 通过应用级 Put、Head、Get、SHA-256、Delete、删除后 404 |
| 生产存储驱动 | `cos`；local 卷保留用于按记录 driver 回滚 |

## 打通条件

1. 推荐在腾讯云 CVM 上为实例绑定仅限该 Bucket 私有前缀的最小权限 CAM 角色，避免长期 SecretKey。
2. 当前长期 API 密钥已写入本机和服务器 `.env`；不得回填到公开文档或 Git，并应建立轮换计划。
3. 权限应只覆盖 `digital-1486267453/private/source-materials/*` 所需的上传、读取、查询和删除对象操作。
4. 官方 COS SDK Adapter、Fake Client、真实应用级读写删和错误脱敏测试已经通过。
5. 生产切换前 `source-materials` 为 0 条，无历史原件需要迁移；新增记录使用 COS，历史/回滚记录仍按自身 `storageDriver` 读取。

## 轮换与事件处理

- 控制台密码与 API 密钥分开管理；控制台密码不能代替 SDK 的 SecretId/SecretKey。
- 密钥创建、轮换、禁用或删除后更新本页状态和 `logs/development/`，但不记录真实值。
- 如果凭证意外进入 Git、构建上下文、日志或截图，应立即禁用并轮换，不能只删除文件。
- `pnpm build` 完成后会自动运行 `src/scripts/sanitize-standalone.mjs`，删除并复检 `.next/standalone` 中的 `.env*` 和 `.secrets`；发现残留必须让构建失败。

## 备份加密口令

| 项目 | 当前值 |
|---|---|
| 用途 | ISSUE-012 生产数据库与持久文件备份加密 |
| 本机位置 | `.secrets/backup/backup.env` |
| 服务器位置 | `/home/ubuntu/Project/snorlaxden/app/.secrets/backup/backup.env` |
| 权限 | 目录 `700`，文件 `600` |
| Git/日志策略 | 被 Git、Docker context 与 standalone 排除；不记录真实值 |
| 恢复验证 | 2026-10-26 使用同一口令完成隔离解密和 T018 恢复 |

口令丢失后历史加密包不可恢复。轮换口令只影响新批次；历史批次应在保留期内继续保存对应旧口令，或经过受控解密、重新加密与校验流程迁移。

## SophNet 图片生成

| 项目 | 当前值 |
|---|---|
| 用途 | ISSUE-010 管理员文章封面候选图生成 |
| Provider / 模型 | SophNet / `Doubao-Seedream-5.0-pro` |
| 本机位置 | 项目 `.env`，权限 `600` |
| 服务器位置 | `/home/ubuntu/Project/snorlaxden/app/.env`，权限 `600` |
| Git/日志策略 | 只提交 `.env.example` 中的变量名；真实 Key 不进入 Git、Issue、日志、构建产物或客户端 |
| 接口验证 | 2026-10-26 文生图和参考图输入均返回成功；参考图请求回报 `input_images=1` |
| 下载边界 | 只允许固定 HTTPS 主机；禁重定向，校验大小、MIME、图片解码和 SHA-256 后转存私有 COS |

Key 轮换后必须同步更新本机和服务器 `.env`，再执行受控 production smoke；禁止把 Key 作为“网络备份”提交到 GitHub。服务端 `.env` 和生产数据库/私有 COS 是运行态保存位置，GitHub 仅保存非敏感契约与历史代码。
