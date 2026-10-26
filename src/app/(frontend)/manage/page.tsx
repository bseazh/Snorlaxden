import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@payload-config'

export const metadata: Metadata = { title: '创作与管理中心', robots: { index: false, follow: false } }

const actions = [
  { href: '/studio', kicker: 'AI WRITING', title: 'AI 写文章', description: '选择合法来源或粘贴个人笔记，生成事实包和待审核文章草稿。', action: '进入写作工作台' },
  { href: '/library', kicker: 'PRIVATE LIBRARY', title: '上传与管理材料', description: '上传私有 PDF、图片，收藏链接和个人笔记，为 AI 写作准备来源。', action: '进入材料库' },
  { href: '/studio/images', kicker: 'AI IMAGE', title: 'AI 生成封面', description: '为已有文章草稿生成私有候选封面，人工选择后再绑定。', action: '进入封面工作台' },
  { href: '/admin/collections/posts', kicker: 'POSTS', title: '文章草稿与发布', description: '编辑 AI 草稿、手工新建文章，并在核实完成后人工发布或撤回。', action: '管理文章' },
  { href: '/admin', kicker: 'PAYLOAD CMS', title: '完整内容后台', description: '管理项目、标签、FAQ、媒体、站点设置、生成记录与审计日志。', action: '打开 Payload 后台' },
] as const

export default async function ManagePage() {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) redirect('/admin/login?redirect=%2Fmanage')

  return (
    <div className="shell manage-shell">
      <header className="manage-heading">
        <div><p className="eyebrow">ADMIN · CREATION HUB</p><h1>创作与管理中心</h1></div>
        <p>从材料整理、AI 写作和封面生成，到人工审核发布，都从这里开始。</p>
      </header>
      <nav className="manage-grid" aria-label="管理员工具">
        {actions.map((item) => (
          <Link className="manage-card" href={item.href} key={item.href}>
            <span className="eyebrow">{item.kicker}</span>
            <strong>{item.title}</strong>
            <p>{item.description}</p>
            <span className="manage-card-action">{item.action} →</span>
          </Link>
        ))}
      </nav>
      <aside className="manage-notice"><strong>发布边界</strong><span>AI 文字和图片只会保存为私有草稿或候选内容，网站发布仍需你在文章后台人工确认。</span></aside>
    </div>
  )
}
