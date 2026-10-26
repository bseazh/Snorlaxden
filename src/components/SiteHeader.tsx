import Link from 'next/link'

const navItems = [
  ['关于', '/about'], ['项目', '/projects'], ['文章', '/journal'], ['花园', '/garden'], ['AI 助手', '/assistant'], ['联系', '/contact'],
] as const

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" href="/" aria-label="何海钊数字花园首页">
          <span className="brand-mark" aria-hidden="true">HZ</span><span>Snorlaxden</span>
        </Link>
        <nav className="primary-nav" aria-label="主导航">
          {navItems.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}
          <Link className="admin-entry" href="/manage">管理入口</Link>
        </nav>
      </div>
    </header>
  )
}
