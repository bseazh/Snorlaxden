import type { Metadata } from 'next'

import { ProjectList } from '@/components/ProjectList'
import { getProjects } from '@/lib/content'

export const metadata: Metadata = { title: '项目', description: '何海钊参与和发起的人工智能、隐私安全与桌面智能项目。' }
export default async function ProjectsPage() {
  const projects = await getProjects()
  return <div className="page-shell shell"><header className="page-header"><p className="eyebrow">PROJECTS</p><h1>项目不是概念，<br />是被验证过的工作。</h1><p>从专业场景出发，记录问题、边界、实现与下一步。</p></header><ProjectList projects={projects} /></div>
}

