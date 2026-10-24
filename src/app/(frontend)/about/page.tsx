import type { Metadata } from 'next'
import Image from 'next/image'

import { RichText } from '@/components/RichText'
import { getSiteSettings } from '@/modules/content'

export const metadata: Metadata = { title: '关于我', description: '何海钊的研究方向、竞赛经历、社区实践与医疗科研 AI 培训经验。' }

export default async function AboutPage() {
  const settings = await getSiteSettings()
  return <div className="page-shell shell">
    <header className="page-header about-header"><div><p className="eyebrow">ABOUT</p><h1>在研究与现场之间，<br />让 AI 真正落地。</h1></div><Image alt="何海钊个人形象照" height={720} src="/images/hehaizhao-portrait.jpg" width={480} /></header>
    <div className="about-grid"><aside><p className="aside-label">当前关注</p><p>医学文献解析</p><p>科研文本处理</p><p>科研数据智能分析</p><p>AI 培训与组织实践</p></aside><article><RichText data={settings.bioLong} /><div className="milestone-grid"><div><strong>算法基础</strong><p>ICPC/CCPC 区域赛铜牌，蓝桥杯全国 B 组一等奖。</p></div><div><strong>组织实践</strong><p>周周黑客松执行组组长，累计组织 30 余场活动。</p></div><div><strong>行业交付</strong><p>20 余场百强医院医疗科研 AI 培训经验。</p></div><div><strong>长期方向</strong><p>推动大模型能力进入真实医疗科研工作流。</p></div></div></article></div>
  </div>
}
