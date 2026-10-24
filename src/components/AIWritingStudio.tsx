'use client'

import { FormEvent, useMemo, useState } from 'react'

import type { GenerationResult, ProviderName } from '@/modules/ai'

type Availability = { enabled: boolean; providers: Record<ProviderName, boolean> }
type ErrorResponse = { code?: string; message?: string }

const providerLabels: Record<ProviderName, string> = { deepseek: 'DeepSeek', stepfun: '阶跃星辰' }

export function AIWritingStudio({ availability }: { availability: Availability }) {
  const [provider, setProvider] = useState<ProviderName>('deepseek')
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const articleText = useMemo(() => {
    if (!result) return ''
    return [result.draft.title, result.draft.summary, ...result.draft.sections.flatMap((section) => [section.heading, ...section.paragraphs])].join('\n\n')
  }, [result])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    setResult(null)
    const data = new FormData(event.currentTarget)

    try {
      const response = await fetch('/api/internal/ai/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          contentType: data.get('contentType'),
          tone: data.get('tone'),
          targetLength: Number(data.get('targetLength')),
          sourceText: data.get('sourceText'),
          verifiedFacts: data.get('verifiedFacts'),
        }),
      })
      const body = (await response.json()) as GenerationResult | ErrorResponse
      if (!response.ok) throw new Error('message' in body && body.message ? body.message : '生成失败，请稍后重试。')
      setResult(body as GenerationResult)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '生成失败，请稍后重试。')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="studio-grid">
      <form className="studio-form" onSubmit={handleSubmit}>
        <fieldset className="provider-switch" disabled={pending || !availability.enabled}>
          <legend>模型供应商</legend>
          {(['deepseek', 'stepfun'] as const).map((name) => (
            <label className={provider === name ? 'active' : ''} key={name}>
              <input checked={provider === name} disabled={!availability.providers[name]} name="provider" onChange={() => setProvider(name)} type="radio" />
              <span>{providerLabels[name]}</span>
              <small>{availability.providers[name] ? '已配置' : '未配置'}</small>
            </label>
          ))}
        </fieldset>

        <div className="studio-form-row">
          <label>文章类型<select defaultValue="event-reflection" name="contentType"><option value="event-reflection">活动复盘</option><option value="learning-note">学习总结</option><option value="project-case">项目案例</option><option value="book-review">读书笔记</option></select></label>
          <label>表达口吻<select defaultValue="natural-professional" name="tone"><option value="natural-professional">自然专业</option><option value="concise">简洁直接</option><option value="story-driven">故事化</option></select></label>
          <label>目标字数<input defaultValue="1000" max="3000" min="400" name="targetLength" step="100" type="number" /></label>
        </div>

        <label>原始素材<textarea minLength={20} name="sourceText" placeholder="粘贴口述记录、活动笔记或项目素材" required rows={13} /></label>
        <label>已核实事实<textarea name="verifiedFacts" placeholder="时间、地点、参与者、数字或来源；没有可留空" rows={5} /></label>
        <button className="button primary studio-submit" disabled={pending || !availability.enabled || !availability.providers[provider]} type="submit">
          {pending ? '正在生成...' : '生成待审核草稿'}
        </button>
        {!availability.enabled && <p className="studio-error">AI 文本功能尚未启用。</p>}
        {error && <p className="studio-error" role="alert">{error}</p>}
      </form>

      <section className="studio-output" aria-live="polite">
        {!result ? <div className="studio-empty"><span>草稿预览</span><p>生成结果将在这里显示。</p></div> : <>
          <div className="studio-output-head"><div><p className="eyebrow">{providerLabels[result.provider]} · {result.model}</p><h2>{result.draft.title}</h2></div><button className="button secondary" onClick={() => navigator.clipboard.writeText(articleText)} type="button">复制正文</button></div>
          <p className="studio-summary">{result.draft.summary}</p>
          {result.draft.sections.map((section) => <article key={section.id}><h3>{section.heading}</h3>{section.paragraphs.map((paragraph, index) => <p key={`${section.id}-${index}`}>{paragraph}</p>)}</article>)}
          <div className="studio-tags">{result.draft.suggestedTags.map((tag) => <span key={tag}>{tag}</span>)}</div>
          <div className="fact-review"><h3>发布前核实</h3>{result.draft.factChecklist.length === 0 ? <p>模型未标记待核实项，仍需人工通读。</p> : <ul>{result.draft.factChecklist.map((fact, index) => <li key={`${fact.claim}-${index}`}><strong>{fact.status === 'verified' ? '已核实' : fact.status === 'missing' ? '缺失' : '不确定'}</strong><span>{fact.claim}{fact.question ? `：${fact.question}` : ''}</span></li>)}</ul>}</div>
          <p className="ai-disclosure">AI 辅助生成 · 仅供管理员审核 · 不会自动发布</p>
        </>}
      </section>
    </div>
  )
}
