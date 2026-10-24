# 模块 35｜AI 图像生成、CU 适配与内置提示词

## 首先消除 CU 的歧义

当前需求中的“CU”可能表示：

1. **ComfyUI**（图像生成工作流节点编排工具，有服务端 API 与工作流 JSON）：适合希望选择模型/LoRA、设计模板与本地 GPU 的场景。
2. **Computer Use**（使用自动化工具操作图形界面）：可以模拟用户操作网页工具，但稳定性、服务条款和凭证安全不如 API。
3. 也可能是其他图片服务名，须以具体接口确认。

**架构决策**：第一版以图像服务的**直接 HTTP API**为主；定义 `ImageProvider`，以后可增加 `ComfyUIProvider`。Computer Use 只能作为受控实验性工具链，不能假定能自动操作任意商业网站，也不把登录账号密码直接交给模型。

## 生成链路（路径 A 的图片支线）

`AI 文稿 sections` → `ImageDirector 提取图片需求 brief` → `管理员选风格和数量` → `适配器生成` → `私有媒体存储` → `预览选择与 alt` → `插入文章` → `人工发布`。

### v1.0 范围

- 手动生成 **一张封面图**（P1 可开关），可使用已提供的提示词或由文稿摘要生成 prompt。
- 支持宽高比 `16:9`, `4:3`, `1:1`，如模型不支持则由适配器降级或返回受控错误。
- 不承诺 API 一定会返回无水印、不带错误文字的图片；生成后管理员审核。
- 失败可返回到「继续手动上传图片」，绝不阻塞文章发布。

### v1.1 增强

- 按章节生成 `imageSlots[]`，通常每 2–3 段给一个图片位；可单独重做某张而不重写全文。
- 图文排版模板：封面/正文横图/双列图/引用信息卡；保存图片 alt/说明、生成来源与模型。
- 从“我自己的照片”到“概念配图”分流：不允许把他人的照片虚构成活动现场证据。

## 适配器接口（TypeScript 伪代码）

```ts
type ImageRequest = {
  brief: string;
  stylePreset: 'editorial-clean'|'warm-story'|'tech-diagram';
  aspectRatio: '16:9'|'4:3'|'1:1';
  negativePrompt?: string;
  seed?: number;
  count: number;
  sourcePostId?: string;
  promptVersion: string;
};
type ImageResult = {
  images: Array<{privateStorageKey:string; mimeType:string; width:number; height:number}>;
  providerJobId?: string;
  provider: string;
  model: string;
};
interface ImageProvider {
  generate(req: ImageRequest): Promise<ImageResult>;
}
```

`HttpImageAPIProvider` 使用官方服务端 API；`ComfyUIProvider` 根据工作流 JSON 映射文本/尺寸/种子，提交生成任务并通过合法服务端状态接口轮询或 WebSocket 等方式回收输出。ComfyUI 服务**不得裸露在公网**，不依赖未经身份验证的开放端口。

## Prompt 存储与编辑（内置提示词）

- 版本化目录 `05-prompts/` 是默认模板源（Code as Configuration）。
- `promptTemplates` CMS 集合是**后续可选**的管理员定制编辑界面；每次修改生成一个新版本，无法悄悄修改历史任务使用的版本。
- 生成请求只传规范变量：`{{article_title}}`, `{{section_summary}}`, `{{visual_goal}}`, `{{style_preset}}`, `{{aspect_ratio}}`, `{{brand_palette}}`, `{{avoid_elements}}`。
- 所有提示词模板自带限制：不虚构真实活动照片、不使用未经授权的明星肖像/Logo、不用受版权限制的特定风格直接复制、只输出需要的配图。
- 本地提示词文件示例：[图像导演提示词](../05-prompts/51-IMAGE-DIRECTOR.md)。

## 图片发布策略

- 默认 private 存储；只有管理员确认的图片才进入公开素材库。
- 图片元数据记录：`aiGenerated`, `sourceGenerationId`, `promptVersion`, `model`, `createdAt`, `alt`, `copyrightReviewStatus`。
- 发布前生成压缩 webp/avif 尺寸变体（首期用简单图像优化）；可在页面适当位置标记“AI 辅助生成配图”。
- 取消或撤回文章时评估是否继续公共引用；未被其他公开页使用的独立配图应随公开副本撤回。

## 成本/安全策略

- 只允许管理员调用，单次最多 1 张（v1）、每日总次数/单任务费用上线前设定；服务端 key 私有。
- 防止模型返回私有内网下载 URL 被直接抓取；下载图片仅允许验证过的服务方主机且限制大小/超时/内容类型。
- ComfyUI 图片任务可能耗费 GPU 内存；若云服务器无 GPU，优先用外部 API，不要部署 ComfyUI GPU 工作流。
- Computer Use 涉及浏览器凭证/网页互动时，隔离环境、最小权限、日志审计、有人审核敏感操作。

## 验收

- 配置 API 后，输入中文 brief 能生成封面候选，预览后手动插入文章。
- 图片生成失败、超时或余额不足时，文章仍可正常发布。
- 修改提示词 `v2` 不影响旧文章和历史生成记录，能追溯旧 `v1`。
- 访客看不到私有候选图、原始提示词内部信息或 API 凭证。
