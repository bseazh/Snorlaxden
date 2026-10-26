import Link from 'next/link'

import { HomeHeroCarousel } from '@/components/HomeHeroCarousel'
import { HomeProjectGallery } from '@/components/HomeProjectGallery'
import { PostCover } from '@/components/PostCover'
import { getFAQItems, getFeaturedProjects, getLatestPosts, getSiteSettings } from '@/modules/content'

const dateFormatter = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })

export default async function HomePage() {
  const [settings, projects, posts, faqItems] = await Promise.all([
    getSiteSettings(), getFeaturedProjects(3), getLatestPosts(3), getFAQItems(),
  ])
  return <>
    <HomeHeroCarousel displayName={settings.displayName} />
    <section className="home-intro"><p>你好，我是何海钊。我在做 <Link href="/journal">医疗科研 AI</Link>、<Link href="/projects">实用产品</Link>、<Link href="/garden">长期知识花园</Link>，也持续组织黑客松与 AI 创新实践。</p></section>
    <section className="home-gallery-section"><div className="home-wide-heading"><div><span>SELECTED WORK</span><h2>一些正在发生的作品</h2></div><Link href="/projects">查看全部项目 ↗</Link></div><HomeProjectGallery projects={projects} /></section>
    <section className="home-category-section"><div className="home-category-intro"><span>THREE THREADS</span><h2>我的工作，沿着三条线持续生长。</h2></div><div className="home-category-grid">
      <Link className="home-category-card medical" href="/journal"><div className="category-orbit" aria-hidden="true"><i /><i /><i /></div><strong>医疗科研 AI</strong><p>面向医务科研人员，将文献、科研文本和数据分析能力真正带进工作现场。</p><span>阅读文章 →</span></Link>
      <Link className="home-category-card practice" href="/projects"><div className="category-orbit" aria-hidden="true"><i /><i /><i /></div><strong>产品与实践</strong><p>从隐私工具到专业工作助手，把想法做成可以运行、测试和继续演化的系统。</p><span>浏览项目 →</span></Link>
      <Link className="home-category-card garden" href="/garden"><div className="category-orbit" aria-hidden="true"><i /><i /><i /></div><strong>数字花园</strong><p>项目复盘、技术路径、阅读和方法论，不急着完成，而是保持互相连接。</p><span>进入花园 →</span></Link>
    </div></section>
    <section className="home-notes-section"><div className="home-wide-heading"><div><span>FIELD NOTES</span><h2>最近写下的东西</h2></div><Link href="/journal">全部文章 ↗</Link></div><div className="home-note-grid">{posts.map((post, index) => <article className={`home-note-card note-${index}`} key={post.id}><Link aria-label={`阅读 ${post.title}`} href={`/journal/${post.slug}`}><PostCover className="home-note-cover" post={post} /></Link><div className="home-note-body"><time dateTime={post.publishedAt ?? post.createdAt}>{dateFormatter.format(new Date(post.publishedAt ?? post.createdAt))}</time><h3><Link href={`/journal/${post.slug}`}>{post.title}</Link></h3><p>{post.summary}</p><Link href={`/journal/${post.slug}`}>继续阅读 →</Link></div></article>)}</div></section>
    <section className="home-faq-section"><div className="home-faq-copy"><span>ASK ME ANYTHING</span><h2>先从几个问题认识我。</h2><p>预设回答由本人确认；也可以进入公开 AI 助手，基于已发布内容继续提问。</p><Link href="/assistant">进入 AI 助手 ↗</Link></div><div className="home-faq-list">{faqItems.slice(0, 4).map((item) => <details key={item.id}><summary>{item.question}<span>＋</span></summary><p>{item.answer}</p></details>)}</div></section>
    <section className="home-contact-band"><div><span>LET&apos;S MAKE SOMETHING USEFUL</span><h2>想聊医疗科研 AI、培训，或一个值得实现的想法？</h2></div><a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}<span>↗</span></a></section>
  </>
}
