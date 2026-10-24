import { createHash } from 'node:crypto'

import type { Payload, PayloadRequest } from 'payload'

import { type AuditRequestContext, writeAuditLog } from '@/modules/audit'

import { AIError, type DraftRequest, type GeneratedDraft, type GenerationResult } from '../domain/types'
import { parseGeneratedDraft } from '../domain/validation'
import { createStructuredChatCompletion } from '../infrastructure/openai-compatible-client'
import { buildArticleWriterPrompt, articleWriterSystemPrompt, promptVersion } from '../prompts/article-writer-v1'
import { getProviderConfig } from '../providers/registry'

const DEFAULT_DAILY_LIMIT = 20

function dailyLimit() {
  const configured = Number(process.env.AI_DAILY_LIMIT || DEFAULT_DAILY_LIMIT)
  return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_DAILY_LIMIT
}

function startOfUtcDay() {
  const date = new Date()
  date.setUTCHours(0, 0, 0, 0)
  return date.toISOString()
}

export async function getDailyUsage(payload: Payload, userId: number | string) {
  const result = await payload.count({
    collection: 'ai-generations',
    overrideAccess: true,
    where: {
      and: [
        { creator: { equals: userId } },
        { createdAt: { greater_than_equal: startOfUtcDay() } },
      ],
    },
  })
  const limit = dailyLimit()
  return { limit, used: result.totalDocs, remaining: Math.max(0, limit - result.totalDocs) }
}

export async function generateAndRecordArticleDraft(
  payload: Payload,
  user: NonNullable<PayloadRequest['user']>,
  input: DraftRequest,
  request?: AuditRequestContext,
): Promise<GenerationResult> {
  if (process.env.AI_TEXT_ENABLED !== 'true') {
    await writeAuditLog(payload, { action: 'ai.generation.denied', actorId: user.id, metadata: { reason: 'AI_DISABLED' }, outcome: 'denied', request, resourceType: 'ai-generation' })
    throw new AIError('AI_DISABLED', 'AI 文本生成功能当前未启用。', 503)
  }

  const usage = await getDailyUsage(payload, user.id)
  if (usage.remaining === 0) {
    await writeAuditLog(payload, { action: 'ai.generation.denied', actorId: user.id, metadata: { limit: usage.limit, reason: 'RATE_LIMITED' }, outcome: 'denied', request, resourceType: 'ai-generation' })
    throw new AIError('RATE_LIMITED', `今日 AI 调用已达到 ${usage.limit} 次上限。`, 429)
  }

  const config = getProviderConfig(input.provider)
  const sourceHash = createHash('sha256').update(input.sourceText).digest('hex')
  const generation = await payload.create({
    collection: 'ai-generations',
    data: {
      creator: user.id,
      provider: input.provider,
      model: config.model,
      promptVersion,
      status: 'running',
      sourceHash,
      sourceText: input.sourceText,
      verifiedFacts: input.verifiedFacts,
      request: {
        contentType: input.contentType,
        tone: input.tone,
        targetLength: input.targetLength,
      },
    },
    overrideAccess: true,
  })
  await writeAuditLog(payload, {
    action: 'ai.generation.started',
    actorId: user.id,
    metadata: { model: config.model, provider: input.provider, promptVersion },
    request,
    resourceId: generation.id,
    resourceType: 'ai-generation',
  })

  try {
    const content = await createStructuredChatCompletion(config, [
      { role: 'system', content: articleWriterSystemPrompt },
      { role: 'user', content: buildArticleWriterPrompt(input) },
    ])
    const draft = parseGeneratedDraft(content)
    await payload.update({
      collection: 'ai-generations',
      id: generation.id,
      data: { result: draft, status: 'succeeded' },
      overrideAccess: true,
    })
    await writeAuditLog(payload, {
      action: 'ai.generation.succeeded',
      actorId: user.id,
      metadata: { model: config.model, provider: input.provider, promptVersion },
      request,
      resourceId: generation.id,
      resourceType: 'ai-generation',
    })

    return {
      generationId: generation.id,
      provider: input.provider,
      model: config.model,
      promptVersion,
      draft,
      usage: { ...usage, used: usage.used + 1, remaining: Math.max(0, usage.remaining - 1) },
    }
  } catch (error) {
    const aiError = error instanceof AIError
      ? error
      : new AIError('GENERATION_FAILED', '生成失败，请稍后重试。', 500)
    await payload.update({
      collection: 'ai-generations',
      id: generation.id,
      data: { errorCode: aiError.code, errorMessage: aiError.message, status: 'failed' },
      overrideAccess: true,
    })
    await writeAuditLog(payload, {
      action: 'ai.generation.failed',
      actorId: user.id,
      metadata: { errorCode: aiError.code, model: config.model, provider: input.provider },
      outcome: 'failure',
      request,
      resourceId: generation.id,
      resourceType: 'ai-generation',
    })
    throw aiError
  }
}

export function readGeneratedDraft(value: unknown): GeneratedDraft {
  return parseGeneratedDraft(JSON.stringify(value))
}
