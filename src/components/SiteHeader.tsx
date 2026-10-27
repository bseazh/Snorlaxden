'use client'

import { Menu, ShieldCheck, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

const navItems = [
  ['关于', '/about'], ['项目', '/projects'], ['文章', '/journal'], ['花园', '/garden'], ['AI 助手', '/assistant'], ['联系', '/contact'],
] as const

export function SiteHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const navigation = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusable = Array.from(navigation.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') || [])
    focusable[0]?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        menuButton.current?.focus()
        return
      }
      if (event.key !== 'Tab' || focusable.length === 0) return
      const first = focusable[0]
      const last = focusable.at(-1)!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const current = (href: string) => pathname === href || (href !== '/' && pathname.startsWith(`${href}/`))

  return (
    <header className={`site-header${open ? ' menu-open' : ''}`}>
      <div className="shell header-inner">
        <Link className="brand" href="/" aria-label="何海钊数字花园首页">
          <span className="brand-mark" aria-hidden="true">HZ</span><span><strong>何海钊</strong><small>Snorlaxden</small></span>
        </Link>
        <button
          aria-controls="primary-navigation"
          aria-expanded={open}
          aria-label={open ? '关闭主菜单' : '打开主菜单'}
          className="nav-toggle"
          onClick={() => setOpen((value) => !value)}
          ref={menuButton}
          type="button"
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
        <nav className="primary-nav" aria-label="主导航" id="primary-navigation" ref={navigation}>
          <div className="nav-public-links">
            {navItems.map(([label, href]) => <Link aria-current={current(href) ? 'page' : undefined} href={href} key={href} onClick={() => setOpen(false)}>{label}</Link>)}
          </div>
          <div className="nav-admin-group">
            <span>内容管理</span>
            <Link aria-current={current('/manage') ? 'page' : undefined} className="admin-entry" href="/manage" onClick={() => setOpen(false)}><ShieldCheck aria-hidden="true" />管理入口</Link>
          </div>
        </nav>
      </div>
    </header>
  )
}
