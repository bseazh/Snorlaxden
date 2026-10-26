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
