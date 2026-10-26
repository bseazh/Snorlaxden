import {
  AIError,
  contentTypes,
  providerNames,
  tones,
  type DraftRequest,
  type FactPackage,
  type GeneratedDraft,
  type WorkflowRequest,
} from './types'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const requireString = (value: unknown, field: string, maxLength: number) => {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    throw new AIError('GENERATION_FAILED', `模型返回的 ${field} 格式不正确。`, 502)
  }
  return value.trim()
}

function relationIds(value: unknown, field: string) {
  if (!Array.isArray(value) || value.length > 10) throw new AIError('VALIDATION_ERROR', `${field} 格式不正确。`, 400)
  const ids = value.map((id) => typeof id === 'number' ? id : (typeof id === 'string' && /^\d+$/.test(id) ? Number(id) : null))
  if (ids.some((id) => id === null)) throw new AIError('VALIDATION_ERROR', `${field} 包含无效 ID。`, 400)
  return [...new Set(ids as number[])]
}

export function validateWorkflowRequest(value: unknown): WorkflowRequest {
  if (!isRecord(value)) throw new AIError('VALIDATION_ERROR', '请求格式不正确。', 400)
  const manualText = typeof value.manualText === 'string' ? value.manualText.trim() : ''
  if (manualText.length > 12_000) throw new AIError('VALIDATION_ERROR', '补充笔记不能超过 12000 个字符。', 400)
  const resourceIds = relationIds(value.resourceIds ?? [], '资源选择')
  const sourceMaterialIds = relationIds(value.sourceMaterialIds ?? [], '来源材料选择')
  if (!manualText && resourceIds.length === 0 && sourceMaterialIds.length === 0) {
    throw new AIError('VALIDATION_ERROR', '请至少选择一项合法来源或填写个人补充笔记。', 400)
  }
  const validated = validateDraftRequest({ ...value, sourceText: manualText.length >= 20 ? manualText : '由已选择的合法来源材料组成，具体内容将在服务端完成鉴权后装配。' })
  return { ...validated, manualText, resourceIds, sourceMaterialIds }
}

export function parseFactPackage(raw: string): FactPackage {
  const normalized = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let value: unknown
  try { value = JSON.parse(normalized) } catch { throw new AIError('GENERATION_FAILED', '模型没有返回有效的事实包。', 502) }
  if (!isRecord(value) || !Array.isArray(value.facts) || !Array.isArray(value.missingInformation) || !Array.isArray(value.reviewItems) || !Array.isArray(value.allowedSources)) {
    throw new AIError('GENERATION_FAILED', '模型返回的事实包格式不正确。', 502)
  }
  return {
    facts: value.facts.slice(0, 30).map((fact) => {
      if (!isRecord(fact) || !Array.isArray(fact.evidenceRefs)) throw new AIError('GENERATION_FAILED', '事实证据格式不正确。', 502)
      return { claim: requireString(fact.claim, '事实', 500), evidenceRefs: fact.evidenceRefs.slice(0, 10).map((ref) => requireString(ref, '证据引用', 100)) }
    }),
    missingInformation: value.missingInformation.slice(0, 20).map((item) => requireString(item, '缺失信息', 500)),
    reviewItems: value.reviewItems.slice(0, 20).map((item) => requireString(item, '待确认项', 500)),
    allowedSources: value.allowedSources.slice(0, 20).map((source) => {
      if (!isRecord(source)) throw new AIError('GENERATION_FAILED', '允许引用来源格式不正确。', 502)
      return { ref: requireString(source.ref, '来源引用', 100), label: requireString(source.label, '来源名称', 200), authorization: requireString(source.authorization, '授权依据', 200) }
    }),
  }
}

