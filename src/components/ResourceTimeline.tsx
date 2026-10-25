import { ExternalLink, FileText, Link2 } from 'lucide-react'

import type { Resource } from '@/payload-types'

const visibilityLabels = { private: '私有', public: '公开候选', review: '待审核' } as const
const typeLabels = { activity: '活动', book: '图书', image: '图片', link: '网页', note: '短记', video: '视频' } as const
const statusLabels = { card_draft: '知识卡草稿', failed: '处理失败', metadata_ready: '元数据就绪', reviewed: '已审核', saved_only: '仅收藏', text_ready: '文字就绪' } as const
const formatter = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' })

function relationTitle(value: Resource['relatedPosts'] | Resource['relatedProjects']) {
  return value?.map((item) => typeof item === 'object' ? item.title : `#${item}`) || []
}

export function ResourceTimeline({ resources }: { resources: Resource[] }) {
  if (!resources.length) return <div className="resource-empty"><FileText size={28} /><strong>当前筛选下没有资源</strong><p>从上方记录一条短记，或清除筛选条件。</p></div>
  return <div className="resource-timeline">{resources.map((resource) => {
    const relations = [...relationTitle(resource.relatedPosts), ...relationTitle(resource.relatedProjects)]
    return <article className="resource-entry" key={resource.id}>
      <div className="resource-time"><time dateTime={resource.capturedAt}>{formatter.format(new Date(resource.capturedAt))}</time></div>
      <div className="resource-entry-body">
        <div className="resource-entry-meta"><span>{typeLabels[resource.resourceType]}</span><span className={`visibility-${resource.visibility}`}>{visibilityLabels[resource.visibility]}</span><span>{statusLabels[resource.ingestStatus]}</span></div>
        <h2>{resource.title}</h2>
        {resource.notes ? <p className="resource-notes">{resource.notes}</p> : null}
        {resource.canonicalUrl ? <a className="resource-source" href={resource.canonicalUrl} rel="noreferrer" target="_blank"><Link2 size={14} /><span>{resource.platform || 'web'} · {resource.canonicalUrl}</span><ExternalLink size={13} /></a> : null}
        {resource.tags?.length ? <div className="resource-tags">{resource.tags.map((tag) => <span key={typeof tag === 'object' ? tag.id : tag}>#{typeof tag === 'object' ? tag.name : tag}</span>)}</div> : null}
        {relations.length ? <p className="resource-relations">关联：{relations.join(' · ')}</p> : null}
      </div>
    </article>
  })}</div>
}

