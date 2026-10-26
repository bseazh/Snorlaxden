import { createHash } from 'node:crypto'

import type { Payload, PayloadRequest } from 'payload'

import { type AuditRequestContext, writeAuditLog } from '@/modules/audit'

import { AIError, type DraftRequest, type FactPackage, type GenerationResult, type WorkflowRequest } from '../domain/types'
import { parseFactPackage, parseGeneratedDraft } from '../domain/validation'
import { createStructuredChatCompletion } from '../infrastructure/openai-compatible-client'
import { articleWriterSystemPrompt } from '../prompts/article-writer-v1'
import { buildDraftFromFactsPrompt, buildFactPackagePrompt, factPackageSystemPrompt, sourceWorkflowPromptVersion } from '../prompts/source-workflow-v1'
import { getProviderConfig } from '../providers/registry'
import { getDailyUsage } from './generation-service'

type Completion = typeof createStructuredChatCompletion
type WorkflowDependencies = { complete?: Completion }

const allowedResourceAccess = new Set(['user_supplied_text', 'authorized_transcript', 'self_owned_media'])

type Relation = number | string | { id: number | string }
const idOf = (value: Relation) => typeof value === 'object' ? value.id : value

export type WorkflowSourceOption = {
  id: number | string
  kind: 'resource' | 'source-material'
  label: string
  authorization: string
  sections: string[]
}

export async function listWorkflowSources(payload: Payload, userId: number | string) {
  const [resources, materials] = await Promise.all([
    payload.find({ collection: 'resources', limit: 100, overrideAccess: true, sort: '-capturedAt', where: { owner: { equals: userId } } }),
    payload.find({ collection: 'source-materials', limit: 100, overrideAccess: true, sort: '-capturedAt', where: { author: { equals: userId } } }),
  ])
  return {
    resources: resources.docs.filter((item) => allowedResourceAccess.has(item.sourceAccess) && Boolean(item.notes?.trim())).map((item) => ({
      authorization: item.sourceAccess,
      id: item.id,
      kind: 'resource' as const,
      label: item.title,
      sections: ['个人笔记'],
    })),
    sourceMaterials: materials.docs.filter((item) => Boolean(item.personalNotes?.trim() || item.authorizedText?.trim())).map((item) => ({
      authorization: `${item.authorizationBasis}：${item.authorizationNote}`,
      id: item.id,
      kind: 'source-material' as const,
      label: item.title,
      sections: [item.personalNotes && '个人笔记', item.sourceDescription && '来源说明', item.authorizedText && '已授权原文'].filter(Boolean) as string[],
    })),
  }
}

async function assembleSources(payload: Payload, userId: number | string, input: WorkflowRequest) {
  const parts: string[] = []
  const resourceIds = input.resourceIds.map(String)
  const materialIds = input.sourceMaterialIds.map(String)
  const sources = await listWorkflowSources(payload, userId)
  const allowedResources = new Map(sources.resources.map((item) => [String(item.id), item]))
  const allowedMaterials = new Map(sources.sourceMaterials.map((item) => [String(item.id), item]))
  if (resourceIds.some((id) => !allowedResources.has(id)) || materialIds.some((id) => !allowedMaterials.has(id))) {
    throw new AIError('SOURCE_NOT_AUTHORIZED', '选择的来源不存在、没有可用文字或不属于当前管理员。', 403)
  }

  for (const rawId of input.resourceIds) {
    const resource = await payload.findByID({ collection: 'resources', id: rawId, overrideAccess: true })
    parts.push(`[R:${resource.id}] ${resource.title}\n[个人笔记]\n${resource.notes?.trim()}`)
  }
  for (const rawId of input.sourceMaterialIds) {
    const material = await payload.findByID({ collection: 'source-materials', id: rawId, overrideAccess: true })
    const sections = [
      material.personalNotes?.trim() && `[个人笔记]\n${material.personalNotes.trim()}`,
      material.sourceDescription?.trim() && `[来源说明，仅作出处背景，不等于原文事实]\n${material.sourceDescription.trim()}`,
      material.authorizedText?.trim() && `[已授权原文]\n${material.authorizedText.trim()}`,
    ].filter(Boolean)
    parts.push(`[S:${material.id}] ${material.title}\n[授权依据] ${material.authorizationBasis}：${material.authorizationNote}\n${sections.join('\n')}`)
  }
  if (input.manualText) parts.push(`[M:manual] 管理员本次补充\n[个人笔记]\n${input.manualText}`)
  const sourceText = parts.join('\n\n---\n\n')
  if (sourceText.length < 20 || sourceText.length > 50_000) throw new AIError('VALIDATION_ERROR', '合法来源装配后的文字需为 20 至 50000 个字符。', 400)
  return { sourceText, resourceIds: input.resourceIds, sourceMaterialIds: input.sourceMaterialIds }
}

