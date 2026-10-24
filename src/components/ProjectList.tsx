import Link from 'next/link'

import type { Project } from '@/payload-types'

export function ProjectList({ projects }: { projects: Project[] }) {
  return <div className="project-list">{projects.map((project, index) => (
    <article className="project-row" key={project.id}>
      <span className="project-index">{String(index + 1).padStart(2, '0')}</span>
      <div><p className="eyebrow">PROJECT</p><h3><Link href={`/projects/${project.slug}`}>{project.title}</Link></h3><p>{project.overview}</p></div>
      <Link className="arrow-link" href={`/projects/${project.slug}`} aria-label={`查看 ${project.title}`}>→</Link>
    </article>
  ))}</div>
}
