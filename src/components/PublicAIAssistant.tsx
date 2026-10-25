'use client'

import { Bot, ExternalLink, Send } from 'lucide-react'
import Link from 'next/link'
import { FormEvent, useEffect, useRef, useState } from 'react'

import type { AssistantAnswer, AssistantCitation, AssistantPreset } from '@/modules/public-assistant/types'

type Message = {
  citations?: AssistantCitation[]
  id: string
  role: 'assistant' | 'user'
  text: string
}

type ErrorResponse = { message?: string }

export function PublicAIAssistant({ presets }: { presets: AssistantPreset[] }) {
  const [pending, setPending] = useState(false)
  const [question, setQuestion] = useState('')
  const [remaining, setRemaining] = useState<number | null>(null)
  const [messages, setMessages] = useState<Message[]>([{
    id: 'welcome',
    role: 'assistant',
    text: '你好，我是何海钊数字花园的 AI 助手。你可以从下面的问题开始。',
  }])
  const inputRef = useRef<HTMLInputElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, pending])

  function choosePreset(preset: AssistantPreset) {
    const id = crypto.randomUUID()
    setMessages((current) => [...current,
      { id: `${id}-question`, role: 'user', text: preset.question },
      {
        citations: preset.relatedUrl ? [{ id: preset.id, kind: 'faq', title: '查看相关内容', url: preset.relatedUrl }] : undefined,
        id: `${id}-answer`,
        role: 'assistant',
        text: preset.answer,
      },
    ])
  }

  async function askQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = question.trim()
    if (value.length < 2 || pending) return
    const id = crypto.randomUUID()
    setQuestion('')
    setPending(true)
    setMessages((current) => [...current, { id: `${id}-question`, role: 'user', text: value }])

    try {
      const response = await fetch('/api/public/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: value }),
      })
      const body = await response.json() as AssistantAnswer | ErrorResponse
      if (!response.ok) throw new Error('message' in body && body.message ? body.message : 'AI 暂时不可用，请选择预设问题。')
      const answer = body as AssistantAnswer
      setRemaining(answer.usage.remaining)
      setMessages((current) => [...current, { citations: answer.citations, id: `${id}-answer`, role: 'assistant', text: answer.answer }])
    } catch (error) {
      setMessages((current) => [...current, {
        id: `${id}-fallback`,
        role: 'assistant',
        text: error instanceof Error ? error.message : 'AI 暂时不可用，请选择预设问题。',
      }])
    } finally {
      setPending(false)
    }
  }

  return <section aria-label="何海钊 AI 助手" className="assistant-workspace" role="region">
      <header className="assistant-header">
        <span className="assistant-avatar"><Bot aria-hidden="true" size={20} /></span>
        <div><strong>数字花园助手</strong><small>基于已公开内容回答</small></div>
        {remaining !== null && <span className="assistant-remaining">今日剩余 {remaining} 次</span>}
      </header>

      <div aria-live="polite" className="assistant-messages" ref={messagesRef}>
        {messages.map((message) => <div className={`assistant-message ${message.role}`} key={message.id}>
          <p>{message.text}</p>
          {message.citations && message.citations.length > 0 && <div className="assistant-citations">
            {message.citations.map((citation) => <Link href={citation.url} key={citation.id}><ExternalLink aria-hidden="true" size={13} />{citation.title}</Link>)}
          </div>}
        </div>)}
        {pending && <div className="assistant-message assistant pending"><p>正在查找公开资料...</p></div>}
      </div>

      <div className="assistant-presets" aria-label="推荐问题">
        {presets.map((preset) => <button disabled={pending} key={preset.id} onClick={() => choosePreset(preset)} type="button">{preset.question}</button>)}
      </div>

      <form className="assistant-form" onSubmit={askQuestion}>
        <label className="sr-only" htmlFor="public-assistant-question">输入问题</label>
        <input autoComplete="off" disabled={pending} id="public-assistant-question" maxLength={300} onChange={(event) => setQuestion(event.target.value)} placeholder="输入你想了解的问题" ref={inputRef} value={question} />
        <button aria-label="发送问题" disabled={pending || question.trim().length < 2} type="submit"><Send aria-hidden="true" size={19} /></button>
      </form>
      <p className="assistant-disclosure">AI 可能出错，请以引用页面为准。</p>
    </section>
}
