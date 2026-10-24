# 提示词注册表与服务端版本策略

## 首期内置模板

| 键 | 版本 | 文件 | 用途 |
|---|---|---|---|
| `article-writer` | v1 | `50-ARTICLE-WRITER.md` | 口述整理文章 |
| `image-director` | v1 | `51-IMAGE-DIRECTOR.md` | 生成图片 Brief |
| `video-analyst` | v1 | `52-VIDEO-ANALYST.md` | 合法文字转视频知识卡 |
| `knowledge-card` | v1 | `53-KNOWLEDGE-CARD.md` | 跨源原子卡片 |

## 代码实现方式

1. 将可运行 Prompt 正文提取成版本化 `prompts/*.txt` 或 `prompts/*.json`，避免运行时解析本设计文档的 Markdown。
2. `PromptRegistry.get(key, version)` 返回模板、变量 Schema、hash 和权限控制。
3. 服务端插值先验证字段类型/长度/引用 ID/允许的枚举；系统消息和非可信素材分别发送。
4. 每个 `aiGenerations` 保存 `promptKey/promptVersion/templateHash/model/parameters/sourceIds/creatorId`。
5. 改写 Prompt 不覆盖旧版本；管理员可查看对同一素材 `v1`/`v2` 的并排测试结果（v1.1）。
6. Prompt 文案不能包含 API Key、内部服务器路径或私人固定配置。

## Provider 功能开关

```env
AI_TEXT_ENABLED=false
AI_IMAGE_ENABLED=false
AI_VIDEO_CARD_ENABLED=false
```

当关闭时 UI 解释“请配置供应商 API 才能使用生成功能”，允许手工继续编辑。`true` 时也需要每日额度与故障保护。

## 内容风格与个性化

**个人风格档案**可作为后续私密配置输入（由本人撰写的 2–3 篇文章 + 明确偏好），不直接拿未经授权第三方风格作训练集。此配置仅供风格参考，不覆盖事实性规则。