function requestFromRecord(record: { request?: unknown; provider?: unknown; sourceText?: unknown; verifiedFacts?: unknown }): DraftRequest {
  const request = record.request as Record<string, unknown>
  return {
    contentType: request.contentType as DraftRequest['contentType'],
    provider: record.provider as DraftRequest['provider'],
    sourceText: String(record.sourceText || ''),
    targetLength: Number(request.targetLength),
    tone: request.tone as DraftRequest['tone'],
    verifiedFacts: String(record.verifiedFacts || ''),
  }
}

async function executeWorkflow(payload: Payload, user: NonNullable<PayloadRequest['user']>, generationId: number | string, request?: AuditRequestContext, dependencies: WorkflowDependencies = {}): Promise<GenerationResult> {
  const complete = dependencies.complete ?? createStructuredChatCompletion
  const generation = await payload.findByID({ collection: 'ai-generations', id: generationId, overrideAccess: true })
  if (String(idOf(generation.creator as Relation)) !== String(user.id)) throw new AIError('GENERATION_NOT_FOUND', '找不到这条生成任务。', 404)
  if (generation.status === 'cancelled' || generation.status === 'succeeded' || generation.status === 'saved_as_draft') throw new AIError('TASK_NOT_RETRYABLE', '当前任务状态不能重试。', 409)
  const input = requestFromRecord(generation)
  const config = getProviderConfig(input.provider)
  let factPackage = generation.factPackage as FactPackage | undefined
  let stage: 'facts' | 'draft' = factPackage ? 'draft' : 'facts'
  await payload.update({ collection: 'ai-generations', id: generation.id, data: { currentStep: stage, errorCode: null, errorMessage: null, status: 'running' }, overrideAccess: true })
  try {
    if (!factPackage) {
      const usage = await getDailyUsage(payload, user.id)
      if (usage.remaining === 0) throw new AIError('RATE_LIMITED', `今日 AI 调用已达到 ${usage.limit} 次上限。`, 429)
      await payload.update({ collection: 'ai-generations', id: generation.id, data: { modelCallCount: (generation.modelCallCount || 0) + 1 }, overrideAccess: true })
      const factsRaw = await complete(config, [
        { role: 'system', content: factPackageSystemPrompt },
        { role: 'user', content: buildFactPackagePrompt(input.sourceText, input.verifiedFacts) },
      ], { maxTokens: 2500, temperature: 0.1 })
      factPackage = parseFactPackage(factsRaw)
      await payload.update({ collection: 'ai-generations', id: generation.id, data: { currentStep: 'draft', factPackage }, overrideAccess: true })
      await writeAuditLog(payload, { action: 'ai.workflow.facts_succeeded', actorId: user.id, metadata: { factCount: factPackage.facts.length }, request, resourceId: generation.id, resourceType: 'ai-generation' })
    }
    stage = 'draft'
    const usageBeforeDraft = await getDailyUsage(payload, user.id)
    if (usageBeforeDraft.remaining === 0) throw new AIError('RATE_LIMITED', `今日 AI 调用已达到 ${usageBeforeDraft.limit} 次上限。事实包已保存，可在限额恢复后从草稿步骤重试。`, 429)
    const refreshed = await payload.findByID({ collection: 'ai-generations', id: generation.id, overrideAccess: true })
    await payload.update({ collection: 'ai-generations', id: generation.id, data: { modelCallCount: (refreshed.modelCallCount || 0) + 1 }, overrideAccess: true })
    const draftRaw = await complete(config, [
      { role: 'system', content: articleWriterSystemPrompt },
      { role: 'user', content: buildDraftFromFactsPrompt(input, factPackage, input.sourceText) },
    ])
    const draft = parseGeneratedDraft(draftRaw)
    await payload.update({ collection: 'ai-generations', id: generation.id, data: { currentStep: 'complete', result: draft, status: 'succeeded' }, overrideAccess: true })
    await writeAuditLog(payload, { action: 'ai.workflow.succeeded', actorId: user.id, metadata: { provider: input.provider, promptVersion: sourceWorkflowPromptVersion }, request, resourceId: generation.id, resourceType: 'ai-generation' })
    const usage = await getDailyUsage(payload, user.id)
    return { draft, factPackage, generationId: generation.id, model: config.model, promptVersion: sourceWorkflowPromptVersion, provider: input.provider, usage }
  } catch (error) {
    const aiError = error instanceof AIError ? error : new AIError('GENERATION_FAILED', '生成失败，请稍后重试。', 500)
    await payload.update({ collection: 'ai-generations', id: generation.id, data: { currentStep: stage, errorCode: aiError.code, errorMessage: aiError.message, status: 'failed' }, overrideAccess: true })
    await writeAuditLog(payload, { action: 'ai.workflow.failed', actorId: user.id, metadata: { errorCode: aiError.code, stage }, outcome: 'failure', request, resourceId: generation.id, resourceType: 'ai-generation' })
    throw new AIError(aiError.code, aiError.message, aiError.status, generation.id, stage)
  }
}

