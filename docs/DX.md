# Snorlaxden DX 与存储标准

> 状态：生效
> 最后更新：2026-10-26
> 适用范围：代码、内容、媒体、对象存储、环境变量、数据库变更、测试和发布

DX（Developer Experience）标准的目标是让每个功能都有稳定的归属、数据只有一个权威来源、开发和生产可以用同一套规则验证。

凭证位置、验证状态与轮换规则统一登记在 [凭证与外部服务登记](operations/CREDENTIALS.md)；真实值只能进入被 Git 忽略的 `.secrets/` 或权限为 `600` 的 `.env`。

## 1. 基本原则

1. 按业务能力组织代码，不按“工具函数大杂烩”组织。
2. 页面和 Route Handler 只负责编排输入输出，不直接实现供应商协议或复杂业务规则。
3. 正式内容只有一个权威来源；导入文件、导出文件和缓存都不是数据库替代品。
4. 私有优先：媒体、素材、AI 产物和对象存储默认 private。
5. 所有外部服务通过 Adapter/Provider 接入，业务层不得散落供应商 URL 和 API Key。
6. Schema 变更必须有迁移；生产部署必须可验证、可回滚。
7. 公开页面视觉变更必须定义任务成功标准，并至少验证桌面、390px 手机、键盘/屏幕阅读器状态、减少动态效果、图片加载和横向溢出；“更漂亮”不能替代可读性与入口可发现性。

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
│   ├── ai-images/
│   │   ├── domain.ts       图片任务输入、候选图结构和稳定错误码
│   │   ├── provider.ts     SophNet 协议、临时 URL 白名单与图片校验
│   │   ├── storage.ts      Local/COS 私有候选图 Adapter
│   │   ├── service.ts      限额、幂等、重试、人工选图和草稿绑定
│   │   └── prompts/        版本化文章封面 Prompt
│   └── content/
│       ├── public-queries.ts 公开内容读取
│       └── index.ts          模块公开 API
│   └── resources/
│       ├── domain.ts         类型、可见性和稳定错误码
│       ├── normalize-resource-url.ts 安全 URL 规范化
│       └── resource-service.ts 管理员收藏用例
│   └── source-materials/
│       ├── domain.ts         文件类型、大小和错误边界
│       ├── storage.ts        Local/COS 私有存储 Adapter
│       ├── source-material-service.ts 上传、去重和元数据落库
│       └── markdown-export.ts 私有 Markdown 导出
│   └── public-garden/
│       ├── domain.ts         白名单、生成 manifest 和稳定错误类型
│       ├── exporter.ts       路径校验、Markdown 净化和原子全量导出
│       └── payload-export.ts 管理员操作与审计适配
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
| 资源、短记和来源关系 | Payload `resources` | PostgreSQL，仅管理员可见 | 仅 Schema、测试和迁移进入 |
| 来源材料元数据与关系 | Payload `source-materials` | PostgreSQL，仅管理员可见 | 仅 Schema、测试和迁移进入 |
| 私有 PDF/图片原件 | Private Storage Adapter | 本地 `.private-files/`；生产 `/app/private-files/` | 否 |
| FAQ/标签/站点设置 | Payload Collections/Global | PostgreSQL | 仅 Schema、seed 和迁移进入 |
| AI 生成记录 | Payload `ai-generations` | PostgreSQL，仅管理员可见 | 否 |
| AI 图片任务 | Payload `ai-image-generations` | PostgreSQL，仅管理员可见 | 否 |
| AI 私有候选图 | Image Candidate Storage | `private/ai-image-candidates/`，生产为 COS | 否 |
| 操作审计日志 | Payload `audit-logs` | PostgreSQL，管理员只读 | 否 |
| 开发日志 | `logs/development/` | Git 工作区和 GitHub | 是 |
| 运行日志导出 | `logs/runtime/` | 本地或服务器受控目录 | 否 |
| AI 保存的 Markdown 草稿 | Payload `posts` 草稿为权威；Markdown 为审阅副本 | 本地 `content/articles/`；生产 `/app/content-data/articles/` | 默认忽略正文 |
| 待导入 Markdown | `content/inbox/` | 开发者本机 | 默认忽略 |
| Markdown 导出 | `content/exports/` | 生成目录 | 默认忽略 |
| 公开花园副本 | `content/public-garden/` | `/garden` 唯一读取的白名单构建目录 | 默认忽略，生产挂载 |
| 品牌静态资产 | `public/images/` | 应用镜像 | 是，必须可公开且体积受控 |
| 文章缺省主题封面 | `public/images/article-covers/` | 应用镜像 | 是，必须原创或有明确公开授权，不得包含密钥/私人素材 |
| 上传媒体元数据 | Payload `media` | PostgreSQL | 否 |
| 上传媒体文件 | Storage Adapter | 当前 `media/` 或 `/app/media` | 否 |

