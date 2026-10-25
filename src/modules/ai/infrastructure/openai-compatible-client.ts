import { AIError } from '../domain/types'
import type { ProviderConfig } from '../providers/registry'

type Message = { role: 'system' | 'user'; content: string }

type CompletionOptions = {
  maxTokens?: number
  temperature?: number
  timeoutMs?: number
}

export async function createStructuredChatCompletion(config: ProviderConfig, messages: Message[], options: CompletionOptions = {}) {
  if (!config.key) {
    throw new AIError('PROVIDER_UNAVAILABLE', `${config.label} 尚未配置服务端密钥。`, 503)
  }

  let response: Response
  try {
    response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        messages,
        response_format: { type: 'json_object' },
        temperature: options.temperature ?? 0.5,
        max_tokens: options.maxTokens ?? 4_000,
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 90_000),
    })
  } catch {
    throw new AIError('PROVIDER_UNAVAILABLE', `${config.label} 暂时无法连接。`, 503)
  }

  if (!response.ok) {
    if (response.status === 402 || response.status === 429) {
      throw new AIError('RATE_LIMITED', `${config.label} 当前额度不足或请求过于频繁。`, 429)
    }
    throw new AIError('PROVIDER_UNAVAILABLE', `${config.label} 返回错误（${response.status}）。`, 502)
  }

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const content = payload.choices?.[0]?.message?.content
  if (!content) throw new AIError('GENERATION_FAILED', '模型没有返回有效内容。', 502)
  return content
}
