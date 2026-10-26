'use client'

import { FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'

import type { GenerationResult, ProviderName } from '@/modules/ai'

type Availability = { enabled: boolean; providers: Record<ProviderName, boolean> }
type ErrorResponse = { code?: string; message?: string }
type Usage = { limit: number; used: number; remaining: number }
type SavedDraft = { markdownPath: string; postId: number | string; slug: string; status: 'draft' }
type SourceOption = { authorization: string; id: number | string; kind: 'resource' | 'source-material'; label: string; sections: string[] }
type Sources = { resources: SourceOption[]; sourceMaterials: SourceOption[] }

const providerLabels: Record<ProviderName, string> = { deepseek: 'DeepSeek', stepfun: '阶跃星辰' }

export function AIWritingStudio({ availability, initialUsage, sources }: { availability: Availability; initialUsage: Usage; sources: Sources }) {
  const [provider, setProvider] = useState<ProviderName>('deepseek')
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [saving, setSaving] = useState(false)
  const [slug, setSlug] = useState('')
  const [savedDraft, setSavedDraft] = useState<SavedDraft | null>(null)
  const [usage, setUsage] = useState(initialUsage)
  const [failedTask, setFailedTask] = useState<{ id: number | string; stage?: string } | null>(null)

  const articleText = useMemo(() => {
    if (!result) return ''
    return [result.draft.title, result.draft.summary, ...result.draft.sections.flatMap((section) => [section.heading, ...section.paragraphs])].join('\n\n')
  }, [result])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    setResult(null)
    setFailedTask(null)
    const data = new FormData(event.currentTarget)

    try {
      const response = await fetch('/api/internal/ai/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          contentType: data.get('contentType'),
          tone: data.get('tone'),
          targetLength: Number(data.get('targetLength')),
          manualText: data.get('manualText'),
          resourceIds: data.getAll('resourceIds'),
          sourceMaterialIds: data.getAll('sourceMaterialIds'),
          verifiedFacts: data.get('verifiedFacts'),
        }),
      })
      const body = (await response.json()) as GenerationResult | ErrorResponse
      if (!response.ok) {
        const failed = body as ErrorResponse & { generationId?: number | string; stage?: string }
        if (failed.generationId) setFailedTask({ id: failed.generationId, stage: failed.stage })
        throw new Error(failed.message || '生成失败，请稍后重试。')
      }
      setResult(body as GenerationResult)
      const generated = body as GenerationResult
      setSlug(`ai-draft-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${generated.generationId}`)
      setUsage(generated.usage)
      setSavedDraft(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '生成失败，请稍后重试。')
    } finally {
      setPending(false)
    }
  }

  async function retryTask() {
    if (!failedTask) return
    setPending(true); setError('')
    try {
      const response = await fetch(`/api/internal/ai/workflow/${failedTask.id}/retry`, { method: 'POST' })
      const body = await response.json() as GenerationResult | (ErrorResponse & { generationId?: number | string; stage?: string })
      if (!response.ok) throw new Error('message' in body && body.message ? body.message : '重试失败。')
      const generated = body as GenerationResult
      setResult(generated); setUsage(generated.usage); setFailedTask(null); setSavedDraft(null)
      setSlug(`ai-draft-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${generated.generationId}`)
    } catch (caught) { setError(caught instanceof Error ? caught.message : '重试失败。') } finally { setPending(false) }
  }

  async function saveDraft() {
    if (!result) return
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/internal/ai/draft/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generationId: result.generationId, slug }),
      })
      const body = await response.json() as SavedDraft | ErrorResponse
      if (!response.ok) throw new Error('message' in body && body.message ? body.message : '保存草稿失败。')
      setSavedDraft(body as SavedDraft)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '保存草稿失败。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="studio-grid">
      <form className="studio-form" onSubmit={handleSubmit}>
        <div className="usage-meter"><span>今日调用</span><strong>{usage.used} / {usage.limit}</strong><small>剩余 {usage.remaining} 次</small></div>
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

        <fieldset className="source-picker" disabled={pending}>
          <legend>选择合法来源</legend>
          <p>这里只列出具有个人笔记、本人拥有或明确授权文字的来源。文件原始字节不会发送给模型。</p>
          {[...sources.resources, ...sources.sourceMaterials].length === 0 ? <p className="muted">暂无可用来源，可使用下方个人补充笔记。</p> : <div className="source-option-list">
            {sources.resources.map((source) => <label key={`r-${source.id}`}><input name="resourceIds" type="checkbox" value={source.id} /><span><strong>{source.label}</strong><small>资源 · {source.sections.join('、')} · {source.authorization}</small></span></label>)}
            {sources.sourceMaterials.map((source) => <label key={`s-${source.id}`}><input name="sourceMaterialIds" type="checkbox" value={source.id} /><span><strong>{source.label}</strong><small>来源材料 · {source.sections.join('、')} · {source.authorization}</small></span></label>)}
          </div>}
        </fieldset>
        <label>本次个人补充笔记<textarea name="manualText" placeholder="可补充本人经历、口述记录或写作要求；也可以只选择上方来源" rows={8} /></label>
        <label>已核实事实<textarea name="verifiedFacts" placeholder="时间、地点、参与者、数字或来源；没有可留空" rows={5} /></label>
        <button className="button primary studio-submit" disabled={pending || usage.remaining === 0 || !availability.enabled || !availability.providers[provider]} type="submit">
          {pending ? '正在生成...' : '生成待审核草稿'}
        </button>
        {!availability.enabled && <p className="studio-error">AI 文本功能尚未启用。</p>}
        {error && <p className="studio-error" role="alert">{error}</p>}
        {failedTask && <button className="button secondary" disabled={pending} onClick={retryTask} type="button">从{failedTask.stage === 'draft' ? '文章草稿' : '事实整理'}步骤重试</button>}
      </form>

      <section className="studio-output" aria-live="polite">
        {!result ? <div className="studio-empty"><span>草稿预览</span><p>生成结果将在这里显示。</p></div> : <>
          <div className="studio-output-head"><div><p className="eyebrow">{providerLabels[result.provider]} · {result.model}</p><h2>{result.draft.title}</h2></div><button className="button secondary" onClick={() => navigator.clipboard.writeText(articleText)} type="button">复制正文</button></div>
          <p className="studio-summary">{result.draft.summary}</p>
          {result.factPackage && <div className="fact-package"><h3>事实包</h3><p><strong>已有事实：</strong>{result.factPackage.facts.length} 条</p><p><strong>缺失信息：</strong>{result.factPackage.missingInformation.length} 条</p><p><strong>待人工确认：</strong>{result.factPackage.reviewItems.length} 条</p><ul>{result.factPackage.allowedSources.map((source) => <li key={source.ref}><strong>{source.ref}</strong> {source.label} · {source.authorization}</li>)}</ul></div>}
          {result.draft.sections.map((section) => <article key={section.id}><h3>{section.heading}</h3>{section.paragraphs.map((paragraph, index) => <p key={`${section.id}-${index}`}>{paragraph}</p>)}</article>)}
          <div className="studio-tags">{result.draft.suggestedTags.map((tag) => <span key={tag}>{tag}</span>)}</div>
          <div className="fact-review"><h3>发布前核实</h3>{result.draft.factChecklist.length === 0 ? <p>模型未标记待核实项，仍需人工通读。</p> : <ul>{result.draft.factChecklist.map((fact, index) => <li key={`${fact.claim}-${index}`}><strong>{fact.status === 'verified' ? '已核实' : fact.status === 'missing' ? '缺失' : '不确定'}</strong><span>{fact.claim}{fact.question ? `：${fact.question}` : ''}</span></li>)}</ul>}</div>
          <div className="draft-save-panel">
            <div><h3>保存为文章草稿</h3><p>同时写入 Payload 和 Markdown 副本，不会发布。</p></div>
            <label>文章 Slug<input disabled={Boolean(savedDraft)} onChange={(event) => setSlug(event.target.value)} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required value={slug} /></label>
            <button className="button primary" disabled={saving || Boolean(savedDraft)} onClick={saveDraft} type="button">{savedDraft ? '已保存' : saving ? '保存中...' : '保存草稿'}</button>
            {savedDraft && <div className="draft-saved"><strong>草稿已保存</strong><span>{savedDraft.markdownPath}</span><Link href={`/admin/collections/posts/${savedDraft.postId}`}>在 Payload 中编辑</Link></div>}
          </div>
          <p className="ai-disclosure">AI 辅助生成 · 仅供管理员审核 · 不会自动发布</p>
        </>}
      </section>
    </div>
  )
}
