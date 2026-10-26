import { describe, expect, it } from 'vitest'

import { AIError } from '@/modules/ai'
import { parseFactPackage, parseGeneratedDraft, validateDraftRequest, validateWorkflowRequest } from '@/modules/ai/domain/validation'

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

  it('requires a selected source or manual note and normalizes relation IDs', () => {
    expect(() => validateWorkflowRequest({ provider: 'deepseek', contentType: 'learning-note', tone: 'concise', targetLength: 800, manualText: '', resourceIds: [], sourceMaterialIds: [], verifiedFacts: '' })).toThrowError(/至少选择/)
    const input = validateWorkflowRequest({ provider: 'deepseek', contentType: 'learning-note', tone: 'concise', targetLength: 800, manualText: '', resourceIds: ['12'], sourceMaterialIds: [4], verifiedFacts: '' })
    expect(input.resourceIds).toEqual([12])
    expect(input.sourceMaterialIds).toEqual([4])
  })

  it('parses a bounded fact package with explicit evidence references', () => {
    const facts = parseFactPackage(JSON.stringify({
      facts: [{ claim: '活动由本人组织。', evidenceRefs: ['R:12'] }],
      missingInformation: ['活动日期'], reviewItems: ['确认参与人数'],
      allowedSources: [{ ref: 'R:12', label: '活动笔记', authorization: 'user_supplied_text' }],
      ignored: 'not exposed',
    }))
    expect(facts.facts[0].evidenceRefs).toEqual(['R:12'])
    expect(facts).not.toHaveProperty('ignored')
  })
})
