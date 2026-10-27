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
    <section className="home-intro">
      <div className="home-intro-label"><span>ABOUT / 01</span><p>人工智能硕士<br />研究者与实践者</p></div>
      <p className="home-intro-statement">你好，我是何海钊。我在做 <Link href="/journal">医疗科研 AI</Link>、<Link href="/projects">实用产品</Link>与<Link href="/garden">长期知识花园</Link>，也持续组织黑客松和 AI 创新实践。</p>
      <div className="home-intro-facts"><p><strong>20+</strong><span>百强医院<br />AI 培训</span></p><p><strong>30+</strong><span>黑客松与<br />创新活动</span></p></div>
    </section>
    <section className="home-gallery-section"><div className="home-wide-heading"><div><span>SELECTED WORK</span><h2>一些正在发生的作品</h2></div><Link href="/projects">查看全部项目 ↗</Link></div><HomeProjectGallery projects={projects} /></section>
    <section className="home-category-section"><div className="home-category-intro"><span>PRACTICE / 02</span><h2>三个方向，<br />一套长期实践。</h2><p>研究要进入现场，产品要解决问题，知识要保持连接。</p></div><div className="home-category-grid">
      <Link className="home-category-card medical" href="/journal"><span className="home-category-index">01</span><strong>医疗科研 AI</strong><p>面向医务科研人员，将文献、科研文本和数据分析能力真正带进工作现场。</p><span className="home-category-action">阅读文章 ↗</span></Link>
      <Link className="home-category-card practice" href="/projects"><span className="home-category-index">02</span><strong>产品与实践</strong><p>从隐私工具到专业工作助手，把想法做成可以运行、测试和继续演化的系统。</p><span className="home-category-action">浏览项目 ↗</span></Link>
      <Link className="home-category-card garden" href="/garden"><span className="home-category-index">03</span><strong>数字花园</strong><p>项目复盘、技术路径、阅读和方法论，不急着完成，而是保持互相连接。</p><span className="home-category-action">进入花园 ↗</span></Link>
    </div></section>
    <section className="home-notes-section"><div className="home-wide-heading"><div><span>FIELD NOTES</span><h2>最近写下的东西</h2></div><Link href="/journal">全部文章 ↗</Link></div><div className="home-note-grid">{posts.map((post, index) => <article className={`home-note-card note-${index}`} key={post.id}><Link aria-label={`阅读 ${post.title}`} href={`/journal/${post.slug}`}><PostCover className="home-note-cover" post={post} /></Link><div className="home-note-body"><time dateTime={post.publishedAt ?? post.createdAt}>{dateFormatter.format(new Date(post.publishedAt ?? post.createdAt))}</time><h3><Link href={`/journal/${post.slug}`}>{post.title}</Link></h3><p>{post.summary}</p><Link href={`/journal/${post.slug}`}>继续阅读 →</Link></div></article>)}</div></section>
    <section className="home-faq-section"><div className="home-faq-copy"><span>ASK ME ANYTHING</span><h2>先从几个问题认识我。</h2><p>预设回答由本人确认；也可以进入公开 AI 助手，基于已发布内容继续提问。</p><Link href="/assistant">进入 AI 助手 ↗</Link></div><div className="home-faq-list">{faqItems.slice(0, 4).map((item) => <details key={item.id}><summary>{item.question}<span>＋</span></summary><p>{item.answer}</p></details>)}</div></section>
    <section className="home-contact-band"><div><span>CONTACT / 05</span><h2>一起把一个值得做的想法，带进真实世界。</h2><p>医疗科研 AI、医院培训、产品合作与创新活动。</p></div><a href={`mailto:${settings.contactEmail}`}><span>写封邮件</span>{settings.contactEmail}<b aria-hidden="true">↗</b></a></section>
  </>
}
