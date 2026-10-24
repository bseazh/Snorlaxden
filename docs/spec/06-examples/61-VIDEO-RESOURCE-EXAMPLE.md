# 业务演示 B｜视频链接 → 私有资源 → 知识卡 → 原创文章

> 使用**占位链接及虚构内容**演示字段；不要把例子当成真实 B站/YouTube 的视频元数据。

## 1. 收藏链接

```json
{
  "kind": "bilibili",
  "sourceUrl": "https://www.bilibili.com/video/BV_EXAMPLE",
  "title": "用户待填：知识管理主题视频",
  "externalId": null,
  "myNotes": "希望理解第二大脑应该如何与个人网站打通",
  "visibility": "private",
  "extractionStatus": "link_only",
  "transcriptOrigin": "none"
}
```

合法链接 ID 格式应由实际平台适配器校验；此例故意不构造真实 BV 号。

## 2. 此时能做什么

- 能在私有 Resources 列表查看和搜索。
- 能打开原来源 URL、加标签、记录自己的评价。
- **不能**声称完整解析视频，也不能生成“作者在第 03:21 分钟提到……”这种没有来源的结果。

## 3. 站长手工添加观后笔记

```md
我自己的理解：
- 知识系统最好先保证能够保存原始资料，而不是追求一开始全部智能化。
- 对外公开笔记应与个人私有仓库分离，避免误泄露。
- 可以尝试“资源卡→知识卡→原创博客”的流水线。
```

这份文本由用户提供，所以 `transcriptOrigin=manual` 或更准确的 `textOrigin=user_supplied_text`。**不是作者逐字字幕**。

## 4. AI 知识卡草稿

```md
---
title: 个人网站与第二知识仓库的关系
source_id: res_example_01
source_type: bilibili
source_url: https://www.bilibili.com/video/BV_EXAMPLE
text_origin: user_supplied_notes
visibility: private
review_status: pending
---

## 一句话认识
公开个人网站和私人第二知识仓库应该共享部分成果，但不共享所有权限。

## 来源
来自本人观看笔记；不代表视频创作者逐字观点。

## 我的思考
如果先做资源收藏与稳定导出，即使 AI 接口失效，知识积累仍能持续。

## 下一步
完成第一版 Resources 界面、公开内容白名单导出。
```

## 5. 如果选择发布

可用该知识卡为**素材**写一篇原创博客，保留来源链接并审核版权/事实；默认资源本体仍是 private。除非得到相应授权，不复制完整视频到自有服务器公开播放。
