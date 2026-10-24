import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: '知识花园', description: '何海钊持续整理中的公开知识花园。' }
export default function GardenPage() {
  return <div className="page-shell shell garden-page"><p className="eyebrow">KNOWLEDGE GARDEN</p><h1>这里不是完成品陈列室，<br />而是知识生长的现场。</h1><p>公开 Obsidian 笔记正在按白名单、附件检查与撤回机制建设。在独立花园上线前，经过整理和审核的内容会先发布到文章区。</p><Link className="button primary" href="/journal">先读文章</Link></div>
}

