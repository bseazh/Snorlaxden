import type { Metadata } from 'next'

import { getSiteSettings } from '@/lib/content'

export const metadata: Metadata = { title: '联系', description: '联系何海钊，交流医疗科研 AI 培训、产品实践与合作。' }
export default async function ContactPage() {
  const settings = await getSiteSettings()
  return <div className="page-shell shell contact-layout"><header className="page-header"><p className="eyebrow">CONTACT</p><h1>从一个具体问题开始。</h1><p>欢迎交流医疗科研 AI 培训、工作流设计、智能工具原型与 AI 实践活动。</p></header><div className="contact-panel"><p className="aside-label">EMAIL</p><a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a><p>来信请简要说明背景、目标、参与对象与预期时间，我会据此判断是否适合进一步沟通。</p></div></div>
}

