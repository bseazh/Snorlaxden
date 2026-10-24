# 模块 36｜B站 / YouTube / 视频号 → 可追溯知识卡片

## 设计原则

**收藏一个视频链接** ≠ **获得完整视频字幕** ≠ **具备公开转载许可**。不同平台允许访问的元数据、字幕能力不同；始终提供无自动解析时的人工记录路径。

## 平台适配器

```ts
type Platform = 'bilibili'|'youtube'|'wechat_channels'|'generic';
type VideoMetadata = {
  platform: Platform; canonicalUrl: string; externalId?: string;
  title?: string; author?: string; description?: string;
  publishedAt?: string; thumbnailUrl?: string;
};
interface VideoSourceAdapter {
  supports(url: URL): boolean;
  normalize(url: URL): Promise<{canonicalUrl:string;externalId?:string}>;
  fetchAuthorizedMetadata?(idOrUrl: string): Promise<VideoMetadata>;
}
```

- B站：支持 `bilibili.com/video/BV...` 及可信短链接域名，解析 BV 号/标准 URL；合法 API 条件不足时允许手动录入作者/标题/封面。
- YouTube：`youtube.com/watch?v=...`, `youtu.be/...`，可通过授权 API 获取基本元数据；中国大陆环境可能不能稳定访问，所以必须离线降级。
- 微信视频号：优先保存分享链接和用户输入的描述，不承诺可自动获取外部视频文件、字幕或全文。
- 只允许可信域名白名单访问；短链最多安全重定向，DNS/private IP/metadata server 防 SSRF；不让后台任意抓取内网地址。

## 两种解析深度

| 级别 | 真实输入 | 允许输出 |
|---|---|---|
| L0 仅收藏 | URL + 站长自填标题 | 链接卡、标签、私人备注 |
| L1 元数据 | 官方可用标题/作者/简介 | “基于视频简介的简要介绍”（必须标注限制） |
| L2 文本可用 | 本人提供的观看笔记/有权字幕/合法转录 | 内容知识卡、观点与时间码（如源带时间码） |
| L3 自有素材 | 本人有权处理视频文件/录音 | 转写、说话人和章节（v1.1 以后） |

**禁止**在 L0/L1 时输出“我完整观看视频后发现……”或虚构视频内的精确论断和时间码。

## 用户操作流程（路径 B）

1. 粘贴链接 → 显示识别到的平台和标准链接；创建 private `Resource`。
2. 显示解析状态：`仅收藏 / 元数据就绪 / 等待原文 / 可生成知识卡 / 解析失败`。
3. 管理员选择：`添加自己的笔记`、`粘贴已有字幕（需有使用权）`、`上传自己有权处理的文本/视频`。
4. 当有正文文本时，可调用 AI 生成结构化知识卡，字段：核心要点、来源证据段落、个人思考、行动项、待核实项。
5. 审核、编辑后保存在私人知识仓库；可以关联一篇原创博客或导出给 Obsidian。
6. 如要公开发布，默认只展示源 URL、自己的评论与符合许可范围的少量引用，避免重上传第三方视频。

## 处理队列与状态

- `ingestStatus`: `saved_only → metadata_ready → text_ready → card_draft → reviewed`，任何一步可进入 `failed` 并附 `reason`。
- 相同平台+外部 ID 去重，用户的不同观看记录作为独立 Notes 追加。
- `transcriptOrigin`: `none|user_supplied|authorized_api|own_media_asr`；记录语言、版本、授权依据和是否经过本人复核。
- v1 对外接口 `POST /api/internal/resources/import` 不要求 AI；知识卡调用 API 必须有 `user_supplied_text` 等事实源。

## 平台许可与版权注意

- YouTube 官方字幕下载 API 要求用户有**编辑该视频的权限**，不能把该接口当成所有公开视频的字幕抓取方式。
- 引用/嵌入遵守平台条款和权利人许可，不提供 DRM 绕过、破解、未经授权的下载/转载路径。
- 图片缩略图外链有缓存和授权限制：无法获取时用站内占位封面，避免非法下载。

## 验收

- 贴两条不同格式的同一个 B站视频链接会规范化为同一个资源。
- 仅有 URL 时可保存私密卡片；点击生成完整摘要应提示“需要字幕或自己的观看笔记”。
- 贴入本人观看笔记之后可生成可编辑卡片；知识卡附来源链接和事实不足说明。
- 网站 AI API 不可用时链接仍可收藏、加标签与导出。
