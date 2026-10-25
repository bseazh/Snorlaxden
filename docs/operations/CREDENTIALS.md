# 凭证与外部服务登记

> 本文只登记凭证用途、私密文件位置和验证状态，不保存用户名、密码、SecretId、SecretKey、Token 或完整登录 URL。

相关文档：[项目 README](../../README.md)｜[DX 与存储标准](../DX.md)｜[腾讯云私密索引](../../.secrets/tencent-cloud/README.md，仅本机存在)

## 腾讯云 COS 子账号

| 项目 | 当前值 |
|---|---|
| 用途 | Snorlaxden 私有来源材料的腾讯云 COS 专用子账号 |
| Bucket | `digital-1486267453` |
| Region | `ap-guangzhou` |
| 本机凭证文件 | `.secrets/tencent-cloud/tencent-cloud-cos-subaccount-credentials.csv` |
| 文件权限 | `600` |
| Git/构建策略 | `.secrets/` 被 Git、Docker context 和 Next standalone 排除 |
| 控制台登录 | 2026-10-25 自动化提交后返回登录页，未验证成功 |
| API 凭证 | CSV 的 `SecretId`、`SecretKey` 均为空 |
| COS API 测试 | 未执行；缺少 API 凭证或 CVM 实例角色 |
| 生产存储驱动 | `local`，不得提前切换为 `cos` |

## 打通条件

1. 推荐在腾讯云 CVM 上为实例绑定仅限该 Bucket 私有前缀的最小权限 CAM 角色，避免长期 SecretKey。
2. 备选方案是为现有子用户创建一组 API 密钥，再写入本机和服务器 `.env`；不得回填到公开文档或 Git。
3. 权限应只覆盖 `digital-1486267453/private/source-materials/*` 所需的上传、读取、查询和删除对象操作。
4. 凭证就绪后必须完成 Put、Head/Get、Delete 和删除后不可读测试，再启用官方 COS SDK Adapter。
5. 真实测试通过前保持 `STORAGE_DRIVER=local`。

## 轮换与事件处理

- 控制台密码与 API 密钥分开管理；控制台密码不能代替 SDK 的 SecretId/SecretKey。
- 密钥创建、轮换、禁用或删除后更新本页状态和 `logs/development/`，但不记录真实值。
- 如果凭证意外进入 Git、构建上下文、日志或截图，应立即禁用并轮换，不能只删除文件。
- `pnpm build` 完成后会自动运行 `src/scripts/sanitize-standalone.mjs`，删除并复检 `.next/standalone` 中的 `.env*` 和 `.secrets`；发现残留必须让构建失败。
