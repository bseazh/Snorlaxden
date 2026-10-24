import { AIError, type DraftRequest, type GenerationResult } from '../domain/types'
import { parseGeneratedDraft } from '../domain/validation'
import { createStructuredChatCompletion } from '../infrastructure/openai-compatible-client'
import { buildArticleWriterPrompt, articleWriterSystemPrompt, promptVersion } from '../prompts/article-writer-v1'
import { getProviderConfig } from '../providers/registry'

export async function generateArticleDraft(input: DraftRequest): Promise<GenerationResult> {
  if (process.env.AI_TEXT_ENABLED !== 'true') {
    throw new AIError('AI_DISABLED', 'AI 文本生成功能当前未启用。', 503)
  }

  const config = getProviderConfig(input.provider)
  const content = await createStructuredChatCompletion(config, [
    { role: 'system', content: articleWriterSystemPrompt },
    { role: 'user', content: buildArticleWriterPrompt(input) },
  ])

  return {
    provider: input.provider,
    model: config.model,
    promptVersion,
    draft: parseGeneratedDraft(content),
  }
}
