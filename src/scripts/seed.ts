import { getPayload } from 'payload'

import type { Post } from '../payload-types'
import config from '../payload.config'

type RichText = NonNullable<Post['content']>

const textNode = (text: string) => ({
  detail: 0,
  format: 0,
  mode: 'normal' as const,
  style: '',
  text,
  type: 'text',
  version: 1,
})

function richText(source: string): RichText {
  const children = source
    .trim()
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const heading = line.startsWith('## ')
      const value = heading ? line.slice(3) : line

      return {
        children: [textNode(value)],
        direction: null,
        format: '',
        indent: 0,
        type: heading ? 'heading' : 'paragraph',
        version: 1,
        ...(heading ? { tag: 'h2' } : { textFormat: 0, textStyle: '' }),
      }
    })

  return {
    root: {
      children,
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  } as RichText
}

const payload = await getPayload({ config })

const existing = await payload.find({
  collection: 'posts',
  limit: 1,
  overrideAccess: true,
  where: { slug: { equals: 'openclaw-hexo-automation' } },
})

if (existing.totalDocs > 0) {
  payload.logger.info('Initial content already exists; seed skipped.')
  await payload.destroy()
  process.exit(0)
}

const tagData = [
  ['AI 实践', 'ai-practice'],
  ['内容工程', 'content-engineering'],
  ['隐私安全', 'privacy-security'],
  ['桌面智能', 'desktop-intelligence'],
] as const

const tagIDs: Record<string, number> = {}
for (const [name, slug] of tagData) {
  const tag = await payload.create({
    collection: 'tags',
    data: { name, slug },
    overrideAccess: true,
  })
  tagIDs[slug] = tag.id
}

await payload.updateGlobal({
  slug: 'site-settings',
  data: {
    displayName: '何海钊',
    roleTitle: '人工智能硕士',
    tagline: '把大模型能力带进医疗科研、专业工作与真实组织。',
    bioShort:
      '河北工业大学人工智能硕士，持续探索大模型在医疗科研与专业工作中的落地。组织 30 余场黑客松与 AI 创新实践活动，拥有 20 余场百强医院医疗科研 AI 培训经验。',
    bioLong: richText(`
何海钊，河北工业大学人工智能硕士。
竞赛方面，曾获 ICPC/CCPC-ACM 算法竞赛区域赛铜牌、蓝桥杯全国 B 组一等奖，并多次参与黑客松及 AI 创新赛事。
实践方面，担任周周黑客松执行组组长，累计组织 30 余场黑客松与 AI 创新实践活动；拥有 20 余场百强医院医疗科研 AI 培训经验，关注培训体系设计、实战案例陪跑、课程交付与业务落地。
研究方向聚焦大模型赋能医疗科研，包括医学文献解析、科研文本处理与科研数据智能分析，面向医务科研人员开展 AI 能力赋能，推动技术在医院科研场景中落地。
    `),
    contactEmail: 'bseazh@163.com',
    icpNumber: '粤ICP备2026035659号',
    socialLinks: [
      { label: 'GitHub', url: 'https://github.com/bseazh' },
      { label: 'Email', url: 'mailto:bseazh@163.com' },
    ],
    seoTitle: '何海钊｜人工智能、医疗科研与数字花园',
    seoDescription:
      '何海钊的数字花园，记录人工智能、医疗科研 AI 培训、产品实践、项目与长期思考。',
  },
  overrideAccess: true,
})

