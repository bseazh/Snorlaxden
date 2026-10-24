import { test, expect, Page } from '@playwright/test'
import { login } from '../helpers/login'
import { seedTestUser, cleanupTestUser, testUser } from '../helpers/seedUser'

test.describe('Admin Panel', () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    await seedTestUser()

    const context = await browser.newContext()
    page = await context.newPage()

    await login({ page, user: testUser })
  })

  test.afterAll(async () => {
    await cleanupTestUser()
  })

  test('can navigate to dashboard', async () => {
    await page.goto('http://localhost:3000/admin')
    await expect(page).toHaveURL('http://localhost:3000/admin')
    const dashboardArtifact = page.locator('span[title="Dashboard"]').first()
    await expect(dashboardArtifact).toBeVisible()
  })

  test('can navigate to list view', async () => {
    await page.goto('http://localhost:3000/admin/collections/users')
    await expect(page).toHaveURL(/\/admin\/collections\/users(?:\?.*)?$/)
    const listViewArtifact = page.locator('h1', { hasText: 'Users' }).first()
    await expect(listViewArtifact).toBeVisible()
  })

  test('can navigate to edit view', async () => {
    await page.goto('http://localhost:3000/admin/collections/users/create')
    await expect(page).toHaveURL(/\/admin\/collections\/users\/[a-zA-Z0-9-_]+/)
    const editViewArtifact = page.locator('input[name="email"]')
    await expect(editViewArtifact).toBeVisible()
  })

  test('can generate and review a structured AI draft', async () => {
    await page.route('**/api/internal/ai/draft', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          generationId: 101,
          provider: 'deepseek',
          model: 'deepseek-chat',
          promptVersion: 'article-writer-v1',
          draft: {
            title: '测试生成的待审核文章',
            summary: '用于验证工作台展示和事实核实流程。',
            outline: ['背景'],
            sections: [{ id: 's1', heading: '背景', paragraphs: ['这是一段待管理员审核的正文。'] }],
            factChecklist: [{ claim: '活动时间', status: 'missing', question: '活动发生在什么时候？' }],
            suggestedTags: ['测试'],
            disclosure: { aiAssisted: true },
          },
          usage: { limit: 20, used: 1, remaining: 19 },
        },
      })
    })
    await page.route('**/api/internal/ai/draft/save', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        json: { markdownPath: 'content/articles/ai-test-draft.md', postId: 202, slug: 'ai-test-draft', status: 'draft' },
      })
    })

    await page.goto('http://localhost:3000/studio')
    await page.fill('textarea[name="sourceText"]', '这是一段超过二十个字符的测试素材，用于验证管理员写作工作台。')
    await page.click('button[type="submit"]')

    await expect(page.getByRole('heading', { name: '测试生成的待审核文章' })).toBeVisible()
    await expect(page.getByText('活动发生在什么时候？')).toBeVisible()
    await expect(page.getByText('不会自动发布')).toBeVisible()
    await page.fill('input[pattern]', 'ai-test-draft')
    await page.getByRole('button', { name: '保存草稿' }).click()
    await expect(page.getByText('草稿已保存')).toBeVisible()
    await expect(page.getByText('content/articles/ai-test-draft.md')).toBeVisible()
  })
})
