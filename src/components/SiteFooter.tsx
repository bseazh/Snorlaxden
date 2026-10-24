import Link from 'next/link'

import type { SiteSetting } from '@/payload-types'

export function SiteFooter({ settings }: { settings: SiteSetting }) {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div><p className="footer-name">{settings.displayName}</p><p className="muted">研究、实践、教学，以及持续生长的知识记录。</p></div>
        <div className="footer-links"><Link href="/projects">项目</Link><Link href="/journal">文章</Link><a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a></div>
        <p className="footer-meta">© {new Date().getFullYear()} {settings.displayName}</p>
      </div>
    </footer>
  )
}

