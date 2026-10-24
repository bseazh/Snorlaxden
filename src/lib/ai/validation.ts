import {
  AIError,
  contentTypes,
  providerNames,
  tones,
  type DraftRequest,
  type GeneratedDraft,
} from './types'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const requireString = (value: unknown, field: string, maxLength: number) => {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    throw new AIError('GENERATION_FAILED', `模型返回的 ${field} 格式不正确。`, 502)
  }
  return value.trim()
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
