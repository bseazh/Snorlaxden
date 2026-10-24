# Snorlaxden DX 与存储标准

> 状态：生效  
> 最后更新：2026-10-24  
> 适用范围：代码、内容、媒体、对象存储、环境变量、数据库变更、测试和发布

DX（Developer Experience）标准的目标是让每个功能都有稳定的归属、数据只有一个权威来源、开发和生产可以用同一套规则验证。

## 1. 基本原则

1. 按业务能力组织代码，不按“工具函数大杂烩”组织。
2. 页面和 Route Handler 只负责编排输入输出，不直接实现供应商协议或复杂业务规则。
3. 正式内容只有一个权威来源；导入文件、导出文件和缓存都不是数据库替代品。
4. 私有优先：媒体、素材、AI 产物和对象存储默认 private。
5. 所有外部服务通过 Adapter/Provider 接入，业务层不得散落供应商 URL 和 API Key。
6. Schema 变更必须有迁移；生产部署必须可验证、可回滚。

## 2. 代码模块标准

```text
src/
├── app/                   Next.js 页面和 HTTP 边界
├── components/            跨页面 UI 组件
├── modules/
│   ├── ai/
│   │   ├── application/   用例编排，例如生成文章草稿
│   │   ├── domain/        类型、规则、结构校验和领域错误
│   │   ├── infrastructure/ 外部协议客户端
│   │   ├── prompts/       带版本的运行时提示词
│   │   ├── providers/      DeepSeek、StepFun 等供应商配置
│   │   └── index.ts        模块公开 API
│   └── content/
│       ├── public-queries.ts 公开内容读取
│       └── index.ts          模块公开 API
├── collections/           Payload Collection Schema
├── globals/               Payload Global Schema
├── access/                Payload 访问控制
├── fields/                可复用 Payload 字段
├── migrations/            PostgreSQL 迁移
└── scripts/               seed、导入、导出等命令入口
```

### 依赖方向

```text
app / components
      ↓
modules/*/index.ts
      ↓
application → domain
      ↓          ↑
providers / infrastructure
```

- 页面优先从 `@/modules/<name>` 导入，不能直接引用模块的 `infrastructure`。
- 模块之间通过各自 `index.ts` 公开能力，禁止跨模块读取内部文件。
- `domain` 不依赖 Next.js、Payload UI 或具体供应商 SDK。
- 只有服务端文件可以读取 API Key；环境变量不得经 props 或 JSON 响应传到浏览器。
- 一个文件只承担一个主要职责。供应商增加时新增 Provider，不复制完整生成流程。

### 命名

- 目录：小写短横线或单个小写单词。
- React 组件：`PascalCase.tsx`。
- 用例和服务：动作开头，例如 `generate-article-draft.ts`。
- Prompt：`<purpose>-v<number>.ts`，修改行为必须升版本，不能静默覆盖旧版本。
- 数据库迁移：时间戳 + 简短目的。

## 3. 内容存放标准

| 内容 | 权威位置 | 本地/生产物理位置 | 是否进入 Git |
|---|---|---|---|
| 文章 | Payload `posts` | PostgreSQL | 仅 Schema、seed 和迁移进入 |
| 项目 | Payload `projects` | PostgreSQL | 仅 Schema、seed 和迁移进入 |
| FAQ/标签/站点设置 | Payload Collections/Global | PostgreSQL | 仅 Schema、seed 和迁移进入 |
| AI 临时生成结果 | 当前仅管理员浏览器会话 | 不持久化 | 否 |
| 待导入 Markdown | `content/inbox/` | 开发者本机 | 默认忽略 |
| Markdown 导出 | `content/exports/` | 生成目录 | 默认忽略 |
| Quartz 公开副本 | `content/public-garden/` | 白名单构建目录 | 默认忽略，独立发布 |
| 品牌静态资产 | `public/images/` | 应用镜像 | 是，必须可公开且体积受控 |
| 上传媒体元数据 | Payload `media` | PostgreSQL | 否 |
| 上传媒体文件 | Storage Adapter | 当前 `media/` 或 `/app/media` | 否 |

### 文章规则

- 后台创建、AI 生成或 Markdown 导入都先进入 `draft`。
- 发布条件：事实、来源、版权、隐私和 SEO 均已人工检查。
- URL 使用稳定 `slug`；修改标题不自动修改已发布 slug。
- 正文不保存临时签名 URL；外部来源保存 canonical URL 和来源说明。
- AI 输出必须保留 `aiDisclosure=true`，且不能触发自动发布。
- 删除/撤回文章时，公开 API、sitemap、Quartz 副本和缓存必须一起失效。

### Markdown 文件规则

- UTF-8、LF 换行、文件名使用小写英文 slug。
- Front Matter 参考 `content/templates/article.md`。
- 不允许内嵌 base64 图片、脚本、iframe 或本机绝对路径。
- 附件使用逻辑引用，导入时由 Media/Storage 服务生成稳定 ID。
- `content/inbox/` 只放本人有权处理的素材，导入完成后应清理。

## 4. 媒体与对象存储标准

“OSS”在本项目中泛指对象存储。腾讯云环境优先评估 COS；实现层使用 Storage Adapter，保留 S3-compatible 接口，不让业务代码绑定单一厂商。

