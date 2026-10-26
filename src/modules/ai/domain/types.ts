export const providerNames = ['deepseek', 'stepfun'] as const
export type ProviderName = (typeof providerNames)[number]

export const contentTypes = ['event-reflection', 'learning-note', 'project-case', 'book-review'] as const
export type ContentType = (typeof contentTypes)[number]

export const tones = ['natural-professional', 'concise', 'story-driven'] as const
export type Tone = (typeof tones)[number]

export type DraftRequest = {
  provider: ProviderName
  contentType: ContentType
  tone: Tone
  targetLength: number
  sourceText: string
  verifiedFacts: string
}

export type SourceSelection = {
  resourceIds: number[]
  sourceMaterialIds: number[]
  manualText: string
}

export type WorkflowRequest = Omit<DraftRequest, 'sourceText'> & SourceSelection

export type FactPackage = {
  facts: Array<{ claim: string; evidenceRefs: string[] }>
  missingInformation: string[]
  reviewItems: string[]
  allowedSources: Array<{ ref: string; label: string; authorization: string }>
}

export type DraftSection = {
  id: string
  heading: string
  paragraphs: string[]
}

export type FactCheck = {
  claim: string
  status: 'verified' | 'missing' | 'uncertain'
  question: string
}

export type GeneratedDraft = {
  title: string
  summary: string
  outline: string[]
  sections: DraftSection[]
  factChecklist: FactCheck[]
  suggestedTags: string[]
  disclosure: { aiAssisted: true }
}

export type GenerationResult = {
  generationId: number | string
  provider: ProviderName
  model: string
  promptVersion: 'article-writer-v1' | 'source-workflow-v1'
  draft: GeneratedDraft
  factPackage?: FactPackage
  usage: { limit: number; used: number; remaining: number }
}

export class AIError extends Error {
  constructor(
    public readonly code:
      | 'AI_DISABLED'
      | 'VALIDATION_ERROR'
      | 'PROVIDER_UNAVAILABLE'
      | 'RATE_LIMITED'
      | 'GENERATION_NOT_FOUND'
      | 'DRAFT_ALREADY_SAVED'
      | 'SOURCE_NOT_FOUND'
      | 'SOURCE_NOT_AUTHORIZED'
      | 'TASK_NOT_RETRYABLE'
      | 'GENERATION_FAILED',
    message: string,
    public readonly status: number,
    public readonly generationId?: number | string,
    public readonly stage?: 'facts' | 'draft',
  ) {
    super(message)
  }
}