### 文章规则

- 公开站 Header 与 Footer 必须保留“管理入口”，统一指向受保护的 `/manage`；匿名访问跳转 Payload 登录，登录后可从创作中心到达 `/studio`、`/library`、`/studio/images`、文章列表和完整后台。
- 后台创建、AI 生成或 Markdown 导入都先进入 `draft`。
- AI 调用按管理员和 UTC 自然日计数，默认上限为 20，可用 `AI_DAILY_LIMIT` 调整；成功与失败调用都计入记录和额度。
- AI 生成成功后不会自动写入文章。管理员必须显式点击“保存草稿”，系统才同时创建 Payload draft 和 Markdown 工作副本。
- 来源工作流只能装配当前管理员有权使用的文字：Resource 与 SourceMaterial 都必须属于当前管理员；Resource 还须标记为用户提供文字、授权转录或本人媒体且包含个人笔记，SourceMaterial 须包含个人笔记或已授权原文。原始文件字节不得发给模型。
- 模型输入必须以“个人笔记、来源说明、已授权原文、授权依据”分区；来源说明只用于出处背景，不能直接当作已证实事实。
- ISSUE-014 固定使用事实包、文章草稿两步流程。事实步骤成功后立即持久化；草稿步骤失败时重试只能继续草稿步骤，不能重复消耗已成功步骤。
- `ai-generations` 状态集合为 `queued/running/succeeded/failed/cancelled/saved_as_draft`，并保存 `currentStep`、`retryCount` 和 `modelCallCount`。每日限额按 `modelCallCount` 求和，而不是按任务条数估算。
- 生成任务必须保留所选 Resource/SourceMaterial 关系；保存 Post 草稿时同步写入 `sourceResources` 和 `sourceMaterials`，便于人工溯源。
- 发布条件：事实、来源、版权、隐私和 SEO 均已人工检查。
- 文章草稿可以暂时没有 `cover`，但正式发布前应由管理员选择一张横向封面并检查裁切、替代文字、授权和 AI 标识；前台缺图降级不能代替发布审核。
- 首页、文章列表和详情只能通过共享 `PostCover` 规则读取封面：已发布 Payload Media 优先，缺图时按内容类型使用 `public/images/article-covers/` 的原创主题配图，并向访客明确标记“主题配图”。
- URL 使用稳定 `slug`；修改标题不自动修改已发布 slug。
- 正文不保存临时签名 URL；外部来源保存 canonical URL 和来源说明。
- AI 输出必须保留 `aiDisclosure=true`，且不能触发自动发布。
- 图片只能从本人文章 draft 发起；参考图必须是当前管理员拥有、本人原创或明确获授权的私有图片 SourceMaterial。
- 图片 Provider 默认不得接收 PDF、来源正文、私人笔记或任意附件；当前只传文章标题/摘要、人工视觉要求、版本化角色约束和单张合法参考图。
- Provider 返回 URL 只能使用 HTTPS 与显式主机白名单；禁止跟随重定向，下载后必须检查 15MB 上限、MIME、真实图片解码、尺寸与 SHA-256，再写入私有存储。
- 候选图不得成为 Media 或公开 URL。只有管理员显式选择后才创建 `visibility=private` 的 Media、绑定 draft 并保留 AI 元数据；发布仍是独立人工动作。
- 图片调用按真实 `generationCallCount` 计入每日限额；相同用户、文章、参考图、参数和 Prompt 版本在 10 分钟窗口内使用幂等键复用任务。重试只补未完成数量，不重复生成已成功候选。
- 公开 AI 助手只允许读取匿名访问控制可见的站点设置、已启用 FAQ、已发布文章和已发布项目；禁止使用 `overrideAccess` 获取知识上下文。
- 公开助手的预设问答直接读取 FAQ，不调用模型；自由问答按 IP 摘要限额，回答必须返回站内公开引用。
- 公开助手审计只保存问题 SHA-256、字符数、模型、引用数和结果，不保存完整问题、回答或对话历史。
- 删除/撤回文章时，公开 API、sitemap、Quartz 副本和缓存必须一起失效。

