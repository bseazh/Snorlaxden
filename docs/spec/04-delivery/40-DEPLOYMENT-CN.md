# 模块 40｜中国大陆云服务器部署与运维

> 部署说明是执行计划，不是对尚未提供的服务器配置作出保证。验证硬件、域名备案及当前端口占用后再实施。

## 0. 建议架构

- `www.example.com`: Next.js + Payload CMS Node 服务（容器只绑定 `127.0.0.1:3000`）。
- `garden.example.com`: Quartz 静态构建输出，由 Nginx 直接服务；主站 `/garden` 跳转此子域名。
- `db`: PostgreSQL，仅内部 Docker 网络访问，不对公网映射 5432。
- `media`: 初期允许本机私有卷；更推荐独立对象存储（OSS/COS/S3 兼容）；公共文件可使用经审核的 CDN 或公开桶，**私有文件禁止公开桶**。
- 图片生成调用供应商 API：无 GPU 服务器不部署 GPU 模型。若以后启用 ComfyUI 放在有 GPU 的受保护机器中。

## 1. 服务器勘查（只读）

```bash
cat /etc/os-release
uname -m
nproc
free -h
df -h
docker --version || true
docker compose version || true
sudo ss -lntp
```

记录 CPU、内存、磁盘、架构、端口冲突、到期时间与预算。2vCPU/4GB RAM 是推荐**起点**，不是固定门槛；本地构建或 CI 构建可降低小机器内存压力。建议操作系统 Ubuntu LTS 等官方长期维护版本。

## 2. 域名与公网准备

1. 核实域名实名信息与 ICP 备案状态；国内大陆服务器上站通常需按适用要求完成备案接入。公安联网备案的适用与时限按属地流程执行。
2. DNS 为 `www` 和 `garden` 配 A/AAAA 记录指向服务器，预留根域名跳转。
3. 云安全组最小开放 `80/tcp`, `443/tcp`，SSH 仅来自可信地址（运维端口可自定）。
4. 申请 HTTPS 证书（ACME/其他可信机构），自动续期并设置续期失败告警。
5. 生产环境只允许公网访问 Nginx，不暴露 Node、Postgres、ComfyUI、内部队列面板。

## 3. 推荐代码布局

```text
hehaizhao-digital-space/
├── web/                   # Next.js + Payload 源码
├── garden/                # Quartz 工程(与原 Vault 分离)
├── scripts/               # 安全导出脚本和部署辅助
├── infra/
│   ├── compose.yaml
│   ├── nginx/
│   └── backup/
└── docs/                   # 此文档包
```

`.env` 不进入 Git；管理员/数据库密码由部署负责人保管。仓库还应有 `.gitignore` 排除 `node_modules/`, `.env*`, 数据卷, 原 Obsidian Vault, 私有备份和上传内容。

## 4. 构建与部署顺序

1. 本地安装 Payload 官方支持版本的 Node/Next；使用 `npx create-payload-app`，选 PostgreSQL 模板；固定依赖版本和 lockfile。
2. 以 migrations 管理 Collection 结构。初次创建管理员账户需限定一次性初始化路径；开发测试账号不能进生产。
3. Docker 构建 Next/Payload 生产镜像；尽量在本地/CI 完成构建，生产服务器只拉镜像。
4. 启动 DB，配置健康检查，应用进行迁移后启动；持久化 DB 与私有媒体路径。
5. 配置 Nginx `/` 代理 Node，`garden.<domain>` 指向 Quartz 生成目录；设置上传大小、缓存、TLS、安全 headers。
6. 本地用筛选导出器生成公开笔记，再在 CI 或可信环境执行 Quartz build，部署**仅静态生成文件**。
7. 测试域名 TLS、登录、帖子发布、私有资源不可访问与 Quartz 撤回流程。
8. 启动备份、运行日志保留、磁盘容量告警和恢复演练。

## 5. Compose 基础骨架（须配合真实应用 Dockerfile）

```yaml
services:
  db:
    image: postgres:17
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 10s
      timeout: 5s
      retries: 5
  web:
    build: ../web
    restart: unless-stopped
    env_file: ../web/.env.production
    ports:
      - "127.0.0.1:3000:3000"
    depends_on:
      db:
        condition: service_healthy
volumes:
  pgdata:
```

> `build` 的解析目录依赖 compose 文件位置和启动方式；以生产编排实际路径为准。该代码仅示意拓扑，不能视为现成可部署服务。

## 6. 生产环境变量

| key | 要求 |
|---|---|
| `DATABASE_URL` | Postgres 内部地址，独立用户和强密码 |
| `PAYLOAD_SECRET` | 强随机生成，仅服务端持有 |
| `NEXT_PUBLIC_SITE_URL` | 实际公开主站 URL，无内部地址 |
| `MEDIA_STORAGE_*` | OSS/COS/MinIO 等服务端密钥，使用最小权限 |
| `AI_TEXT_BASE_URL`, `AI_TEXT_API_KEY` | 选用的文字 API，选配 |
| `AI_IMAGE_BASE_URL`, `AI_IMAGE_API_KEY` | 选用的图像 API，选配 |
| `AI_TEXT_ENABLED`, `AI_IMAGE_ENABLED` | 关闭时 UI 优雅降级 |
| `MAX_IMAGE_GENERATIONS_PER_DAY` | 成本保护限制 |

严格验证用户上传/模型输入，无密钥进入前端变量。

## 7. 媒体与 CDN 策略

- 第一版用户原创图片直接走媒体上传，API 生成图审核前仅存 private 存储，配图审核后复制/切换到公开存储；可选低成本对象存储。
- 图片压缩、尺寸优化/格式转换；禁止 CDN 缓存私人响应。
- 音视频大文件首期只收藏链接，不自建转码；上传的 PDF 默认私密，下载需鉴权。
- 如图片桶与后台桶相同，务必实现 object prefix/策略隔离，而不是通过文件名判断私密与否。

## 8. 备份、监控、回滚

**备份**：Postgres 每日加密备份、独立位置至少滚动 7–30 天（按预算/法规评估）；媒体文件和 `siteSettings` 单独备份；版本化公开内容仓库。**演练**：至少每月进行一次恢复测试。

**监控**：Nginx 5xx、Node 进程健康、磁盘剩余、DB 健康/备份完成、证书有效期、AI 任务异常/消费上限。

**回滚**：保留上一个可用镜像 tag + DB 迁移回退方案；Quartz 静态版保留最近构建指针（但**敏感内容撤回例外**：不能通过回滚把已撤回内容恢复公开）。

## 9. 首期成本控制

- 开源框架自部署；已购服务器/域名复用。
- 优先小体量图片与文字，不上传大量原视频。
- AI 调用次数和图片张数设置硬上限，定期看模型消费账单。
- 无 GPU 时外部图像 API 比在单台普通 CPU 服务器自行部署模型更务实。
- 真正投入主要是开发时间、运营维护、文件存储和网络流量，不宣称“完全免费”。
