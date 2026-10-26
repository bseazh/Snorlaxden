import Link from 'next/link'

import type { SiteSetting } from '@/payload-types'

export function SiteFooter({ settings }: { settings: SiteSetting }) {
  const icpNumber = settings.icpNumber?.trim()
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div><p className="footer-name">{settings.displayName}</p><p className="muted">研究、实践、教学，以及持续生长的知识记录。</p></div>
        <div className="footer-links"><Link href="/about">关于</Link><Link href="/projects">项目</Link><Link href="/journal">文章</Link><Link href="/garden">花园</Link><Link href="/manage">管理入口</Link><a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a></div>
        <div className="footer-meta">
          <p>© {new Date().getFullYear()} {settings.displayName}</p>
          {icpNumber ? <a href="https://beian.miit.gov.cn/" rel="noreferrer" target="_blank">{icpNumber}</a> : null}
        </div>
      </div>
    </footer>
  )
}