const projects = [
  {
    title: 'LawyerBuddy',
    slug: 'lawyerbuddy',
    overview: '面向律师的授权制本地法律工作助手，以可组合 Skill 覆盖材料整理、案件梳理、时间轴、类案检索与文书工作。',
    content: `
## 问题背景
案件材料常来自多个渠道，文件命名、证据顺序和事实链路需要大量人工整理，同时法律结论必须由律师复核。
## 解决方式
LawyerBuddy 以本地文件为工作边界，通过总路由和八个产品 Skill 组织材料整理、案件总结、关键时间轴、类案检索、起诉状与合同任务。原始材料默认保持不变，流程在真正改动文件前展示预览并等待确认。
## 项目原则
工具只根据材料支持的事实生成结构化报告，不替律师作法律结论；案件材料不上传，授权和支付链路与业务处理边界分离。
    `,
    url: 'https://github.com/bseazh/lawyerbuddy',
    tags: [tagIDs['ai-practice']],
    sortOrder: 10,
  },
  {
    title: 'PrivacyGuard',
    slug: 'privacyguard',
    overview: '面向中文法律材料的本地敏感信息识别、人工复核与假名化工具，为 AI 使用建立可验证的隐私边界。',
    content: `
## 问题背景
法律和科研材料包含姓名、机构、地址、联系方式等敏感信息，直接交给外部模型会引入不可接受的泄露风险。
## 解决方式
PrivacyGuard 在本机完成文件解析、规则与模型识别、人工复核、统一假名化和发送前复检。当前支持 TXT、Markdown、EML、DOCX 和有文本层的 PDF，并为扫描 PDF 建立逐页 OCR 覆盖检查。
## 安全原则
任何解析不完整、偏移无效或复检失败都会进入 BLOCKED 状态，不以读取原文或跳过校验作为降级方案。隐私链路通过也不等同于法律分析正确，输出仍需专业人员复核。
    `,
    url: 'https://github.com/bseazh/PrivacyGuard',
    tags: [tagIDs['privacy-security'], tagIDs['ai-practice']],
    sortOrder: 20,
  },
  {
    title: 'GGGMing',
    slug: 'gggming',
    overview: '基于大模型的桌面自动化框架，以语音或文本输入驱动任务规划、界面感知和系统操作。',
    content: `
## 项目目标
让用户通过自然语言描述任务，由 Agent 完成感知、决策和执行，将大模型能力延伸到真实桌面工作流。
## 系统结构
核心 Engine 使用 Go 构建，包含 Agent 规划、Controller 动作执行和 LLM 集成；桌面应用以 Wails、React 和 TypeScript 构建，并通过 macOS Accessibility、Quartz 与截图能力完成系统交互。
## 实践重点
项目关注复杂任务拆解、执行历史持久化、系统权限管理和人机交互入口，是对语音交互与桌面智能体工程化的探索。
    `,
    url: 'https://github.com/bseazh/GGGMing',
    tags: [tagIDs['desktop-intelligence'], tagIDs['ai-practice']],
    sortOrder: 30,
  },
]

for (const project of projects) {
  await payload.create({
    collection: 'projects',
    data: {
      title: project.title,
      slug: project.slug,
      overview: project.overview,
      content: richText(project.content),
      tags: project.tags,
      isFeatured: true,
      sortOrder: project.sortOrder,
      links: [{ label: 'GitHub', url: project.url }],
      seo: { title: `${project.title}｜何海钊`, description: project.overview },
      _status: 'published',
    },
    draft: false,
    overrideAccess: true,
  })
}

