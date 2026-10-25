# 模块 32｜Obsidian → Quartz 公开知识花园

## 核心要求：原始 Vault 永不直接公开

知识源是本地 Obsidian Markdown。只把**显式标记、通过安全验证的公开副本**交给 Quartz 静态构建。不要靠 Quartz 内部 private-page 过滤作为唯一安全机制：附件可能被静态资源管道带入公开产物。

## 第一版同步方向

`Obsidian 本地编辑` → `选中/标记公开` → `安全导出器` → `garden-public-content/` → `Quartz build` → `静态主机`。**不实现网站回写本地 Vault**。

## 笔记 frontmatter 约定

```yaml
---
title: 我的知识管理原则
publish: true
visibility: public
tags: [Obsidian, AI]
date: 2026-10-24
---
```

安全约束：`publish: true` 只是**初步候选**，需同时位于允许导出的路径（如 `06-Public/`）且满足导出器规则；更安全的是“目录白名单 + 人工确认 + 元数据”三重条件。默认全部 private。

## 导出器算法（必须有测试）

1. 扫描允许目录下的 `.md`；校验 YAML 元数据，记录通过/拒绝清单。
2. 读取并解析 Markdown AST/Obsidian wikilink、嵌入引用，消除路径穿越、符号链接越界。
3. 只允许访问 Vault 内合法路径，**不跟随指向私密目录的符号链接**；不复制 `.obsidian/` 和隐藏文件。
4. 对 `![[image.png]]`、`![[file.pdf]]` 等嵌入附件强制走**逐项许可**：默认不公开 PDF/音频/视频；图片需确认许可、大小、敏感信息与目标公开路径。
5. 指向未公开笔记的 `[[link]]` 去掉可点击目标并输出普通文本，或给出“非公开笔记”提示，禁止泄露标题（可配置）。
6. 导出至**临时全新目录**，生成 `manifest.json`（路径/hash/附件许可证/构建版本/警告）。
7. 运行内容扫描：私密测试标记、超范围附件、敏感密钥特征、生成链接；遇到高风险阻断部署。
8. 使用 Quartz 在隔离目录构建，仅将构建产物同步到新版本静态目录并以原子切换方式发布。
9. **撤回**：重新全量构建干净目录，不保留旧的 HTML、静态附件、旧地图；处理 CDN/反代缓存。
10. 日志仅记录数量、路径指纹及必要问题，避免把私密内容打印到公共 CI 日志。

## 已实现的导出契约

管理员通过 `POST /api/internal/public-garden/export` 触发导出。服务端只读取 `PUBLIC_GARDEN_SOURCE_DIR`、`PUBLIC_GARDEN_MANIFEST` 和 `PUBLIC_GARDEN_OUTPUT_DIR`，请求正文不能指定路径。manifest schema 示例位于 `content/templates/public-garden-manifest.json`。

- 导出器只替换带自身 marker 的目录；首次目标目录必须不存在或仅含项目自带 `.gitignore`。
- 若本地 Vault 不在服务器，应在本机运行应用和导出端点，再把**筛选后文件**交给独立 Quartz 构建流程，不能上传私人 Vault。
- ISSUE-008 接入 Quartz 前人工核对生成的 `manifest.json`；后续 CI 也只能接收筛选后的公开副本。

## Quartz 集成

- 单独代码库/子项目，使用独立 `garden.<domain>` 子域名；主站 `/garden` 301/302 跳转。
- 固定 Quartz 版本、构建工具版本，关注插件/Markdown 功能导致的特殊嵌入。
- 配置主页、搜索、backlinks 和图谱可循序开启；先确保内容发布权限正确。
- `robots/sitemap` 仅包含公开文件；站点生成产物不应暴露源代码、私有 Git 元信息。

## 验收（强制）

- 构造 1 个公开笔记，1 个私密笔记，1 个私密 `secret.pdf`，以及一个公开笔记引用该私密附件；最终生成目录中找不到后两者及任何二进制副本。
- 发布笔记的图能够显示且没有原始定位 EXIF。
- 撤回公开笔记后原 URL 返回 404，关联旧附件不再可访问。
- 导出器遇到 `../` 或 symlink 指向 Vault 外，必须失败并记录告警。
