# Snorlaxden 开发清单

> 最后更新：2026-10-26
> 当前里程碑：Sprint 3 已完成｜下一工作包：COS Private Storage Adapter
> 状态说明：`[x]` 已完成，`[ ]` 待处理。一次只实施一个工作包。

本清单是项目的执行看板。产品边界以 `docs/spec/00-product/01-MVP-PRD.md` 为准，验收编号来自 `docs/spec/04-delivery/41-TEST-ACCEPTANCE.md`。

## 已完成｜Sprint 0 工程脚手架与首次部署

- [x] 建立 Next.js 16、Payload 3.91、PostgreSQL 17 和 pnpm 10 工程
- [x] 配置本地数据库、环境变量样例、密钥忽略规则及文件权限
- [x] 加入 typecheck、lint、集成测试、生产构建和 GitHub Actions
- [x] 创建 Docker Compose 生产环境并固定基础镜像摘要
- [x] 部署到服务器 `/home/ubuntu/Project/snorlaxden/app`
- [x] 固定生产 Web 端口为 `127.0.0.1:3999`
- [x] 接入 `https://blog.snorlaxden.fun` 和自动 HTTPS
- [x] 验证首页、后台、未认证 API 拒绝访问及 PostgreSQL 健康状态

## 已完成｜Sprint 1 核心内容与页面

### [ISSUE-002｜认证与公开访问过滤](https://github.com/bseazh/Snorlaxden/issues/1)

后续内容开发的安全前置条件已经完成。

- [x] 将 `users` 明确限制为管理员访问，不开放公开注册
- [x] 建立复用的管理员访问控制与 published-only 公开读取规则
- [x] 明确 Payload Local API 的 `overrideAccess` 使用方式
- [x] 添加未登录读取用户列表、写入内容及读取草稿的集成测试
- [x] 验证 T002、T003：草稿不可见，匿名写入返回 401/403

完成标准：公开 API 无法读取用户、草稿或私有字段；管理员登录和后台操作保持正常。

### [ISSUE-003｜内容模型、草稿和发布流程](https://github.com/bseazh/Snorlaxden/issues/2)

依赖：ISSUE-002。

- [x] 创建 `tags`、`posts`、`projects`、`faqItems` Collections
- [x] 创建 `siteSettings` Global，并补充 `media` 的用途、可见性、授权和 alt 字段
- [x] 为文章和项目启用 Payload drafts/versions
- [x] 添加 slug 唯一约束、发布时间、精选状态和 SEO 字段
- [x] 生成并审阅 Payload 类型与 PostgreSQL migration
- [x] 添加发布、预览、撤回及公开 API 过滤测试
- [x] 验证 T004、T005、T006

完成标准：后台可以完成文章草稿到发布、撤回，以及项目 CRUD；撤回内容立即停止公开访问。

### [ISSUE-004｜数字花园公开站](https://github.com/bseazh/Snorlaxden/issues/3)

依赖：ISSUE-003。

- [x] 建立站点设计 tokens、响应式 Layout、Header 和 Footer
- [x] 实现首页、`/about`、`/projects`、项目详情
- [x] 实现 `/journal`、文章详情、`/contact`
- [x] 实现后台可编辑的预设 FAQ，AI 不可用时仍能正常工作
- [x] 实现 metadata、canonical、Open Graph、sitemap 和 robots
- [x] 补充空状态、404、移动端及键盘操作体验
- [x] 增加公开页面 E2E 和移动端截图检查
- [x] 验证 T001、T002、T005

完成标准：访客能在 30 秒内找到个人定位、项目、文章、知识入口和联系方式；移动端无横向溢出。

### Sprint 1 首批内容

- [x] 个人简介与研究方向
- [x] 个人照片优化副本
- [x] 公开邮箱和 GitHub 链接
- [x] LawyerBuddy、PrivacyGuard、GGGMing 项目案例
- [x] 从旧站整理 3 篇真实文章
- [x] 创建 6 个可在后台编辑的 FAQ 问答

内容未齐时可以先使用明确标记的开发样例，但不得把虚构资料发布到生产站。

## 后续工作

### 已完成｜[CHORE-001：工程模块化与内容存储标准](https://github.com/bseazh/Snorlaxden/issues/9)

- [x] 按业务能力建立 `src/modules/ai` 和 `src/modules/content`
- [x] AI 拆分为 application、domain、infrastructure、prompts 和 providers
- [x] 明确 Payload/PostgreSQL 为正式文章唯一真源
- [x] 建立 `content/inbox`、`content/exports` 和 `content/public-garden` 工作区边界
- [x] 新增 `docs/DX.md`，规范代码、内容、媒体、OSS/COS、测试和发布
- [x] README 增加整体架构图和数据位置表

### Sprint 4｜AI 内容试运行

