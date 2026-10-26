'use client'

import Image from 'next/image'
import Link from 'next/link'
import { FormEvent, useState } from 'react'

type Usage = { limit: number; remaining: number; used: number }
type Sources = {
  posts: Array<{ id: number | string; label: string; summary: string }>
  references: Array<{ authorization: string; id: number | string; label: string; mimeType?: string | null }>
}
type Candidate = { byteSize: number; height: number; id: string; mimeType: string; previewURL: string; sha256: string; status: string; width: number }
type Result = { candidates: Candidate[]; errorMessage?: string; generationId: number | string; model: string; promptVersion: string; selectedMediaId?: number | string; status: string }
type ErrorBody = { generationId?: number | string; message?: string }

export function AIImageStudio({ availability, initialUsage, sources }: {
  availability: { enabled: boolean; model: string; provider: 'sophnet' }
  initialUsage: Usage
  sources: Sources
}) {
  const [result, setResult] = useState<Result | null>(null)
  const [usage, setUsage] = useState(initialUsage)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [failedGenerationId, setFailedGenerationId] = useState<number | string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(''); setResult(null); setFailedGenerationId(null)
    const data = new FormData(event.currentTarget)
    try {
      const response = await fetch('/api/internal/ai/images/generate', {
        body: JSON.stringify({
          aspectRatio: data.get('aspectRatio'), count: Number(data.get('count')), postId: data.get('postId'),
          referenceMaterialId: data.get('referenceMaterialId'), stylePreset: data.get('stylePreset'), visualGoal: data.get('visualGoal'),
        }),
        headers: { 'Content-Type': 'application/json' }, method: 'POST',
      })
      const body = await response.json() as Result | ErrorBody
      if (!response.ok) {
        const failure = body as ErrorBody
        if (failure.generationId) setFailedGenerationId(failure.generationId)
        throw new Error(failure.message || '图片生成失败。')
      }
      const completed = body as Result
      setResult(completed)
      setUsage((current) => ({ ...current, remaining: Math.max(0, current.remaining - Number(data.get('count'))), used: current.used + Number(data.get('count')) }))
    } catch (caught) { setError(caught instanceof Error ? caught.message : '图片生成失败。') }
    finally { setPending(false) }
  }

  async function retry() {
    if (!failedGenerationId) return
    setPending(true); setError('')
    try {
      const response = await fetch(`/api/internal/ai/images/${failedGenerationId}/retry`, { method: 'POST' })
      const body = await response.json() as Result | ErrorBody
      if (!response.ok) throw new Error((body as ErrorBody).message || '重试失败。')
      setResult(body as Result); setFailedGenerationId(null)
    } catch (caught) { setError(caught instanceof Error ? caught.message : '重试失败。') }
    finally { setPending(false) }
  }

  async function select(candidateId: string) {
    if (!result) return
    setPending(true); setError('')
    try {
      const response = await fetch(`/api/internal/ai/images/${result.generationId}/select`, { body: JSON.stringify({ candidateId }), headers: { 'Content-Type': 'application/json' }, method: 'POST' })
      const body = await response.json() as { mediaId?: number | string; message?: string }
      if (!response.ok || !body.mediaId) throw new Error(body.message || '选用图片失败。')
      setResult({ ...result, candidates: result.candidates.map((item) => item.id === candidateId ? { ...item, status: 'selected' } : item), selectedMediaId: body.mediaId, status: 'selected' })
    } catch (caught) { setError(caught instanceof Error ? caught.message : '选用图片失败。') }
    finally { setPending(false) }
  }

  async function discard(candidateId: string) {
    if (!result) return
    setPending(true); setError('')
    try {
      const response = await fetch(`/api/internal/ai/images/${result.generationId}/candidates/${candidateId}`, { method: 'DELETE' })
      const body = await response.json() as { message?: string }
      if (!response.ok) throw new Error(body.message || '删除失败。')
      setResult({ ...result, candidates: result.candidates.filter((item) => item.id !== candidateId) })
    } catch (caught) { setError(caught instanceof Error ? caught.message : '删除失败。') }
    finally { setPending(false) }
  }

  const ready = sources.posts.length > 0 && sources.references.length > 0
  return <div className="image-studio-grid">
    <form className="studio-form" onSubmit={submit}>
      <div className="usage-meter"><span>今日图片调用</span><strong>{usage.used} / {usage.limit}</strong><small>剩余 {usage.remaining} 次</small></div>
      <div className="provider-card"><span>SophNet</span><strong>{availability.model}</strong><small>{availability.enabled ? '已配置' : '未启用'}</small></div>
      <label>文章草稿<select name="postId" required><option value="">请选择</option>{sources.posts.map((post) => <option key={post.id} value={post.id}>{post.label}</option>)}</select></label>
      <label>人物参考资产<select name="referenceMaterialId" required><option value="">请选择</option>{sources.references.map((reference) => <option key={reference.id} value={reference.id}>{reference.label}</option>)}</select></label>
      {sources.references.length === 0 && <p className="muted">暂无合法图片参考材料。请先把本人拥有或明确获授权的图片上传为私有来源材料。</p>}
      <div className="studio-form-row">
        <label>风格<select defaultValue="character-editorial" name="stylePreset"><option value="character-editorial">人物编辑插画</option><option value="warm-story">温暖叙事</option><option value="tech-garden">数字花园</option></select></label>
        <label>比例<select defaultValue="16:9" name="aspectRatio"><option value="16:9">16:9</option><option value="4:3">4:3</option><option value="1:1">1:1</option></select></label>
        <label>候选数量<select defaultValue="1" name="count"><option value="1">1 张</option><option value="2">2 张</option><option value="3">3 张</option><option value="4">4 张</option></select></label>
      </div>
      <label>本次视觉要求<textarea defaultValue="女孩在安静书桌前整理知识卡片，画面体现知识连接、持续学习和数字花园。" maxLength={800} minLength={4} name="visualGoal" required rows={6} /></label>
      <button className="button primary" disabled={pending || !availability.enabled || !ready || usage.remaining === 0} type="submit">{pending ? '正在处理...' : '生成私有候选图'}</button>
      <p className="muted">参考图和候选图均为私有；AI 不会自动选择图片或发布文章。</p>
      {error && <p className="studio-error" role="alert">{error}</p>}
      {failedGenerationId && <button className="button secondary" disabled={pending} onClick={retry} type="button">重试未完成图片</button>}
    </form>

    <section className="image-candidate-panel" aria-live="polite">
      {!result ? <div className="studio-empty"><span>封面候选区</span><p>生成结果将在这里显示，只有管理员能够读取。</p></div> : <>
        <div className="studio-output-head"><div><p className="eyebrow">{result.model} · {result.promptVersion}</p><h2>候选封面</h2></div><span className="status-pill">{result.status}</span></div>
        {result.errorMessage && <p className="studio-error">部分任务失败：{result.errorMessage}</p>}
        <div className="candidate-grid">{result.candidates.map((candidate) => <article className="candidate-card" key={candidate.id}>
          <div className="candidate-image"><Image alt="AI 封面候选图" fill sizes="(max-width: 800px) 100vw, 40vw" src={candidate.previewURL} unoptimized /></div>
          <p>{candidate.width} × {candidate.height} · {(candidate.byteSize / 1024).toFixed(0)} KB</p>
          <div className="candidate-actions">{candidate.status === 'selected' ? <strong>已选用</strong> : <><button className="button primary" disabled={pending || Boolean(result.selectedMediaId)} onClick={() => select(candidate.id)} type="button">选为文章封面</button><button className="button secondary" disabled={pending} onClick={() => discard(candidate.id)} type="button">删除</button></>}</div>
        </article>)}</div>
        {result.selectedMediaId && <div className="draft-saved"><strong>已进入正式 Media，并绑定文章草稿</strong><Link href={`/admin/collections/media/${result.selectedMediaId}`}>查看 Media</Link></div>}
      </>}
    </section>
  </div>
}

