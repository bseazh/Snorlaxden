# 示例｜安全公开笔记及私密附件防泄露用例

## 公开候选 `06-Public/knowledge-garden.md`

```md
---
title: 我的个人知识花园搭建思路
publish: true
visibility: public
date: 2026-10-24
tags: [第二大脑, Obsidian]
---

我希望通过个人网站分享已经审核的知识笔记。

笔记主目录仍然保留在个人电脑，公开的部分通过白名单导出。
```

## 私密样例 `02-Knowledge/private-secret.md`

```md
---
title: PRIVATE-NEVER-PUBLISH
publish: false
---

TEST_PRIVATE_CANARY_8A1C
![[private-document.pdf]]
```

## 注入风险测试

假设公开笔记引用 `![[private-document.pdf]]`，安全导出器应该阻断或删除引用（根据策略），**不能**复制 PDF；扫描最终 HTML/附件/构建 manifest，不得出现 `TEST_PRIVATE_CANARY_8A1C`、私密文件名及文件内容。

## 撤回验证

更改 `publish: false` → 全量新目录导出构建，旧 URL 不能访问；反向代理/CDN 清理旧缓存；原始私有 Vault 保持未改变。