- [ ] [ISSUE-009：AI TextProvider 与文章草稿试运行](https://github.com/bseazh/Snorlaxden/issues/8)
- [x] 建立 StepFun/DeepSeek 服务端 Provider，密钥不进入浏览器
- [x] 实现 `article-writer-v1` 提示词、输入边界和结构化结果校验
- [x] 实现仅管理员可访问的 `/studio` 写作工作台
- [x] 使用 DeepSeek 真实生成文章草稿、标签与事实核实清单
- [ ] StepFun 当前返回 402，恢复供应商额度后完成真实生成验收
- [x] 增加仅管理员可见的 AI 生成记录与按管理员每日调用限额
- [x] 增加“一键保存为 Payload 草稿”，并生成 `content/articles/<slug>.md` 审阅副本
- [x] AI 产物只允许进入草稿，发布必须由管理员确认
- [x] 参考旧 Hexo/Fluid 视觉语言重做照片封面、导航与文章阅读界面
- [ ] 验证 T013–T017

### 已完成｜[ISSUE-011：公开 AI 个人助手与预设问答](https://github.com/bseazh/Snorlaxden/issues/11)

- [x] 建立独立 `/assistant` 页面，进入页面后直接显示完整会话区
- [x] 在主导航和首页 FAQ 区增加 AI 助手入口，移除全站悬浮窗
- [x] 预设问题直接使用已启用 FAQ，不调用模型
- [x] 建立只读取公开站点设置、已启用 FAQ、已发布文章和项目的知识服务
- [x] 接入 DeepSeek 自由问答并返回可打开的公开引用
- [x] 增加按 IP 摘要的访客每日限额、输入校验、超时和失败降级
- [x] 审计调用结果但不保存完整问题、回答或敏感请求数据
- [x] 补充公开权限、草稿隔离、限额、桌面和移动端测试
- [x] 部署并完成真实 DeepSeek 与生产访问验收

### 已完成｜[CHORE-002：统一日志与操作审计](https://github.com/bseazh/Snorlaxden/issues/10)

- [x] 建立根目录 `logs/` 作为日志统一入口
- [x] 建立进入 Git 的按日期开发日志，保留实现、迁移、测试和部署痕迹
- [x] 建立 PostgreSQL `audit-logs`，管理员只读且禁止更新/删除
- [x] 记录登录、AI 调用、限额拒绝、草稿保存和内容状态变更
- [x] 对 IP 做加盐摘要，禁止保存密钥、Cookie、正文和 AI 原始素材
- [x] 为 Docker 运行日志增加 10MB x 5 轮转
- [x] 增加 `pnpm logs:export` JSONL 导出能力

### 参考实现与采用边界

后续功能优先借鉴本地已有项目，而不是从零设计，但继续保留当前 Next.js + Payload 架构：

- Quartz 5（`../quartz-5`）：复用 Markdown/Obsidian 兼容思路，并借鉴目录、双链、反向链接、全文搜索、标签页和局部知识图谱。
- Memos（`../memos-main`）：借鉴时间线式浏览、快速记录、标签筛选、可见性提示和内容关联交互。
- 只移植适合本站的数据模型与交互，不直接复制完整代码、部署第二套后台或引入 Go 服务。
- 当前阶段先保证基础内容、权限和发布流程稳定；搜索、图谱、快速记录和视觉重构按 Sprint 分批验收。

### 已完成｜Sprint 2 第二知识仓库（P0）

- [x] [ISSUE-005：资源收藏、时间线与安全 URL](https://github.com/bseazh/Snorlaxden/issues/4)
- [x] 借鉴 Memos 建立按时间倒序的资源/短记浏览，并支持标签筛选
- [x] 为私有、待审核、公开候选状态提供清晰且一致的可见性提示
- [x] 建立资源、文章、项目之间的显式关联，暂不做自动推荐
- [x] 规范 Bilibili/YouTube URL，移除跟踪参数并拒绝危险协议、凭据和内网地址
- [x] 验证 T011、T012：无文字时只标记收藏，不伪造分析；私人资源仅管理员可见
- [x] [ISSUE-006：私有媒体、来源关联与 Markdown 导出](https://github.com/bseazh/Snorlaxden/issues/5)
- [x] 验证 T019：匿名私有附件下载返回 401，并禁止共享缓存

### Sprint 3｜公开 Obsidian Quartz（P0）

#### 已完成｜[ISSUE-007：白名单 Markdown 导出与公开边界](https://github.com/bseazh/Snorlaxden/issues/6)

- [x] 定义公开导出 manifest 与白名单 schema，记录来源内容指纹、目标路径、校验和、授权、引用和导出时间
- [x] 仅导出 manifest 点名且 frontmatter 明确公开的笔记，以及逐项授权并校验 SHA-256 的附件
- [x] 将 `content/public-garden/` 作为唯一公开构建输入，不读取 `content/exports/` 私有导出或直接公开私人 Obsidian Vault
- [x] 使用 Markdown AST 和 wikilink 规则净化引用，拒绝路径穿越、隐藏文件、绝对路径、不安全协议和 symlink 越界
- [x] 为公开附件生成引用清单并核对 checksum，未授权、缺失、类型不符或被替换的附件让导出失败
- [x] 使用同磁盘临时目录完成原子全量替换；重新导出会删除撤回副本与孤立附件，失败保留最后有效版本
- [x] 记录导出成功、拒绝和失败审计，只保存数量和错误码，不记录私有正文或来源路径
- [x] 增加 4 个集成测试，验证 T007 导出前置、T008 文件泄漏边界、T010 路径/symlink 阻断和撤回清理
- [x] 验证 typecheck、lint、27 个集成测试、15 个 E2E 和 production build

完成标准：公开构建目录只包含白名单允许的 Markdown 与附件；任何私密引用、越界路径或 symlink 均被阻断；撤回后不残留公开副本。

#### 已完成｜[ISSUE-008：Quartz 构建与知识花园体验](https://github.com/bseazh/Snorlaxden/issues/7)

- [x] `/garden` 只读取 `content/public-garden/manifest.json` 点名且 SHA-256 匹配的公开副本
- [x] 借鉴 Quartz 实现目录、Markdown、wikilink、反向链接、标签索引和全文搜索
- [x] 公开附件只通过 manifest 校验的受控路由响应，不开放目录静态读取
- [x] 导出后触发 `/garden` 路由失效；撤回通过原子替换同步清除页面、搜索、sitemap 与附件
- [x] 保持公开花园绝不直接读取私人 Obsidian Vault、`content/exports/` 或 manifest 外文件
- [x] 完成桌面端和 390px 移动端体验；知识图谱继续作为性能评估后的渐进增强项
- [x] 验证完整 T007–T009；回归 T010

完成标准：公开笔记支持搜索、标签、双链和反向链接；撤回后旧 URL 与附件返回 404 且不缓存；manifest 外或 checksum 不匹配内容拒绝读取。

### 已完成｜[ISSUE-013：腾讯云 COS 私有存储 Adapter 与安全迁移](https://github.com/bseazh/Snorlaxden/issues/12)（P0）

- [x] 使用腾讯云官方 `cos-nodejs-sdk-v5` 实现 `COSPrivateStorageAdapter`，不自写签名
- [x] 保持私有对象只通过管理员鉴权下载，禁止公开 Bucket URL 和持久化签名 URL
- [x] 增加上传后 HEAD 完整性校验、失败清理、删除重试、受控错误和 Fake Client 测试
- [x] 本机完成真实 COS Put、Head、Get、SHA-256、Delete 和删除后 404 应用级回归
- [x] 生产数据盘点为 0 条，无历史 local 对象需要复制；保留按记录 driver 的 local/COS 双轨读取与回滚
- [x] 切换生产 `STORAGE_DRIVER=cos`，回归 T019、健康检查和匿名边界

完成标准：新上传原件进入私有 COS 前缀并通过完整性校验；任何下载仍先经过管理员鉴权；失败不泄露签名或凭证且尽力清理残留对象；历史记录可继续按原 driver 读取。

### 进行中｜[ISSUE-012：生产备份、恢复演练与监控](https://github.com/bseazh/Snorlaxden/issues/13)（P0）

- [x] 为 PostgreSQL、公开媒体、内容卷、local 回滚原件、私有 COS 对象和公开花园建立同批次清单
- [x] 每日生成带 SHA-256 的加密包，服务器保留 14 天，并上传私有 COS `private/backups/` 前缀
- [x] 在一次性隔离 PostgreSQL 和临时目录中完成真实恢复演练；数据库计数、管理员和文件归档一致
- [x] 每 15 分钟检查 Web、数据库、COS、容器重启、磁盘、证书和备份新鲜度，并保存本地状态/journald
- [x] 完成部署、故障恢复、应用回滚与敏感撤回保护手册；验证 T018
- [x] 验证 T020 的 HTTPS、证书域名/有效期和公开访问链路
- [x] 站点所有者提供正式备案号 `粤ICP备2026035659号`；全站页脚公示并链接工信部备案系统，完成 T020
- [ ] 配置短信、邮件或企业微信接收端后，把本地 systemd 失败状态升级为外部告警送达
- [ ] 为账号/Bucket 级灾难增加不同权限主体控制的第二 Bucket 或跨云副本

### AI 后续增强（P1，可关闭）

- [ ] ISSUE-010：图像 Provider、提示词版本和候选封面
- [ ] ISSUE-011：用户提供合法文字后的知识卡生成

### Sprint 5｜生产完善（P0）

- [ ] [ISSUE-012：数据库和媒体备份、隔离恢复演练、监控和回滚说明](https://github.com/bseazh/Snorlaxden/issues/13)（T018 已通过；等待 ICP 证据、外部告警接收端和第二故障域）
- [ ] 配置生产迁移流程和部署健康检查
- [x] 完成大陆站域名、TLS 与 ICP 备案号公示确认；公安联网备案按属地适用要求另行办理/核对
- [x] 验证 T018
- [x] 完成 T020：所有者确认 ICP 备案号，DNS/HTTPS/TLS 与前台公示通过

## 当前明确不做

- 不把原始私人 Obsidian Vault 上传 GitHub 或服务器
- 不在 Sprint 1 接入 AI 或消耗模型 API
- 不做未经授权的视频下载、字幕抓取或伪造分析
- 不做公开注册、多人社区、RAG、自动发布或 Obsidian 双向同步
