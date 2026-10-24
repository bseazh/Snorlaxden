# Snorlaxden 开发清单

> 最后更新：2026-10-24  
> 当前里程碑：Sprint 1｜核心内容与页面（P0）  
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

## 当前工作｜Sprint 1 核心内容与页面

### [ISSUE-002｜认证与公开访问过滤](https://github.com/bseazh/Snorlaxden/issues/1)

这是下一项要实施的工作，是后续内容开发的安全前置条件。

- [ ] 将 `users` 明确限制为管理员访问，不开放公开注册
- [ ] 建立复用的管理员访问控制与 published-only 公开读取规则
- [ ] 明确 Payload Local API 的 `overrideAccess` 使用方式
- [ ] 添加未登录读取用户列表、写入内容及读取草稿的集成测试
- [ ] 验证 T002、T003：草稿不可见，匿名写入返回 401/403

完成标准：公开 API 无法读取用户、草稿或私有字段；管理员登录和后台操作保持正常。

### [ISSUE-003｜内容模型、草稿和发布流程](https://github.com/bseazh/Snorlaxden/issues/2)

依赖：ISSUE-002。

- [ ] 创建 `tags`、`posts`、`projects`、`faqItems` Collections
- [ ] 创建 `siteSettings` Global，并补充 `media` 的用途、可见性、授权和 alt 字段
- [ ] 为文章和项目启用 Payload drafts/versions
- [ ] 添加 slug 唯一约束、发布时间、精选状态和 SEO 字段
- [ ] 生成并审阅 Payload 类型与 PostgreSQL migration
- [ ] 添加发布、预览、撤回及公开 API 过滤测试
- [ ] 验证 T004、T005、T006

完成标准：后台可以完成文章草稿到发布、撤回，以及项目 CRUD；撤回内容立即停止公开访问。

### [ISSUE-004｜数字花园公开站](https://github.com/bseazh/Snorlaxden/issues/3)

依赖：ISSUE-003。

- [ ] 建立站点设计 tokens、响应式 Layout、Header 和 Footer
- [ ] 实现首页、`/about`、`/projects`、项目详情
- [ ] 实现 `/journal`、文章详情、`/contact`
- [ ] 实现后台可编辑的预设 FAQ，AI 不可用时仍能正常工作
- [ ] 实现 metadata、canonical、Open Graph、sitemap 和 robots
- [ ] 补充加载、空状态、404、移动端及键盘操作体验
- [ ] 增加公开页面 E2E 和移动端截图检查
- [ ] 验证 T001、T002、T005

完成标准：访客能在 30 秒内找到个人定位、项目、文章、知识入口和联系方式；移动端无横向溢出。

### Sprint 1 内容准备（需要站长提供）

- [ ] 150 字和 500 字真实个人简介
- [ ] 个人照片或品牌标识
- [ ] 公开联系方式和社交链接
- [ ] 1–3 个真实项目案例
- [ ] 2–3 篇真实文章或 Markdown 草稿
- [ ] 4–8 个确认后的 FAQ 问答

内容未齐时可以先使用明确标记的开发样例，但不得把虚构资料发布到生产站。

## 后续工作

### Sprint 2｜第二知识仓库（P0）

- [ ] ISSUE-005：资源收藏、分类、标签和安全 URL 标准化
- [ ] ISSUE-006：私有媒体鉴权、来源关联和 Markdown 导出
- [ ] 验证 T011、T012、T019

### Sprint 3｜公开 Obsidian Quartz（P0）

- [ ] ISSUE-007：白名单 Markdown 导出、附件边界和 manifest
- [ ] ISSUE-008：独立 Quartz 构建、发布和撤回
- [ ] 验证 T007–T010

### Sprint 4｜AI 内容试运行（P1，可关闭）

- [ ] ISSUE-009：StepFun/DeepSeek `TextProvider`、结构校验和文章草稿
- [ ] ISSUE-010：图像 Provider、提示词版本和候选封面
- [ ] ISSUE-011：用户提供合法文字后的知识卡生成
- [ ] 保持所有 AI 功能默认关闭，产物只进入草稿
- [ ] 验证 T013–T017

### Sprint 5｜生产完善（P0）

- [ ] ISSUE-012：数据库和媒体备份、隔离恢复演练、监控和回滚说明
- [ ] 配置生产迁移流程和部署健康检查
- [ ] 完成大陆站合规/备案确认
- [ ] 验证 T018、T020

## 当前明确不做

- 不把原始私人 Obsidian Vault 上传 GitHub 或服务器
- 不在 Sprint 1 接入 AI 或消耗模型 API
- 不做未经授权的视频下载、字幕抓取或伪造分析
- 不做公开注册、多人社区、RAG、自动发布或 Obsidian 双向同步
