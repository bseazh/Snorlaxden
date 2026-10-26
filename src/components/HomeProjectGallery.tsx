import Link from 'next/link'

import type { Project } from '@/payload-types'

const projectKickers: Record<string, string> = {
  lawyerbuddy: '法律工作流 · 本地优先',
  privacyguard: '隐私保护 · 人工复核',
  gggming: '桌面自动化 · 智能规划',
}

export function HomeProjectGallery({ projects }: { projects: Project[] }) {
  return (
    <div className="home-project-grid">
      {projects.map((project, index) => (
        <Link className={`home-project-card project-art-${index % 3}`} href={`/projects/${project.slug}`} key={project.id}>
          <div className="home-project-art" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="home-project-meta">
            <strong>{project.title}</strong>
            <em>{projectKickers[project.slug] || 'AI 产品实践'}</em>
            <p>{project.overview}</p>
          </div>
        </Link>
      ))}
    </div>
  )
}
