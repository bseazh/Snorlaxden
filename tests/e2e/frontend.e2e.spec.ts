import { expect, test } from '@playwright/test'

test.describe('Public digital garden', () => {
  test('renders the homepage and primary content', async ({ page }) => {
    await page.goto('http://localhost:3000')
    await expect(page).toHaveTitle(/何海钊/)
    await expect(page.getByRole('heading', { level: 1, name: '何海钊' })).toBeVisible()
    await expect(page.getByText('LawyerBuddy', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('文章与实践笔记')).toBeVisible()
    await expect(page.getByText('你目前主要研究什么？')).toBeVisible()
  })

  test('renders project and article detail pages', async ({ page }) => {
    await page.goto('http://localhost:3000/projects/lawyerbuddy')
    await expect(page.getByRole('heading', { level: 1, name: 'LawyerBuddy' })).toBeVisible()

    await page.goto('http://localhost:3000/journal/openclaw-hexo-automation')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('OpenClaw')
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

  test('returns not found for an unknown or unpublished slug', async ({ page }) => {
    const response = await page.goto('http://localhost:3000/journal/private-draft-not-public')
    expect(response?.status()).toBe(404)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('还没有长出内容')
  })
})