export function validateDraftRequest(value: unknown): DraftRequest {
  if (!isRecord(value)) throw new AIError('VALIDATION_ERROR', '请求格式不正确。', 400)

  const provider = value.provider
  const contentType = value.contentType
  const tone = value.tone
  const sourceText = typeof value.sourceText === 'string' ? value.sourceText.trim() : ''
  const verifiedFacts = typeof value.verifiedFacts === 'string' ? value.verifiedFacts.trim() : ''
  const targetLength = Number(value.targetLength)

  if (!providerNames.includes(provider as DraftRequest['provider'])) {
    throw new AIError('VALIDATION_ERROR', '请选择有效的模型供应商。', 400)
  }
  if (!contentTypes.includes(contentType as DraftRequest['contentType'])) {
    throw new AIError('VALIDATION_ERROR', '请选择有效的文章类型。', 400)
  }
  if (!tones.includes(tone as DraftRequest['tone'])) {
    throw new AIError('VALIDATION_ERROR', '请选择有效的写作口吻。', 400)
  }
  if (sourceText.length < 20 || sourceText.length > 12_000) {
    throw new AIError('VALIDATION_ERROR', '原始素材需为 20 至 12000 个字符。', 400)
  }
  if (verifiedFacts.length > 4_000) {
    throw new AIError('VALIDATION_ERROR', '已核实事实不能超过 4000 个字符。', 400)
  }
  if (!Number.isInteger(targetLength) || targetLength < 400 || targetLength > 3_000) {
    throw new AIError('VALIDATION_ERROR', '目标字数需为 400 至 3000。', 400)
  }

  return {
    provider: provider as DraftRequest['provider'],
    contentType: contentType as DraftRequest['contentType'],
    tone: tone as DraftRequest['tone'],
    sourceText,
    verifiedFacts,
    targetLength,
  }
}

export function parseGeneratedDraft(raw: string): GeneratedDraft {
  const normalized = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let value: unknown
  try {
    value = JSON.parse(normalized)
  } catch {
    throw new AIError('GENERATION_FAILED', '模型没有返回有效的 JSON 草稿。', 502)
  }
  if (!isRecord(value)) throw new AIError('GENERATION_FAILED', '模型返回的草稿格式不正确。', 502)

  if (!Array.isArray(value.outline) || !Array.isArray(value.sections) || !Array.isArray(value.factChecklist) || !Array.isArray(value.suggestedTags)) {
    throw new AIError('GENERATION_FAILED', '模型返回的草稿缺少必要字段。', 502)
  }

  const sections = value.sections.slice(0, 8).map((section, index) => {
    if (!isRecord(section) || !Array.isArray(section.paragraphs)) {
      throw new AIError('GENERATION_FAILED', '模型返回的文章段落格式不正确。', 502)
    }
    return {
      id: typeof section.id === 'string' && section.id ? section.id.slice(0, 80) : `section-${index + 1}`,
      heading: requireString(section.heading, '段落标题', 160),
      paragraphs: section.paragraphs.slice(0, 10).map((paragraph) => requireString(paragraph, '正文', 4_000)),
    }
  })
  if (sections.length === 0) throw new AIError('GENERATION_FAILED', '模型没有返回正文段落。', 502)

  const factChecklist = value.factChecklist.slice(0, 20).map((fact) => {
    if (!isRecord(fact) || !['verified', 'missing', 'uncertain'].includes(String(fact.status))) {
      throw new AIError('GENERATION_FAILED', '模型返回的事实清单格式不正确。', 502)
    }
    const claim = typeof fact.claim === 'string' ? fact.claim : fact.item
    return {
      claim: requireString(claim, '事实描述', 500),
      status: fact.status as 'verified' | 'missing' | 'uncertain',
      question: typeof fact.question === 'string' ? fact.question.trim().slice(0, 500) : '',
    }
  })

  return {
    title: requireString(value.title, '标题', 200),
    summary: requireString(value.summary, '摘要', 500),
    outline: value.outline.slice(0, 10).map((item) => requireString(item, '文章结构', 160)),
    sections,
    factChecklist,
    suggestedTags: value.suggestedTags.slice(0, 12).map((tag) => requireString(tag, '标签', 60)),
    disclosure: { aiAssisted: true },
  }
}