### Markdown 文件规则

- UTF-8、LF 换行、文件名使用小写英文 slug。
- AI 草稿统一存放为 `content/articles/<slug>.md`；生产容器映射到持久卷 `/app/content-data/articles/<slug>.md`。
- `content/articles/` 不承担发布控制。公开读取只认 Payload `posts` 中 `_status=published` 的记录。
- `content/articles/curated/` 是可以进入 Git 的人工策划正式源稿；必须经过显式导入脚本、发布门禁和审计，不能被 AI 工作台自动发布。
- 发布文章必须具有公开 Media 封面、alt、授权说明、SEO 标题/描述/图片。AI 封面还必须具有生成记录、Provider、模型和 Prompt 版本；草稿阶段不强制这些字段。
- Front Matter 参考 `content/templates/article.md`。
- 不允许内嵌 base64 图片、脚本、iframe 或本机绝对路径。
- 附件使用逻辑引用，导入时由 Media/Storage 服务生成稳定 ID。
- `content/inbox/` 只放本人有权处理的素材，导入完成后应清理。
- 来源材料导出固定进入 `content/exports/source-materials/`，资源导出进入 `content/exports/resources/`；两者默认 `visibility: private`，都不是公开花园输入。
- 私有导出正文固定分为“个人笔记、来源说明、授权说明、已授权文字”四区；空区保留明确标记，禁止把个人推断伪装成来源原文。
- 已存在的同名导出文件不得静默覆盖；内容变化时生成 `.conflict-<timestamp>.md` 供人工合并。

### 公开花园导出规则

- 私人 Vault 必须位于 Git 仓库和服务器之外；公开花园读取器只能读取 `content/public-garden/manifest.json` 点名且 checksum 匹配的生成副本。
- 实际白名单 manifest 视为本地受控配置，不提交 Git。仓库中的 `content/templates/public-garden-manifest.json` 只用于说明 schema。
- `/garden`、搜索、标签、反向链接和 sitemap 使用同一个 manifest 索引，不允许另建绕过白名单的扫描器。附件只能通过 `/garden/files/*` 动态路由读取，并再次验证 manifest、路径和 SHA-256。
- 页面按请求读取当前原子目录，导出成功后调用 `revalidatePath('/garden', 'layout')`；附件响应固定 `public, no-store, max-age=0`。撤回后旧页面、附件、搜索和 sitemap 必须在同一版本消失。
- 生产通过只读边界清晰的 bind mount 将服务器 `content/public-garden/` 挂载到容器 `/app/public-garden`；不得把私人 Vault 或 `content/exports/` 挂进 Web 容器。
- 笔记必须同时满足 manifest 点名、`publish: true`、`visibility: public`；未公开笔记引用统一降级为不含原标题和路径的 `[非公开笔记]`。
- 附件必须在 manifest 逐项声明来源、公开目标、授权依据和预期 SHA-256；内容 magic bytes 只允许 PDF、JPEG、PNG、WebP、AVIF。
- 拒绝 `..`、绝对路径、反斜杠路径、隐藏目录、不安全协议、原始 HTML 文件引用、symlink 和引用式本地 Markdown 链接。
- 只保留 `title`、`publish`、`visibility`、`description`、`date`、`tags` 公开 frontmatter，避免自定义私有字段进入副本。
- 导出先写同磁盘临时目录，生成文件 checksum、来源内容指纹、附件引用和授权 manifest，再原子替换旧目录；公开 manifest 不保存私人 Vault 路径，失败保留最后一个有效版本。
- 全量替换负责撤回清理，不做增量追加。审计失败时恢复旧目录；审计元数据只含数量、错误码和清理数量，不含正文或私人来源路径。

