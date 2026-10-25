import { createHash } from 'node:crypto'

import type { Payload } from 'payload'

import { createStructuredChatCompletion } from '@/modules/ai/infrastructure/openai-compatible-client'
import { getProviderConfig } from '@/modules/ai/providers/registry'
import { getAuditRequestDetails, writeAuditLog } from '@/modules/audit'

import { getPublicKnowledge, knowledgePrompt, publicCitations } from './knowledge-service'
import { buildPublicAssistantPrompt, publicAssistantPromptVersion, publicAssistantSystemPrompt } from './prompt'
import { type AssistantAnswer, PublicAssistantError } from './types'

const DEFAULT_DAILY_LIMIT = 10

function dailyLimit() {
  const configured = Number(process.env.PUBLIC_AI_DAILY_LIMIT || DEFAULT_DAILY_LIMIT)
  return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_DAILY_LIMIT
}

function startOfUtcDay() {
  const date = new Date()
  date.setUTCHours(0, 0, 0, 0)
  return date.toISOString()
}

function validateQuestion(value: unknown) {
  if (typeof value !== 'string') throw new PublicAssistantError('INVALID_QUESTION', '请输入想了解的问题。', 400)
  const question = value.trim().replaceAll(/\s+/g, ' ')
  if (question.length < 2 || question.length > 300) throw new PublicAssistantError('INVALID_QUESTION', '问题长度应为 2 至 300 个字符。', 400)
  return question
}

function parseModelAnswer(raw: string) {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new PublicAssistantError('ANSWER_FAILED', 'AI 暂时没有返回可用回答，请选择下方预设问题。', 502)
  }
  if (!parsed || typeof parsed !== 'object') throw new PublicAssistantError('ANSWER_FAILED', 'AI 暂时没有返回可用回答，请选择下方预设问题。', 502)
  const answer = (parsed as Record<string, unknown>).answer
  const citationIds = (parsed as Record<string, unknown>).citationIds
  if (typeof answer !== 'string' || answer.trim().length === 0 || !Array.isArray(citationIds)) {
    throw new PublicAssistantError('ANSWER_FAILED', 'AI 暂时没有返回可用回答，请选择下方预设问题。', 502)
  }
  return { answer: answer.trim().slice(0, 1_500), citationIds: citationIds.filter((id): id is string => typeof id === 'string').slice(0, 4) }
}

export async function getPublicAssistantUsage(payload: Payload, headers: Headers) {
  const { ipHash } = getAuditRequestDetails({ headers })
  const result = await payload.count({
    collection: 'audit-logs',
    overrideAccess: true,
    where: { and: [
      { action: { equals: 'public-assistant.question.started' } },
      { ipHash: { equals: ipHash } },
      { createdAt: { greater_than_equal: startOfUtcDay() } },
    ] },
  })
  const limit = dailyLimit()
  return { ipHash, limit, used: result.totalDocs, remaining: Math.max(0, limit - result.totalDocs) }
}

export async function answerPublicQuestion(payload: Payload, rawQuestion: unknown, headers: Headers): Promise<AssistantAnswer> {
  const question = validateQuestion(rawQuestion)
  const requestDetails = getAuditRequestDetails({ headers })
  const request = { headers, requestId: requestDetails.requestId }
  const auditSalt = process.env.AUDIT_IP_HASH_SALT || process.env.PAYLOAD_SECRET || 'local-audit-salt'
  const questionHash = createHash('sha256').update(`${auditSalt}:${question}`).digest('hex')

  if (process.env.PUBLIC_AI_ENABLED !== 'true') {
    await writeAuditLog(payload, { action: 'public-assistant.question.denied', metadata: { questionHash, reason: 'ASSISTANT_DISABLED' }, outcome: 'denied', request, resourceType: 'public-assistant' })
    throw new PublicAssistantError('ASSISTANT_DISABLED', '自由问答暂未开放，请先选择下方预设问题。', 503)
  }

  const usage = await getPublicAssistantUsage(payload, headers)
  if (usage.remaining === 0) {
    await writeAuditLog(payload, { action: 'public-assistant.question.denied', metadata: { limit: usage.limit, questionHash, reason: 'RATE_LIMITED' }, outcome: 'denied', request, resourceType: 'public-assistant' })
    throw new PublicAssistantError('RATE_LIMITED', `今日自由问答已达到 ${usage.limit} 次，请继续使用预设问题。`, 429)
  }

  const config = getProviderConfig('deepseek')
  await writeAuditLog(payload, {
    action: 'public-assistant.question.started',
    metadata: { model: config.model, promptVersion: publicAssistantPromptVersion, provider: 'deepseek', questionHash, questionLength: question.length },
    request,
    resourceType: 'public-assistant',
  })

  try {
    const sources = await getPublicKnowledge(payload)
    const raw = await createStructuredChatCompletion(config, [
      { role: 'system', content: publicAssistantSystemPrompt },
      { role: 'user', content: buildPublicAssistantPrompt(question, knowledgePrompt(sources)) },
    ], { maxTokens: 700, temperature: 0.2, timeoutMs: 35_000 })
    const modelAnswer = parseModelAnswer(raw)
    const allowedCitations = publicCitations(sources)
    const citations = modelAnswer.citationIds.map((id) => allowedCitations.get(id)).filter((citation) => citation !== undefined)
    if (citations.length === 0) throw new PublicAssistantError('ANSWER_FAILED', '现有公开资料中没有足够信息回答这个问题，请选择预设问题。', 502)

    await writeAuditLog(payload, { action: 'public-assistant.question.succeeded', metadata: { citationCount: citations.length, model: config.model, questionHash }, request, resourceType: 'public-assistant' })
    return { answer: modelAnswer.answer, citations, usage: { limit: usage.limit, used: usage.used + 1, remaining: usage.remaining - 1 } }
  } catch (error) {
    await writeAuditLog(payload, { action: 'public-assistant.question.failed', metadata: { errorCode: error instanceof PublicAssistantError ? error.code : 'PROVIDER_UNAVAILABLE', model: config.model, questionHash }, outcome: 'failure', request, resourceType: 'public-assistant' })
    if (error instanceof PublicAssistantError) throw error
    throw new PublicAssistantError('PROVIDER_UNAVAILABLE', 'AI 暂时不可用，请选择下方预设问题。', 503)
  }
}

export { validateQuestion }