### 当前实现

- 本地上传目录：项目根目录 `media/`，已在 `.gitignore` 中忽略。
- 生产容器目录：`/app/media`。
- 生产持久卷：Compose `media_data`，数据库容器无法直接访问。
- 静态个人形象等公开构建资产：`public/images/`。
- 当前尚未启用 COS/OSS，不能把环境变量模板误认为已经完成接入。

### 目标 Adapter

```ts
interface StorageAdapter {
  put(input: PutObjectInput): Promise<StoredObject>
  getPrivateUrl(key: string, expiresInSeconds: number): Promise<string>
  getPublicUrl(key: string): string
  delete(key: string): Promise<void>
}
```

实现顺序：`LocalStorageAdapter` → `S3CompatibleStorageAdapter`（腾讯云 COS 或其他兼容服务）。业务模块只保存对象 `key`，不保存临时签名 URL。

### 对象 Key

```text
{visibility}/{kind}/{yyyy}/{mm}/{uuid}-{safe-name}.{ext}
```

示例：

```text
private/originals/2026/10/019f...-training-photo.jpg
public/covers/2026/10/019f...-medical-ai-workflow.webp
```

- `visibility`：`private` 或 `public`。
- `kind`：`originals`、`covers`、`attachments`、`derived`。
- 必须使用 UUID；不能只使用用户原始文件名。
- `safe-name` 只含小写 ASCII、数字和短横线。
- 派生图与原图使用不同 key，并在数据库保存父子关系。

### 权限和元数据

- Bucket 默认私有，公共文件也必须经过明确发布动作后才能提供 CDN/public URL。
- 私有文件只返回短时签名 URL；不能把 Bucket 管理凭证暴露给浏览器。
- Payload `media` 至少保存：`alt`、`purpose`、`visibility`、`licenseNote`、MIME、大小、对象 key、校验和。
- 上传前检查 MIME、扩展名、大小；图片重新解码后再生成派生尺寸。
- 删除数据库记录前先检查引用；删除对象失败时记录任务并重试，不能静默留下失联对象。
- 日志不得记录 API Key、签名 URL、私有对象正文或完整个人敏感信息。

### 环境变量命名（接入时启用）

```text
STORAGE_DRIVER=local|s3
STORAGE_ENDPOINT=
STORAGE_REGION=
STORAGE_BUCKET=
STORAGE_ACCESS_KEY_ID=
STORAGE_SECRET_ACCESS_KEY=
STORAGE_PUBLIC_BASE_URL=
```

这些变量只有完成 Adapter、迁移和回归测试后才加入 `.env.example`。真实值仅进入本机/服务器 `.env`，权限 `600`。

### 备份与迁移

- PostgreSQL 与媒体对象必须采用同一备份批次标识。
- 数据库备份不等于媒体备份；两者都要验证恢复。
- 从本地卷迁移到 COS/OSS 时先复制、校验 checksum、切读路径，观察稳定后再清理旧对象。
- 任何批量删除先生成清单并保留可恢复窗口。

## 5. API 与安全标准

- `/api/internal/**` 必须在 Route Handler 内再次验证管理员会话。
- 公开读取由 Payload access 层过滤，不能仅依赖页面隐藏。
- 输入必须限制类型、枚举、长度和数量；模型 JSON 必须白名单映射。
- 外部请求必须有超时，供应商错误映射为稳定内部错误码。
- 写操作默认幂等或提供唯一键；不得因重试创建重复文章。
- API 响应不包含服务器路径、数据库连接串、密钥或供应商原始错误详情。

## 6. 数据库与迁移标准

1. 修改 Collection/Global Schema。
2. 生成并人工审阅 migration。
3. 更新 Payload types。
4. 本地空库和已有数据各执行一次迁移验证。
5. 写明回滚方案和数据兼容范围。
6. 生产先备份，再由 `migrate` 容器执行；Web 只在迁移成功后启动。

seed 必须可重复执行，不覆盖后台已经编辑的正式内容。

## 7. 测试与提交标准

提交前至少执行：

```bash
pnpm typecheck
pnpm lint
pnpm test:int
pnpm build
```

涉及公开页面、认证、编辑器或发布流程时再执行 `pnpm test:e2e`。涉及 Provider 时使用 Mock 做稳定 E2E，再单独做一次真实供应商 smoke test，真实调用不得进入 CI。

每个提交只处理一个可描述的工作包。禁止提交 `.env`、数据库、上传媒体、私人 Markdown、Playwright 报告或构建产物。

## 8. 发布标准

```text
本地实现 → 全量检查 → Git commit → GitHub main/CI
→ 服务器同步固定 commit → 构建镜像 → migration/seed
→ 启动 Web → 本机 3999 健康检查 → HTTPS 公网检查
```

- 服务器业务代码目录固定为 `/home/ubuntu/Project/snorlaxden/app`。
- Web 固定绑定 `127.0.0.1:3999`，不占用现有 `3000`、`9000` 服务。
- 不在服务器直接修改业务代码；运行时 `.env`、数据库和媒体不回传 Git。
- 发布后验证公开路由、管理员路由、权限拒绝、日志和容器状态。
