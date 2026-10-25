export const RESOURCE_TYPES = ['note', 'video', 'book', 'image', 'activity', 'link'] as const
export const RESOURCE_VISIBILITIES = ['private', 'review', 'public'] as const
export const RESOURCE_INGEST_STATUSES = ['saved_only', 'metadata_ready', 'text_ready', 'card_draft', 'reviewed', 'failed'] as const
export const RESOURCE_SOURCE_ACCESS = ['url_only', 'metadata', 'user_supplied_text', 'authorized_transcript', 'self_owned_media'] as const

export type ResourceType = (typeof RESOURCE_TYPES)[number]
export type ResourceVisibility = (typeof RESOURCE_VISIBILITIES)[number]
export type ResourceIngestStatus = (typeof RESOURCE_INGEST_STATUSES)[number]
export type ResourceSourceAccess = (typeof RESOURCE_SOURCE_ACCESS)[number]

export class ResourceError extends Error {
  constructor(
    public readonly code: 'DUPLICATE_RESOURCE' | 'INVALID_INPUT' | 'UNSAFE_URL',
    message: string,
    public readonly status = 400,
  ) {
    super(message)
    this.name = 'ResourceError'
  }
}

