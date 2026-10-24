import type { Metadata } from 'next'
import React from 'react'

import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { getSiteSettings } from '@/lib/content'

import './styles.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'),
  title: { default: '何海钊｜人工智能、医疗科研与数字花园', template: '%s｜何海钊' },
  description: '何海钊的数字花园，记录人工智能、医疗科研 AI 培训、产品实践、项目与长期思考。',
  openGraph: { locale: 'zh_CN', siteName: '何海钊的数字花园', type: 'website' },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings()
  return <html lang="zh-CN"><body><SiteHeader /><main>{children}</main><SiteFooter settings={settings} /></body></html>
}
