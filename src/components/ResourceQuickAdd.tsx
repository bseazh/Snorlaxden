'use client'

import { BookOpen, CalendarDays, FileText, ImageIcon, Link2, LoaderCircle, Plus, Video } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'

const types = [
  ['note', '短记', FileText], ['link', '网页', Link2], ['video', '视频', Video],
  ['book', '图书', BookOpen], ['image', '图片', ImageIcon], ['activity', '活动', CalendarDays],
] as const

export function ResourceQuickAdd() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setMessage('')
    const form = event.currentTarget
    const fields = new FormData(form)
    try {
      const response = await fetch('/api/internal/resources', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(fields)),
      })
      const result = await response.json() as { message?: string }
      if (!response.ok) throw new Error(result.message || '保存失败。')
      form.reset()
      setMessage('已保存为私有资源。')
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败。')
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="resource-composer" onSubmit={submit}>
      <div className="resource-composer-head">
        <div><strong>快速收藏</strong><span>默认私有，不抓取网页内容</span></div>
        <select aria-label="可见性" defaultValue="private" name="visibility">
          <option value="private">仅自己可见</option>
          <option value="review">待审核</option>
          <option value="public">公开候选</option>
        </select>
      </div>
      <input aria-label="资源标题" maxLength={180} name="title" placeholder="记录一个标题" required />
      <input aria-label="来源 URL" inputMode="url" maxLength={2048} name="sourceUrl" placeholder="https://（可选，仅保存安全 URL）" type="url" />
      <textarea aria-label="个人笔记" maxLength={12000} name="notes" placeholder="写下你的判断、摘记或后续行动（不与来源描述混用）" rows={4} />
      <div className="resource-composer-actions">
        <div className="resource-type-options" role="radiogroup" aria-label="资源类型">
          {types.map(([value, label, Icon], index) => <label key={value}><input defaultChecked={index === 0} name="resourceType" type="radio" value={value} /><span title={label}><Icon size={15} />{label}</span></label>)}
        </div>
        <button className="resource-add-button" disabled={pending} type="submit">{pending ? <LoaderCircle className="spin" size={17} /> : <Plus size={17} />}<span>{pending ? '保存中' : '收藏'}</span></button>
      </div>
      {message ? <p aria-live="polite" className="resource-form-message">{message}</p> : null}
    </form>
  )
}
