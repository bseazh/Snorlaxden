export type AssistantPreset = {
  answer: string
  id: string
  question: string
  relatedUrl?: string
}

export type AssistantCitation = {
  id: string
  kind: 'about' | 'faq' | 'post' | 'project'
  title: string
  url: string
}

export type AssistantAnswer = {
  answer: string
  citations: AssistantCitation[]
  usage: {
    limit: number
    remaining: number
    used: number
  }
}

export class PublicAssistantError extends Error {
  constructor(
    public readonly code: 'ASSISTANT_DISABLED' | 'INVALID_QUESTION' | 'PROVIDER_UNAVAILABLE' | 'RATE_LIMITED' | 'ANSWER_FAILED',
    message: string,
    public readonly status: number,
  ) {
    super(message)
  }
}
