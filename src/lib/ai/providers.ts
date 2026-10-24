import { buildArticleWriterPrompt, articleWriterSystemPrompt, promptVersion } from './prompt'
import { parseGeneratedDraft } from './validation'
import { AIError, type DraftRequest, type GenerationResult, type ProviderName } from './types'

type ProviderConfig = { baseUrl: string; key?: string; model: string }

const providerConfig = (provider: ProviderName): ProviderConfig => {
  if (provider === 'stepfun') {
    return {
      baseUrl: process.env.STEPFUN_BASE_URL || 'https://api.stepfun.com/v1',
      key: process.env.STEPFUN_API_KEY,
      model: process.env.STEPFUN_MODEL || 'step-3.5-flash',
    }
  }
  return {
    baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    key: process.env.DEEPSEEK_API_KEY,
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  }
}

const providerLabel: Record<ProviderName, string> = { deepseek: 'DeepSeek', stepfun: '阶跃星辰' }

export async function generateArticleDraft(input: DraftRequest): Promise<GenerationResult> {
  if (process.env.AI_TEXT_ENABLED !== 'true') {
    throw new AIError('AI_DISABLED', 'AI 文本生成功能当前未启用。', 503)
  }

  const config = providerConfig(input.provider)
  if (!config.key) {
    throw new AIError('PROVIDER_UNAVAILABLE', `${providerLabel[input.provider]} 尚未配置服务端密钥。`, 503)
  }

  let response: Response
  try {
    response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: articleWriterSystemPrompt },
          { role: 'user', content: buildArticleWriterPrompt(input) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.5,
        max_tokens: 4_000,
      }),
      signal: AbortSignal.timeout(90_000),
    })
  } catch {
    throw new AIError('PROVIDER_UNAVAILABLE', `${providerLabel[input.provider]} 暂时无法连接。`, 503)
  }

  if (!response.ok) {
    if (response.status === 402 || response.status === 429) {
      throw new AIError('RATE_LIMITED', `${providerLabel[input.provider]} 当前额度不足或请求过于频繁。`, 429)
    }
    throw new AIError('PROVIDER_UNAVAILABLE', `${providerLabel[input.provider]} 返回错误（${response.status}）。`, 502)
  }

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const content = payload.choices?.[0]?.message?.content
  if (!content) throw new AIError('GENERATION_FAILED', '模型没有返回文章草稿。', 502)

  return {
    provider: input.provider,
    model: config.model,
    promptVersion,
    draft: parseGeneratedDraft(content),
  }
}

export function getProviderAvailability() {
  return {
    enabled: process.env.AI_TEXT_ENABLED === 'true',
    providers: {
      deepseek: Boolean(process.env.DEEPSEEK_API_KEY),
      stepfun: Boolean(process.env.STEPFUN_API_KEY),
    },
  }
}
