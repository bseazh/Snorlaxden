import { describe, expect, it } from 'vitest'

import { AIError } from '@/lib/ai/types'
import { parseGeneratedDraft, validateDraftRequest } from '@/lib/ai/validation'

describe('AI draft validation', () => {
  it('accepts a bounded administrator draft request', () => {
    const input = validateDraftRequest({
      provider: 'deepseek',
      contentType: 'event-reflection',
      tone: 'natural-professional',
      targetLength: 1000,
      sourceText: '这是一段超过二十个字符的真实活动记录，用来验证输入边界和字段映射。',
      verifiedFacts: '活动由本人组织。',
    })
    expect(input.provider).toBe('deepseek')
    expect(input.sourceText).toContain('真实活动记录')
  })

  it('rejects short or oversized inputs before calling a provider', () => {
    expect(() => validateDraftRequest({ provider: 'deepseek', contentType: 'event-reflection', tone: 'concise', targetLength: 1000, sourceText: '太短', verifiedFacts: '' })).toThrowError(AIError)
  })

  it('maps only the structured draft fields used by the UI', () => {
    const draft = parseGeneratedDraft(JSON.stringify({
      title: '一次真实的活动复盘',
      summary: '保留事实边界的摘要。',
      outline: ['背景', '收获'],
      sections: [{ id: 's1', heading: '背景', paragraphs: ['我根据已有记录整理了这次经历。'], ignored: '<script />' }],
      factChecklist: [{ item: '活动地点', status: 'missing', question: '活动在哪里举行？' }],
      suggestedTags: ['活动复盘'],
      disclosure: { aiAssisted: false },
      ignored: 'not exposed',
    }))
    expect(draft.disclosure.aiAssisted).toBe(true)
    expect(draft.sections[0]).not.toHaveProperty('ignored')
    expect(draft).not.toHaveProperty('ignored')
  })
})