export async function createSourceWorkflow(payload: Payload, user: NonNullable<PayloadRequest['user']>, input: WorkflowRequest, request?: AuditRequestContext, dependencies: WorkflowDependencies = {}) {
  if (process.env.AI_TEXT_ENABLED !== 'true') throw new AIError('AI_DISABLED', 'AI 文本生成功能当前未启用。', 503)
  const usage = await getDailyUsage(payload, user.id)
  if (usage.remaining === 0) throw new AIError('RATE_LIMITED', `今日 AI 调用已达到 ${usage.limit} 次上限。`, 429)
  const assembled = await assembleSources(payload, user.id, input)
  const config = getProviderConfig(input.provider)
  const generation = await payload.create({
    collection: 'ai-generations', overrideAccess: true,
    data: {
      creator: user.id, currentStep: 'facts', model: config.model, promptVersion: sourceWorkflowPromptVersion,
      provider: input.provider, request: { contentType: input.contentType, targetLength: input.targetLength, tone: input.tone },
      resources: assembled.resourceIds, retryCount: 0, modelCallCount: 0, sourceHash: createHash('sha256').update(assembled.sourceText).digest('hex'),
      sourceMaterials: assembled.sourceMaterialIds, sourceText: assembled.sourceText, status: 'queued', verifiedFacts: input.verifiedFacts,
    },
  })
  await writeAuditLog(payload, { action: 'ai.workflow.queued', actorId: user.id, metadata: { resourceCount: assembled.resourceIds.length, sourceMaterialCount: assembled.sourceMaterialIds.length }, request, resourceId: generation.id, resourceType: 'ai-generation' })
  return executeWorkflow(payload, user, generation.id, request, dependencies)
}

export async function retrySourceWorkflow(payload: Payload, user: NonNullable<PayloadRequest['user']>, generationId: number | string, request?: AuditRequestContext, dependencies: WorkflowDependencies = {}) {
  const record = await payload.findByID({ collection: 'ai-generations', id: generationId, overrideAccess: true }).catch(() => null)
  if (!record || String(idOf(record.creator as Relation)) !== String(user.id)) throw new AIError('GENERATION_NOT_FOUND', '找不到这条生成任务。', 404)
  if (record.status !== 'failed' || record.promptVersion !== sourceWorkflowPromptVersion) throw new AIError('TASK_NOT_RETRYABLE', '只有失败的来源工作流任务可以重试。', 409)
  await payload.update({ collection: 'ai-generations', id: record.id, data: { retryCount: (record.retryCount || 0) + 1, status: 'queued' }, overrideAccess: true })
  await writeAuditLog(payload, { action: 'ai.workflow.retried', actorId: user.id, metadata: { retryCount: (record.retryCount || 0) + 1, resumeStep: record.factPackage ? 'draft' : 'facts' }, request, resourceId: record.id, resourceType: 'ai-generation' })
  return executeWorkflow(payload, user, record.id, request, dependencies)
}