const posts = [
  {
    title: '使用 OpenClaw 自动化 Hexo 技术写作与发布',
    slug: 'openclaw-hexo-automation',
    summary: '把写作、校验和发布固化成可重复执行的工程流程，减少 Front Matter、缓存和部署配置带来的失误。',
    publishedAt: '2026-02-22T08:00:00.000Z',
    originalUrl: 'https://bseazh.github.io/2026/02/22/2026-02-22-openclaw-hexo-automation-guide/',
    content: `
## 为什么要把发布流程自动化
技术博客经常遇到内容产出不稳定、Front Matter 不统一、构建缓存残留和部署配置误差。自动化的价值不是替代思考，而是把重复步骤固化，让人工精力留给事实校验和表达。
## 最小发布闭环
Hexo 的标准链路是 clean、generate、deploy：先清理旧缓存，再生成静态站点，最后发布到目标仓库。将文章目录、命名规则、元数据字段和发布命令固定后，每篇文章都可以遵循同一套检查标准。
## 日常工作流
先写清文章主题、目标读者、风格与关键词；生成 Markdown 后人工检查结论、术语和代码示例；确认无误后执行统一发布脚本。自动化处理格式和命令，人负责内容的真实性与价值。
## 经验总结
真正值得沉淀的不是某一条命令，而是一套可复现、可审查、失败后可定位的内容工程流程。发布工具可以变化，清晰的边界和质量检查应长期保留。
    `,
  },
  {
    title: 'Hexo 工程化配置与发布指南',
    slug: 'hexo-engineering-guide',
    summary: '从 Node.js、Git 和 Hexo 基线开始，建立可维护、可复现并能部署到 GitHub Pages 的博客工程。',
    publishedAt: '2026-02-22T09:00:00.000Z',
    originalUrl: 'https://bseazh.github.io/2026/02/22/hexo-config-guide-from-zero/',
    content: `
## 环境与仓库基线
先统一 Node.js、包管理器和 Git 身份，再验证 Hexo CLI。国内网络环境需要明确 npm registry，但不应关闭 TLS 校验。仓库初始化后先完成本地 clean、generate、server 闭环。
## 结构与配置
文章统一进入 source/_posts，站点名称、作者、语言、时区、URL 和 permalink 在根配置中明确。主题配置与主题源码分离，可以减少升级时的冲突。
## 发布链路
GitHub Pages 适合静态产物托管；源码仓库和 Pages 产物仓库分离后，历史更清晰，回滚也更容易。发布前固定执行清理和完整构建，避免旧缓存混入线上结果。
## 常见故障
命令不存在通常来自 PATH 或 CLI 未安装；SSH 失败先验证密钥；主题不生效先确认配置名称并清理缓存；部署无更新则检查仓库地址和目标分支。工程化的关键是让问题有稳定的排查顺序。
    `,
  },
  {
    title: '传统与新媒体内容的本质分野',
    slug: 'traditional-and-new-media-creation',
    summary: '传统创作可以形成自我闭环，新媒体创作则与观众共同生长；选择媒介之前，先理解自己真正需要的反馈结构。',
    publishedAt: '2026-03-26T08:00:00.000Z',
    originalUrl: 'https://bseazh.github.io/2026/03/26/2026-03-26-why-new-media-needs-audience/',
    content: `
## 两种不同的价值闭环
传统创作可以在相对封闭的状态下完成，价值更多来自表达本身。新媒体创作天然依赖观看、反馈和持续互动，内容会在创作者与观众之间共同生长。
## 观众不是被动接收者
早期创作者往往并不成熟。少量持续反馈能帮助创作者穿过最脆弱的阶段，逐步形成选题、表达和迭代的正循环。因此，“谢谢支持”并不只是礼貌，也是对创作机制的真实描述。
## 选择适合自己的生态
如果核心诉求是自我表达与个人完成感，传统写作可能更适合；如果选择新媒体，就需要接受高反馈、高互动和高波动。问题不只是能不能写，而是自己是否适合这种关系密度。
## 对数字花园的启发
数字花园可以同时保留两种节奏：文章承担对外交流，笔记承载长期积累。公开不是唯一目标，可持续地形成、整理和复用知识才是更重要的资产。
    `,
  },
]

for (const [index, post] of posts.entries()) {
  await payload.create({
    collection: 'posts',
    data: {
      ...post,
      content: richText(post.content),
      contentType: index < 2 ? 'knowledge' : 'essay',
      tags: [tagIDs['content-engineering']],
      isFeatured: index === 0,
      reviewState: 'approved',
      aiDisclosure: false,
      seo: { title: `${post.title}｜何海钊`, description: post.summary },
      _status: 'published',
    },
    draft: false,
    overrideAccess: true,
  })
}

const faqItems = [
  ['你目前主要研究什么？', '我关注大模型在医疗科研场景中的落地，包括医学文献解析、科研文本处理和科研数据智能分析。'],
  ['你有哪些医疗科研 AI 培训经验？', '目前有 20 余场百强医院医疗科研 AI 培训经验，工作内容包括培训体系设计、实战案例陪跑、课程交付和业务落地。'],
  ['你在黑客松社区做什么？', '我担任周周黑客松执行组组长，累计组织 30 余场黑客松与 AI 创新实践活动。'],
  ['可以开展哪些合作？', '可以围绕医疗科研 AI 培训、工作流设计、智能工具原型和 AI 实践活动进行交流与合作。具体范围需要结合数据合规、业务目标和交付条件确认。'],
  ['网站上的 AI 内容如何处理？', 'AI 只作为创作和整理辅助。公开内容会经过人工核对与确认，缺少依据的信息不会作为确定事实发布。'],
  ['如何联系你？', '可以发送邮件至 bseazh@163.com，并简要说明合作背景、目标和预期时间。'],
] as const

for (const [index, [question, answer]] of faqItems.entries()) {
  await payload.create({
    collection: 'faq-items',
    data: { question, answer, enabled: true, sortOrder: (index + 1) * 10 },
    overrideAccess: true,
  })
}

payload.logger.info('Initial site settings, projects, posts and FAQ seeded.')
await payload.destroy()
