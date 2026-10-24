# Snorlaxden 数字花园

Snorlaxden 是何海钊的个人数字空间：公开个人品牌站、文章与项目、可控公开的 Obsidian 知识花园、私人资源库，以及后续可选的 AI 创作辅助。

**Sprint 0 和 Sprint 1 已完成**。项目已经具备管理员访问控制、内容模型、草稿/发布/撤回、首批项目与文章、响应式公开站和 SEO。下一阶段为 **Sprint 2：第二知识仓库（P0）**。执行状态、依赖与验收项统一记录在 [TODO.md](TODO.md)。

生产站运行在 https://blog.snorlaxden.fun，后台入口为 https://blog.snorlaxden.fun/admin。

## 技术栈

- Node.js `22.23.4`（本机最低兼容 `20.18.1`）
- pnpm `10.x`
- Next.js `16.3.3`
- Payload CMS `3.91.0`
- PostgreSQL `17`
- Docker Compose
- Quartz：Sprint 3 引入，不直接读取私人 Obsidian Vault

依赖使用精确版本和 lockfile。Payload `3.92.0` 已提高 Node 最低版本，本项目暂时锁定 `3.91.0`，升级前必须重新执行完整检查。

## 本地运行

前置条件：Node、pnpm 和 Docker Desktop。

```bash
git clone https://github.com/bseazh/Snorlaxden.git
cd Snorlaxden
cp .env.example .env
```

为 `PAYLOAD_SECRET` 生成随机值，并在本机 `.env` 中填写；真实 `.env` 已被 Git 忽略，禁止提交。

```bash
openssl rand -hex 32
pnpm install --frozen-lockfile
pnpm dev:db
pnpm dev
```

访问：

- 网站：`http://localhost:3000`
- Payload 后台：`http://localhost:3000/admin`

第一次打开后台时创建本地管理员。开发账户和数据库不得直接用于生产环境。

首次安装或 schema 更新后执行迁移和首批内容导入：

```bash
pnpm payload migrate
pnpm seed
```

`pnpm seed` 仅在首批内容不存在时写入个人资料、3 个项目、3 篇文章和 6 个 FAQ。生产 Compose 会在 Web 启动前按顺序运行 migration 与 seed。

停止本地数据库：

```bash
pnpm dev:db:down
```

## 环境变量与密钥

真实密钥只允许存在于本机和服务器的 `.env`，权限应为 `600`。仓库只提交 `.env.example`。

| 变量 | 用途 | 当前阶段 |
|---|---|---|
| `DATABASE_URL` | Payload PostgreSQL 连接 | 已使用 |
| `PAYLOAD_SECRET` | Payload 会话及签名 | 已使用 |
| `NEXT_PUBLIC_SERVER_URL` | 站点公开地址 | 已使用 |
| `STEPFUN_API_KEY` | 阶跃星辰服务端密钥 | 已保存，尚未接入 |
| `STEPFUN_BASE_URL` | `https://api.stepfun.com/v1` | 已配置 |
| `STEPFUN_MODEL` | 阶跃星辰模型，可按账号权限调整 | 已配置 |
| `DEEPSEEK_API_KEY` | DeepSeek 服务端密钥 | 已保存，尚未接入 |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | 已配置 |
| `DEEPSEEK_MODEL` | DeepSeek 模型，可按账号权限调整 | 已配置 |
| `AI_*_ENABLED` | AI 能力开关 | 默认全部关闭 |

AI 密钥不会使用 `NEXT_PUBLIC_` 前缀，也不会发送到浏览器。按照产品规格，AI 接入属于 Sprint 4；在 Provider、Schema 校验、额度限制和审计记录完成前，功能开关保持关闭。

官方 API 文档：

- 阶跃星辰 Chat Completions：https://platform.stepfun.com/docs/zh/api-reference/chat/chat-completion-create
- DeepSeek API：https://api-docs.deepseek.com/

## 开发、GitHub 与服务器流程

项目采用这一条发布链路：

```text
本地开发和测试
  -> Git commit / push
  -> GitHub main
  -> 服务器拉取固定 commit
  -> Docker Compose 构建
  -> Caddy 反向代理
```

不要直接在生产服务器改业务代码。服务器只保存运行时 `.env`、数据库和媒体数据，这些内容都不进入 GitHub。

服务器部署位置：

```text
/home/ubuntu/Project/snorlaxden/app
```

服务器已经运行 systemd Caddy，因此本项目生产 Web 服务固定绑定 `127.0.0.1:3999`，本地开发仍使用 `3000`。正式访问链路为 `blog.snorlaxden.fun -> Caddy -> 127.0.0.1:3999`；`3999` 只用于服务器本机健康检查。域名接入将 `infra/Caddyfile.snorlaxden` 合并到服务器现有 `/etc/caddy/Caddyfile`，不覆盖其他站点，也不启动第二个公网反向代理。

生产镜像通过腾讯云镜像代理 `mirror.ccs.tencentyun.com` 拉取，并在 `Dockerfile` 与 `compose.production.yaml` 中固定镜像摘要，避免 Docker Hub 连接超时及镜像标签漂移。

生产部署命令：

```bash
cd /home/ubuntu/Project/snorlaxden/app
git pull --ff-only origin main
docker compose -f compose.production.yaml up -d --build
```

生产 `DATABASE_URL` 的主机名必须使用 Compose 服务名 `db`，不能使用 `127.0.0.1`。

## 质量检查

```bash
pnpm typecheck
pnpm lint
pnpm test:int
pnpm build
```

端到端测试需要先启动数据库和应用，并安装 Playwright 浏览器。GitHub Actions 当前执行依赖安装、类型检查和 lint；数据库集成测试会在后续 CI 工作包中加入隔离的 PostgreSQL service。

## 目录

```text
src/                         Next.js 与 Payload 源码
tests/                       集成测试与端到端测试
docs/spec/                   v1.0 产品、架构、模块与验收规格
TODO.md                      当前 Sprint、任务依赖与验收清单
compose.yaml                 本地 PostgreSQL
compose.production.yaml      服务器 Web + PostgreSQL
Dockerfile                   生产应用镜像
infra/Caddyfile.snorlaxden   合并到服务器现有 Caddy 的本站配置片段
.env.example                 不含真实密钥的变量模板
```

## 安全边界

- 私人 Obsidian Vault 不进入本仓库或服务器；只发布白名单导出的副本。
- Resource、SourceMaterial、AI 产物和 Media 默认私密。
- 用户、内容和媒体写操作仅允许已登录管理员；公开读取在 Payload access 层过滤。
- 文章和项目只有 `_status=published` 时对访客可见；撤回后详情返回 404。
- 媒体仅允许 JPEG、PNG、WebP、AVIF，HTTP 上传限制为 10MB，默认私有。
- AI 只生成草稿，发布必须由管理员确认。
- 未获得合法字幕时，视频只能收藏链接、元数据和本人笔记。
- 数据库不开放公网端口；生产 Web 仅绑定服务器回环地址。
- 每次 schema 变更必须生成迁移，并提供备份与回滚方案。

完整需求从 [规格入口](docs/spec/README.md) 开始阅读。
