import { expect, test } from '@playwright/test'

test('T019 rejects anonymous private source material downloads without shared caching', async ({ request }) => {
  const response = await request.get('http://localhost:3000/api/internal/source-materials/1/download')
  expect(response.status()).toBe(401)
  expect(response.headers()['cache-control']).toContain('private')
  expect(response.headers()['cache-control']).toContain('no-store')
  expect(response.headers()['vary']).toContain('Cookie')
})

test('rejects anonymous source material listing, upload, and Markdown export', async ({ request }) => {
  expect((await request.get('http://localhost:3000/api/source-materials')).status()).toBe(403)
  expect((await request.post('http://localhost:3000/api/internal/source-materials/upload', { multipart: {} })).status()).toBe(401)
  expect((await request.post('http://localhost:3000/api/internal/exports/markdown', { data: { id: 1, type: 'source-material' } })).status()).toBe(401)
  expect((await request.post('http://localhost:3000/api/internal/public-garden/export')).status()).toBe(401)
  expect((await request.post('http://localhost:3000/api/internal/ai/workflow', { data: {} })).status()).toBe(401)
  expect((await request.post('http://localhost:3000/api/internal/ai/workflow/1/retry')).status()).toBe(401)
})

test.describe('Public digital garden', () => {
  test('renders the homepage and primary content', async ({ page }) => {
    await page.goto('http://localhost:3000')
    await expect(page).toHaveTitle(/何海钊/)
    await expect(page.getByRole('heading', { level: 1, name: '何海钊' })).toBeVisible()
    await expect(page.getByText('LawyerBuddy', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('文章与实践笔记')).toBeVisible()
    await expect(page.getByText('你目前主要研究什么？')).toBeVisible()
    await expect(page.getByRole('link', { name: '粤ICP备2026035659号' })).toHaveAttribute('href', 'https://beian.miit.gov.cn/')
  })

  test('renders project and article detail pages', async ({ page }) => {
    await page.goto('http://localhost:3000/projects/lawyerbuddy')
    await expect(page.getByRole('heading', { level: 1, name: 'LawyerBuddy' })).toBeVisible()

    await page.goto('http://localhost:3000/journal/openclaw-hexo-automation')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('OpenClaw')
  })

  test('T007 renders garden search, links, table of contents, and backlinks', async ({ page }) => {
    await page.goto('http://localhost:3000/garden')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('持续生长的网络')
    const noteList = page.getByRole('region', { name: '公开笔记' })
    await expect(noteList.getByRole('link', { name: '大模型如何服务医疗科研', exact: true })).toBeVisible()
    await page.getByRole('searchbox', { name: '搜索公开花园' }).fill('百强医院')
    await page.getByRole('button', { name: '搜索' }).click()
    await expect(page).toHaveURL(/q=/)
    await expect(noteList.getByRole('link', { name: '大模型如何服务医疗科研', exact: true })).toBeVisible()
    await expect(noteList.getByRole('link', { name: '从 30 余场黑客松中学到的事', exact: true })).toHaveCount(0)

    await page.goto('http://localhost:3000/garden/research/medical-ai')
    await expect(page.getByRole('heading', { level: 1, name: '大模型如何服务医疗科研' })).toBeVisible()
    await expect(page.getByRole('complementary', { name: '本页目录' }).getByRole('link', { name: '三个现实入口' })).toBeVisible()
    await expect(page.getByRole('region', { name: '反向链接' }).getByRole('link', { name: /^从 30 余场黑客松中学到的事/ })).toBeVisible()
  })

  test('T009 returns 404 without cache persistence for withdrawn garden paths and attachments', async ({ request }) => {
    expect((await request.get('http://localhost:3000/garden/withdrawn-note')).status()).toBe(404)
    const attachment = await request.get('http://localhost:3000/garden/files/private/withdrawn.pdf')
    expect(attachment.status()).toBe(404)
    expect(attachment.headers()['cache-control']).toContain('no-store')
  })

  test('renders the assistant as a dedicated page and answers a preset without an AI request', async ({ page }) => {
    let assistantRequests = 0
    page.on('request', (request) => {
      if (request.url().includes('/api/public/assistant')) assistantRequests += 1
    })
    await page.goto('http://localhost:3000')
    const assistantLink = page.getByRole('link', { exact: true, name: 'AI 助手' })
    await expect(assistantLink).toBeVisible()
    await expect(page.getByRole('region', { name: '何海钊 AI 助手' })).toHaveCount(0)
    await assistantLink.click()
    await expect(page).toHaveURL(/\/assistant$/)
    const assistant = page.getByRole('region', { name: '何海钊 AI 助手' })
    await expect(assistant).toBeVisible()
    await assistant.getByRole('button', { name: '你目前主要研究什么？' }).click()
    await expect(assistant.getByText('我关注大模型在医疗科研场景中的落地')).toBeVisible()
    expect(assistantRequests).toBe(0)
  })

  test('has no horizontal overflow on a mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('http://localhost:3000/assistant')
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(dimensions.scrollWidth).toBe(dimensions.clientWidth)
    await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible()
    const assistantBox = await page.getByRole('region', { name: '何海钊 AI 助手' }).boundingBox()
    expect(assistantBox?.x).toBeGreaterThanOrEqual(0)
    expect(assistantBox?.width).toBeLessThanOrEqual(390)
  })

  test('garden has no horizontal overflow on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('http://localhost:3000/garden/research/medical-ai')
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(dimensions.scrollWidth).toBe(dimensions.clientWidth)
    await expect(page.getByRole('navigation', { name: '花园目录' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: '大模型如何服务医疗科研' })).toBeVisible()
  })

  test('returns not found for an unknown or unpublished slug', async ({ page }) => {
    const response = await page.goto('http://localhost:3000/journal/private-draft-not-public')
    expect(response?.status()).toBe(404)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('还没有长出内容')
  })

  test('redirects anonymous visitors away from the private resource library', async ({ page }) => {
    await page.goto('http://localhost:3000/library')
    await expect(page).toHaveURL(/\/admin\/login\?redirect=%2Flibrary/)
  })
})
