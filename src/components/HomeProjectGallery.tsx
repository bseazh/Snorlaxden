import Image from 'next/image'
import Link from 'next/link'

import type { Project } from '@/payload-types'

const projectKickers: Record<string, string> = {
  lawyerbuddy: '法律工作流 · 本地优先',
  privacyguard: '隐私保护 · 人工复核',
  gggming: '桌面自动化 · 智能规划',
}

const projectCovers: Record<string, string> = {
  gggming: '/images/home-gallery/gggming.webp',
  lawyerbuddy: '/images/home-gallery/lawyerbuddy.webp',
  privacyguard: '/images/home-gallery/privacyguard.webp',
}

export function HomeProjectGallery({ projects }: { projects: Project[] }) {
  return (
    <div className="home-project-grid">
      {projects.map((project) => (
        <Link className="home-project-card" href={`/projects/${project.slug}`} key={project.id}>
          <div className="home-project-art">
            <Image alt={`${project.title} 项目封面`} fill sizes="(max-width: 700px) 100vw, (max-width: 900px) 50vw, 33vw" src={projectCovers[project.slug] || '/images/article-covers/default-editorial.webp'} />
          </div>
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
