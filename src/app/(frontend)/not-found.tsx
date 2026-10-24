import Link from 'next/link'
export default function NotFound() {
  return <div className="page-shell shell not-found"><p className="eyebrow">404</p><h1>这条路径还没有长出内容。</h1><p>它可能尚未发布，也可能已经撤回。</p><Link className="button primary" href="/">返回首页</Link></div>
}

