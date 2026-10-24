import Image from 'next/image'
import Link from 'next/link'

import { PostList } from '@/components/PostList'
import { ProjectList } from '@/components/ProjectList'
import { getFAQItems, getFeaturedProjects, getLatestPosts, getSiteSettings } from '@/modules/content'

export default async function HomePage() {
  const [settings, projects, posts, faqItems] = await Promise.all([
    getSiteSettings(), getFeaturedProjects(3), getLatestPosts(3), getFAQItems(),
  ])
  return <>
    <section className="hero-band">
      <Image alt="何海钊在现场分享人工智能实践" className="hero-image" fill priority sizes="100vw" src="/images/hehaizhao-portrait.jpg" />
      <div className="hero-overlay" aria-hidden="true" />
      <div className="shell hero-inner">
        <div className="hero-copy"><p className="eyebrow">AI RESEARCH · PRACTICE · EDUCATION</p><h1>{settings.displayName}</h1><p className="hero-role">{settings.roleTitle}</p><p className="hero-tagline">{settings.tagline}</p><div className="action-row"><Link className="button primary" href="/projects">查看项目</Link><Link className="button secondary" href="/about">了解我</Link></div></div>
      </div>
      <div className="hero-stats"><div className="shell stat-strip" aria-label="经历数据"><div><strong>30+</strong><span>黑客松与 AI 实践活动</span></div><div><strong>20+</strong><span>百强医院科研 AI 培训</span></div><div><strong>ICPC / CCPC</strong><span>区域赛铜牌</span></div><div><strong>全国一等奖</strong><span>蓝桥杯 B 组</span></div></div></div>
    </section>
    <section className="section-band"><div className="shell section-heading"><div><p className="eyebrow">SELECTED WORK</p><h2>把想法做成可验证的系统</h2></div><Link className="text-link" href="/projects">全部项目</Link></div><div className="shell"><ProjectList projects={projects} /></div></section>
    <section className="section-band journal-band"><div className="shell section-heading"><div><p className="eyebrow">FIELD NOTES</p><h2>文章与实践笔记</h2></div><Link className="text-link" href="/journal">全部文章</Link></div><div className="shell"><PostList posts={posts} /></div></section>
    <section className="section-band"><div className="shell faq-layout"><div className="faq-intro"><p className="eyebrow">QUICK QUESTIONS</p><h2>先从几个问题认识我</h2><p>所有回答都由本人确认，并可在后台持续更新。</p></div><div className="faq-list">{faqItems.map((item) => <details key={item.id}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div></div></section>
    <section className="garden-band"><div className="shell garden-inner"><div><p className="eyebrow">DIGITAL GARDEN</p><h2>知识不只发布，也持续生长。</h2></div><p>这里收录项目复盘、技术路径、阅读与方法论。公开笔记系统正在按白名单和隐私边界建设。</p><Link className="button light" href="/garden">进入花园</Link></div></section>
  </>
}