### 资源库规则

- `resources` 是收藏、个人短记和来源关系的权威位置，实际数据只进入 PostgreSQL，不保存到仓库中的 `md` 目录。
- 所有资源默认 `visibility=private`；`review` 表示待审核，`public` 只表示公开候选。ISSUE-005 没有匿名读取接口，也不会进入公开 AI 知识源。
- `notes` 只保存个人判断；第三方原始描述放入 `sourceDescription`，两者禁止混写成“AI 已看过来源”的误导表达。
- URL 只允许 `http:` 和 `https:`，禁止凭据、localhost、环回、内网、链路本地及云元数据目标。Bilibili、YouTube 使用平台 ID 生成 canonical URL 和唯一 `sourceKey`，其余网页按清理跟踪参数后的 URL 去重。
- 仅保存 URL 时必须保持 `ingestStatus=saved_only` 与 `sourceAccess=url_only`，不得声称已经解析、观看或理解内容。
- `/library` 与 `/api/internal/resources` 都必须验证管理员会话；资源创建、修改和删除写入审计日志，但日志不得包含私人笔记或来源正文。
- PDF/图片由 `source-materials` 管理，不能在资源 URL 收藏逻辑中暗中抓取或缓存；一条材料可显式关联资源、文章和项目。

## 4. 媒体与对象存储标准

“OSS”在本项目中泛指对象存储。腾讯云环境优先评估 COS；实现层使用 Storage Adapter，保留 S3-compatible 接口，不让业务代码绑定单一厂商。

### 当前实现

- 公开站图片仍使用 Payload `media`：本地 `media/`，生产 `/app/media` 和 `media_data`。
- 私有来源原件使用独立 `PrivateStorageAdapter`：本地 `.private-files/`，生产 `/app/private-files` 和 `private_media_data`。
- 私有对象只通过 `/api/internal/source-materials/:id/download` 下载；先验证管理员，再按数据库 object key 读取。成功、拒绝与失败响应都使用 `private, no-store`。
- 上传只接受文件头与声明 MIME 一致的 PDF、JPEG、PNG、WebP、AVIF，单文件最多 10MB；SHA-256 唯一索引和上传前查询共同阻止重复文件。
- 静态个人形象等公开构建资产：`public/images/`。
- 腾讯云 COS Bucket 为 `digital-1486267453`、Region 为 `ap-guangzhou`；官方 SDK Adapter 与应用级真实读写删回归均已完成，生产使用 COS。生产切换前 `source-materials` 为 0 条，无历史对象需要复制；local 卷与按记录 driver 的双轨读取继续保留用于回滚。

### 目标 Adapter

```ts
interface PrivateStorageAdapter {
  put(input: PutObjectInput): Promise<StoredObject>
  read(key: string): Promise<Uint8Array>
  delete(key: string): Promise<void>
}
```

当前同时实现 `LocalPrivateStorageAdapter` 与基于腾讯云官方 `cos-nodejs-sdk-v5` 的 `COSPrivateStorageAdapter`，不自写签名协议。COS 上传强制 private ACL、`private, no-store`、MIME 和 SHA-256 元数据，上传后以 HEAD 核对大小与校验和；失败执行受控清理，删除失败重试一次。SDK 原始错误不会进入响应或日志。业务模块只保存对象 `key` 和实际 driver，不保存临时签名 URL。

### 对象 Key

```text
private/source-materials/{yyyy}/{mm}/{uuid}.{ext}
```

示例：

```text
private/source-materials/2026/10/019f....pdf
```

