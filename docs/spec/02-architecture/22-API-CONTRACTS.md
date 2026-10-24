# REST/API 合同（v1.0 + 为 v1.1 预留）

> 使用 Payload 标准 CMS REST/Local API 处理 CRUD；以下仅列自定义业务动作。所有 JSON 为接口设计示例，不是已经部署的端点。自定义路由需 Zod/等价 schema 验证，服务端鉴权。

## 1. 通用规则

- `/api/internal/*` 默认 `Admin`，必须检查会话；`GET public` 从 CMS 服务端查询后进行字段白名单过滤。
- 成功：`{ "ok": true, "data": {}, "requestId": "..." }`；失败：`{ "ok":false, "error":{"code":"...", "message":"..."}, "requestId":"..." }`。
- 所有生成动作支持 `Idempotency-Key`（v1 可至少前端防重；v1.1 DB 落幂等键）。
- URL 参数和文件名必须校验；API Key 不可透传前端；权限错误用 401/403，私人资源公开查询返回 404。

## 2. 视频/外链收藏

### `POST /api/internal/resources/ingest`

```json
{
  "url": "https://www.youtube.com/watch?v=XXXXXXXXXXX",
  "manualTitle": "可选：我观看的一期视频",
  "notes": "我觉得其中一个观点值得复盘",
  "visibility": "private"
}
```

响应：

```json
{
  "ok": true,
  "data": {
    "resourceId": "res_001",
    "kind": "youtube",
    "normalizedUrl": "https://www.youtube.com/watch?v=XXXXXXXXXXX",
    "extractionStatus": "metadata_ready",
    "canSummarize": false,
    "notice": "仅获取元数据；未获得视频正文/字幕"
  },
  "requestId": "req_001"
}
```

- 对 B站与视频号只保证 URL 识别及手工元数据兜底；官方接口是否可用单独测试。
- 服务端**禁止通过任意 URL 请求**；只对已知平台走平台 Adapter，不认识的 URL 先只保存字符串（SSRF 防护）。

### `POST /api/internal/resources/{id}/summarize`

```json
{
  "textOrigin": "manual",
  "text": "经授权使用的字幕或者站长自己的笔记……",
  "promptVersion": "knowledge-card-v1"
}
```

若无可用文字，返回 `409 SOURCE_TEXT_REQUIRED`，不编造视频摘要；成功创建 `aiGenerations` 结果作为待审核知识卡，不直接公开。

## 3. AI 文章生成

### `POST /api/internal/ai/article`

```json
{
  "sourceMaterialId": "mat_123",
  "sourceResourceIds": ["res_001"],
  "templateKey": "event-reflection",
  "tone": "natural-professional",
  "targetLength": 1000,
  "promptVersion": "article-writer-v1"
}
```

响应 `draftPostId`, `generationId`, `factChecklist`, `status`；超时时应保留 `sourceMaterial` 和 `generationId`。AI 不得让 `_status` 变 published。

## 4. AI 图片

### `POST /api/internal/ai/image`

```json
{
  "postId": "post_123",
  "brief": "与知识体系连接有关的概念插画",
  "stylePreset": "editorial-clean",
  "aspectRatio": "16:9",
  "count": 1,
  "provider": "remote-api",
  "promptVersion": "image-director-v1"
}
```

推荐返回 `202` + `generationId` + `status`（异步）；如底层支持同步，服务端仍可落结果记录。图片返回后先以 `media.visibility=private` 保存，须管理员插入文章、确认发布才可以变 public。

### `GET /api/internal/ai/generations/{id}`

返回 `status`, `progress`, `outputMediaIds`, `errorCode`，不暴露密钥/内部调用链。`POST .../{id}/retry` v1.1。

## 5. 内容导出

### `POST /api/internal/exports/markdown`

```json
{ "type": "post", "id": "post_123", "includeMediaManifest": true }
```

返回仅管理员可下载的 Markdown 文件；YAML frontmatter 带稳定 `sourceId`/`canonicalUrl`/`exportedAt`/`visibility`。附件采取显式选择，不复制私密媒体到公开目录。

## 6. 知识公开构建（CI/本机受控脚本，不向互联网开放写接口）

`export-public-notes --vault <path> --dest <clean-dir> --dry-run` 只在可信本地/受控 CI 执行。输出 manifest（笔记数量、附件列表、拒绝原因、构建 hash）；扫描完成后再触发 Quartz build。不要提供一个任何访客都能点击的 `/publish-vault` 公网端点。

## 7. 常见错误代码

`UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION_ERROR`, `RATE_LIMITED`, `SOURCE_TEXT_REQUIRED`, `UNSUPPORTED_SOURCE`, `EXTERNAL_METADATA_UNAVAILABLE`, `PROVIDER_UNAVAILABLE`, `GENERATION_FAILED`, `PRIVATE_MEDIA`, `EXPORT_BLOCKED`, `PUBLICATION_REQUIRES_REVIEW`。

## 8. Mock/联调策略

- 提供 FakeTextProvider 返回稳定草稿、FakeImageProvider 输出**开发专用占位图**（不能伪装已调用真实模型）。
- e2e 要断言“AI 不可用→可以手动发布”；“未授权文本→不能生成声称已读视频的摘要”；“图片失败→原稿不丢失”。
