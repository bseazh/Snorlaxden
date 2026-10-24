import type { Metadata } from 'next'

import { PostList } from '@/components/PostList'
import { getLatestPosts } from '@/lib/content'

export const metadata: Metadata = { title: '文章', description: '何海钊关于人工智能、内容工程、产品实践与长期成长的文章。' }
export default async function JournalPage() {
  const posts = await getLatestPosts(100)
  return <div className="page-shell shell"><header className="page-header"><p className="eyebrow">JOURNAL</p><h1>把实践写下来，<br />让经验可以复用。</h1><p>技术路径、内容工程、阅读与现场观察。</p></header><PostList posts={posts} /></div>
}