- 来源材料 object key 永远以 `private/source-materials/` 开头，并使用服务端 UUID；原文件名只作为受控下载名元数据。
- Adapter 必须拒绝 `..`、绝对路径、格式外 key 和符号链接，不能依赖用户提交的路径。

### 权限和元数据

- Bucket 默认私有，公共文件也必须经过明确发布动作后才能提供 CDN/public URL。
- 当前私有文件由应用鉴权后流式/字节响应；未来 COS 可由应用代理或生成单次短时签名 URL，但签名 URL不能落库、进日志或进入 Markdown。
- Payload `source-materials` 保存 MIME、字节数、SHA-256、object key、实际 driver、授权依据、授权说明和来源信息。
- 上传前检查 MIME、magic bytes 和大小；不能仅信任扩展名或浏览器 Content-Type。
- 删除数据库记录前先检查引用；删除对象失败时记录任务并重试，不能静默留下失联对象。
- 日志不得记录 API Key、签名 URL、私有对象正文或完整个人敏感信息。

### 环境变量命名（接入时启用）

```text
STORAGE_DRIVER=local|cos
STORAGE_LOCAL_DIR=.private-files
COS_BUCKET=digital-1486267453
COS_REGION=ap-guangzhou
COS_SECRET_ID=
COS_SECRET_KEY=
AI_IMAGE_ENABLED=false
AI_IMAGE_PROVIDER=sophnet
AI_IMAGE_BASE_URL=https://www.sophnet.com/api/open-apis/projects/easyllms/imagegenerator
AI_IMAGE_API_KEY=
AI_IMAGE_MODEL=Doubao-Seedream-5.0-pro
AI_IMAGE_DOWNLOAD_HOSTS=ark-acg-cn-beijing.tos-cn-beijing.volces.com
AI_IMAGE_DAILY_LIMIT=8
```

Bucket 名和 Region 可进入模板；真实凭证只进入本机/服务器 `.env`，权限 `600`。缺任意 COS 必需配置时 Adapter 快速失败并使用不含凭证的受控错误。生产已通过真实 Put、Head、Get、checksum、Delete、删除后 404 与 T019 后切换为 `STORAGE_DRIVER=cos`。

完整凭证备份固定存放在 `.secrets/tencent-cloud/tencent-cloud-cos-api-credentials.xlsx`，COS 运行片段存放在同目录 `cos-runtime.env`，文件权限均为 `600`、目录权限为 `700`；服务器使用 `/home/ubuntu/Project/snorlaxden/app/.secrets/tencent-cloud/` 对应目录。`.secrets/` 必须同时被 `.gitignore`、`.dockerignore` 和 Next standalone 输出追踪排除。控制台 `Password` 不能填写到 `COS_SECRET_KEY`，只有腾讯云 API 密钥或实例角色临时凭证可供 SDK 使用。

由于 Next standalone 可能主动复制 dotenv 文件，`pnpm build` 必须在编译后执行 `src/scripts/sanitize-standalone.mjs`，删除并复检产物内所有 `.env*` 和 `.secrets`；不能只依赖 `.dockerignore` 或 tracing exclude。

### 备份与迁移

- PostgreSQL 与媒体对象必须采用同一备份批次标识。
- 数据库备份不等于媒体备份；两者都要验证恢复。
- 从本地卷迁移到 COS/OSS 时先复制、校验 checksum、切读路径，观察稳定后再清理旧对象。
- 任何批量删除先生成清单并保留可恢复窗口。
- 生产 `infra/operations/backup.sh` 使用 commit 参与批次 ID，同时保存 PostgreSQL custom dump、三个持久卷、公开花园和 COS 私有来源对象清单；明文组件逐项 SHA-256 后才进入加密包。
- 备份完成的判据是本地加密包、manifest、COS 私有副本均通过校验后再写 `SUCCESS`；缺少成功标记的目录不是有效备份，失败时自动清理。
- `restore-drill.sh` 只允许固定备份根目录和受控批次名，在一次性 PostgreSQL 容器及临时目录恢复；不得直接写生产卷。
- 首次 T018 于 2026-10-26 通过。每日备份不替代月度恢复演练；恢复报告不得包含表正文、用户邮箱、密钥或签名 URL。
- COS 原件和加密备份仍在同一账号/Bucket，只算异机副本，不算独立故障域；后续需要第二 Bucket 或跨云副本。

