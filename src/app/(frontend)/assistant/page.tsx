import type { Metadata } from 'next'

import { PublicAIAssistant } from '@/components/PublicAIAssistant'
import { getFAQItems } from '@/modules/content'

export const metadata: Metadata = {
  title: 'AI 助手',
  description: '从何海钊数字花园已经公开的研究、项目与文章中查找答案。',
}

export default async function AssistantPage() {
  const faqItems = await getFAQItems()
  const presets = faqItems.slice(0, 8).map((item) => ({
    answer: item.answer,
    id: `faq-${item.id}`,
    question: item.question,
    relatedUrl: item.relatedUrl || undefined,
  }))

  return <div className="assistant-page">
    <div className="shell assistant-page-inner">
      <header className="assistant-page-heading">
        <p className="eyebrow">PUBLIC AI</p>
        <h1>数字花园<br />助手</h1>
        <p>关于研究、项目、文章与合作，直接问我。</p>
      </header>
      <PublicAIAssistant presets={presets} />
    </div>
  </div>
}
