'use client'

import { FileUp, LoaderCircle, ShieldCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'

export function SourceMaterialUpload() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setMessage('')
    const form = event.currentTarget
    try {
      const response = await fetch('/api/internal/source-materials/upload', { body: new FormData(form), method: 'POST' })
      const result = await response.json() as { message?: string; sourceId?: string }
      if (!response.ok) throw new Error(result.message || '上传失败。')
      form.reset()
      setMessage(`已保存为私有来源材料（${result.sourceId}）。`)
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '上传失败。')
    } finally {
      setPending(false)
    }
  }

  return <details className="resource-upload">
    <summary><span><FileUp size={17} />上传私有材料</span><small>PDF / 图片，最大 10MB</small></summary>
    <form onSubmit={submit}>
      <input accept="application/pdf,image/jpeg,image/png,image/webp,image/avif" aria-label="来源材料文件" name="file" required type="file" />
      <input aria-label="材料标题" maxLength={180} name="title" placeholder="材料标题" required type="text" />
      <label>授权依据<select defaultValue="owned" name="authorizationBasis"><option value="owned">本人原创或拥有</option><option value="permission">已获明确许可</option><option value="open_license">开放许可</option><option value="public_domain">公有领域</option></select></label>
      <textarea aria-label="授权说明" maxLength={3000} name="authorizationNote" placeholder="说明所有权、许可来源或开放许可条款" required rows={2} />
      <textarea aria-label="材料个人笔记" maxLength={20000} name="personalNotes" placeholder="个人笔记（可选）" rows={2} />
      <textarea aria-label="材料来源说明" maxLength={5000} name="sourceDescription" placeholder="来源说明（可选，与个人笔记分开）" rows={2} />
      <button className="resource-add-button" disabled={pending} type="submit">{pending ? <LoaderCircle className="spin" size={17} /> : <ShieldCheck size={17} />}<span>{pending ? '上传中' : '私有保存'}</span></button>
      {message ? <p aria-live="polite" className="resource-form-message">{message}</p> : null}
    </form>
  </details>
}