## 5. API 与安全标准

- `/api/internal/**` 必须在 Route Handler 内再次验证管理员会话。
- 私有附件下载必须先认证、后查 ID；匿名请求统一 401，不通过记录是否存在泄露枚举信息。
- 私有下载必须设置 `Cache-Control: private, no-store`、`Pragma: no-cache`、`Vary: Cookie, Authorization` 与 `X-Content-Type-Options: nosniff`。
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

历史回滚只允许在一次性隔离 PostgreSQL 中验证：运行 `pnpm test:migrations` 完成全部 migration 的 `up → down → up`，脚本结束后自动销毁容器。严禁在生产数据库执行历史 down。

seed 必须可重复执行，不覆盖后台已经编辑的正式内容。

## 7. 测试与提交标准

提交前至少执行：

```bash
pnpm typecheck
pnpm lint
pnpm test:int
pnpm test:migrations
pnpm build
```

涉及公开页面、认证、编辑器或发布流程时再执行 `pnpm test:e2e`。涉及 Provider 时使用 Mock 做稳定 E2E，再单独做一次真实供应商 smoke test，真实调用不得进入 CI。

视觉改动使用 Impeccable 的 audit/adapt/polish 原则，但保留项目既有视觉身份；其 vendored scripts 不进入 ESLint 扫描。Playwright 视觉基线固定为 1440×1000 与 390×844，覆盖首页、文章、项目、AI 助手、管理登录边界及展开的手机菜单。CI 中图片加载失败、横向滚动、页面脚本错误或超过容差的像素漂移均失败。

生产 AI smoke 使用 `src/scripts/issue014-production-smoke.ts`：只创建带唯一标识的临时 Resource、AI generation 和 Payload draft，验证事实包、调用次数、draft 状态和来源关系后在 `finally` 清理正文数据及 Markdown；审计事件保留。不得把此脚本改成自动发布或打印私有正文。

图片生产 smoke 使用 `src/scripts/issue010-production-smoke.ts`：创建临时文章 draft，使用已入库的私有人物参考 SourceMaterial 完成一次真实 SophNet 调用，验证 `inputImages=1`、幂等回放不增加调用次数、候选图进入私有 COS、人工选择后 Media 仍为 private 且文章仍为 draft。临时候选对象、任务、Media 和文章在 `finally` 清理，固定人物参考资产保留；脚本不得打印 Prompt、临时 URL 或密钥。

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

## 9. 日志与审计标准

所有日志位置统一从 `logs/README.md` 查找，禁止在项目中再创建用途不明的散落日志目录。

### 操作审计

- 登录/退出、AI 调用与限额拒绝、AI 草稿保存，以及内容创建、修改、发布、撤回、删除必须写入 `audit-logs`。
- 审计记录只能由服务端内部创建；管理员只读，REST、GraphQL 和 Local API 均不得通过访问控制更新或删除。
- 每条记录包含 action、outcome、actor、resource、requestId、时间和受控 metadata。
- 客户端 IP 不保存明文，只保存由 `AUDIT_IP_HASH_SALT` 加盐的 SHA-256 摘要。
- 禁止把 Authorization、Cookie、密码、Token、API Key、正文、原始素材、Prompt 和完整模型输出写入 metadata。

### 开发与部署日志

- 每个完整工作包在 `logs/development/YYYY-MM-DD.md` 记录需求、关键决策、迁移、测试、commit 和部署结果。
- Git commit 是代码修改的最终逐行历史；开发日志用于解释为什么修改和如何验收，不能替代 commit。
- Docker `web`、`migrate`、`seed`、`db` 统一采用 `local` driver，单文件 10MB，最多 5 个文件。
- 需要离线归档时运行 `pnpm logs:export`，输出 JSONL 到 `logs/runtime/`；该目录禁止提交 Git。
