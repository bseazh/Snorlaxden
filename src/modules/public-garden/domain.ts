export type PublicGardenNoteRule = {
  output: string
  source: string
}

export type PublicGardenAttachmentRule = {
  authorization: 'open_license' | 'owned' | 'permission' | 'public_domain'
  output: string
  sha256: string
  source: string
}

export type PublicGardenExportConfig = {
  attachments: PublicGardenAttachmentRule[]
  notes: PublicGardenNoteRule[]
  version: 1
}

export type PublicGardenAuditEvent = {
  action: 'public-garden.export_failed' | 'public-garden.export_rejected' | 'public-garden.exported'
  metadata: Record<string, boolean | number | string>
  outcome: 'failure' | 'success'
}

export type PublicGardenManifest = {
  attachments: Array<{
    authorization: PublicGardenAttachmentRule['authorization']
    byteSize: number
    output: string
    referencedBy: string[]
    sha256: string
    sourceFingerprint: string
  }>
  generatedAt: string
  notes: Array<{
    output: string
    sha256: string
    sourceFingerprint: string
    title: string
  }>
  removedEntries: number
  version: 1
}

export class PublicGardenError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message)
  }
}
