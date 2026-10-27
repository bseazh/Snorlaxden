'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

const slides = [
  { kind: 'portrait', image: '/images/hehaizhao-portrait.jpg', imageAlt: '何海钊在现场分享人工智能实践', label: '个人介绍', title: '把 AI 带进真实问题', body: '人工智能硕士 · 医疗科研 AI · 产品实践', href: '/about', action: '认识何海钊' },
  { kind: 'medical', image: '/images/home-gallery/medical-ai-hero.webp', imageAlt: '医学文献、数据节点与知识网络构成的医疗科研 AI 插画', label: '医疗科研 AI', title: '让复杂科研工作，变得清晰可用', body: '从医学文献解析、科研文本处理，到数据智能分析与医院培训落地。', href: '/journal', action: '阅读实践笔记' },
  { kind: 'making', image: '/images/home-gallery/making-systems-hero.webp', imageAlt: '由草图、模块和原型组成的创意系统实践插画', label: '从想法到系统', title: '持续做出，可以验证的东西', body: '算法竞赛、黑客松、开源产品与长期生长的数字花园。', href: '/projects', action: '浏览项目作品' },
] as const

export function HomeHeroCarousel({ displayName }: { displayName: string }) {
  const [active, setActive] = useState(0)

  function move(offset: number) {
    setActive((value) => (value + offset + slides.length) % slides.length)
  }

  return (
    <section className="home-showcase" aria-roledescription="carousel" aria-label="何海钊的研究与实践">
      <p aria-live="polite" className="sr-only">第 {active + 1} 张，共 {slides.length} 张：{slides[active].label}</p>
      {slides.map((slide, index) => (
        <article aria-hidden={active !== index} className={`home-slide home-slide-${slide.kind} ${active === index ? 'is-active' : ''}`} inert={active !== index} key={slide.kind}>
          <Image alt={slide.imageAlt} className="home-slide-photo" fill priority={index === 0} sizes="100vw" src={slide.image} />
          <div className="home-slide-wash" aria-hidden="true" />
          <div className="home-slide-copy">
            <span className="home-slide-label">{slide.label}</span>
            <p className="home-signature">{displayName}</p>
            <h1>{slide.title}</h1>
            <p>{slide.body}</p>
            <Link href={slide.href}>{slide.action}<span aria-hidden="true">↗</span></Link>
          </div>
        </article>
      ))}
      <button aria-label="上一张" className="home-slide-arrow previous" onClick={() => move(-1)} type="button">←</button>
      <button aria-label="下一张" className="home-slide-arrow next" onClick={() => move(1)} type="button">→</button>
      <div className="home-slide-dots" aria-label="选择轮播内容">
        {slides.map((slide, index) => <button aria-label={`显示${slide.label}`} aria-pressed={active === index} key={slide.kind} onClick={() => setActive(index)} type="button">{index + 1}</button>)}
      </div>
    </section>
  )
}
