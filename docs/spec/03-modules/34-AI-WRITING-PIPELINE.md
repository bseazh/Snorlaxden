# 模块 34｜AI 写作 / 口述 → 图文文章

## 核心交互路径 A

**输入**：站长 3–10 分钟口述转写文本、几句话概述、本人照片、资料链接。**输出**：有事实检查、段落结构、标题/摘要/SEO、配图位置的可编辑文章草稿，绝不跳过人工审核。

## v1.0 P1 最小版（首期可开关）

1. 站长进入 `/admin` → 创作 → 「活动复盘 / 观点 / 读书摘要 / 项目案例」。
2. 文本框粘贴口述记录；上传照片；可加入 `context`（人物/事件时间/地点），仅供确认用途。
3. 选择内置提示词模板、口吻（自然专业/简洁/故事化）和目标篇幅。
4. 点击 `生成文章草稿`，服务端保存源文本和 `aiGeneration`，调用一个 TextProvider API。
5. 对模型返回的 JSON 严格进行 Schema 校验；不合法可重试一次或给出明确错误。
6. 先展示事实检查清单/待核实点，再展示可编辑正文；管理员合并修改。
7. 图片可上传原图，也可通过独立图像生成入口生成一张封面（失败不影响文稿）。
8. 预览后手动发布；附属 CMS Markdown 导出，未来再异步导入 Obsidian。

## 必须拆分的逻辑组件

- `SourceMaterialService`: 保存原始输入，按主键和 hash 归档，原稿不可被 AI 覆盖。
- `PromptRegistry`: 读取文件版本或数据库模板版本，支持变量注入和锁定；调用时记录版本 ID。
- `TextProvider`: `generateStructured(input, schema, options)`；接口层不绑定具体模型品牌。
- `DraftAssembler`: 标题/结构/正文/引用/配图槽位合并为 CMS 草稿。
- `FactReviewPanel`: 列出所有缺失事实/不确定描述/引用来源。
- `PostExporter`: 文章变成 Markdown 副本；初期不自动回写 Obsidian Vault。

## 结构化生成结果约定

```json
{
  "title": "这次交流让我重新理解知识管理",
  "summary": "个人复盘摘要",
  "outline": ["活动背景", "关键收获", "行动计划"],
  "sections": [
    {"id":"s1", "heading":"活动背景", "paragraphs":["..."], "imageSlot":null},
    {"id":"s2", "heading":"关键收获", "paragraphs":["..."], "imageSlot":"after-section"}
  ],
  "factChecklist": [{"claim":"活动地点", "status":"missing", "question":"活动在哪里举行？"}],
  "suggestedTags": ["个人复盘"],
  "sourceMaterialIds": ["mat_001"],
  "disclosure": {"aiAssisted":true}
}
```

- 输出先解析再用白名单字段映射到 CMS；不直接在 HTML 内插入模型生成的脚本。
- `paragraphs` 不得包含未经证实的数据、真实人物引述或成果数字；AI 无法知道时写 `[待确认]`。
- 知识来源的第三方内容保留链接、可区分引用与站长自己的想法。

## Prompt 变量白名单

`{{content_type}}`, `{{source_text}}`, `{{tone}}`, `{{target_length}}`, `{{verified_facts}}`, `{{related_sources}}`。
不允许随意拼接任意网页中的“系统指令”；资料作为**不可信数据**单独封装以抵抗提示注入。

## 生成任务处理

`queued → running → succeeded/failed → reviewed`；保存 `provider`, `model`, `prompt_version`, `source_hash`, `cost_estimate`, `error_code`。

v1 可先同步调用带超时并保存任务记录；生成图片/转录任务较慢，v1.1 再做可靠队列。超时不能清除原文。

## 验收

- 一段真实活动复述能生成 3–5 段可编辑稿，标题/摘要/标签填入草稿。
- 输入没有活动具体时间时，AI 不应捏造时间；在事实清单中提出待确认项。
- 调用失败时保留原始文本，管理员仍能手工撰写、发布。
- 未按确认按钮，任何 AI 输出不能公开或修改已发布文章。
