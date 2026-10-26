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

  test('opens every private tool from the creation hub', async () => {
    await page.goto('http://localhost:3000/manage')
    await expect(page.getByRole('heading', { name: '创作与管理中心' })).toBeVisible()
    const tools = page.getByRole('navigation', { name: '管理员工具' })
    await expect(tools.getByRole('link', { name: /AI 写文章/ })).toHaveAttribute('href', '/studio')
    await expect(tools.getByRole('link', { name: /上传与管理材料/ })).toHaveAttribute('href', '/library')
    await expect(tools.getByRole('link', { name: /AI 生成封面/ })).toHaveAttribute('href', '/studio/images')
    await expect(tools.getByRole('link', { name: /文章草稿与发布/ })).toHaveAttribute('href', '/admin/collections/posts')
    await expect(tools.getByRole('link', { name: /完整内容后台/ })).toHaveAttribute('href', '/admin')
    await page.setViewportSize({ width: 390, height: 844 })
    const dimensions = await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }))
    expect(dimensions.scrollWidth).toBe(dimensions.clientWidth)
    await expect(page.getByRole('heading', { name: '创作与管理中心' })).toBeVisible()
    await page.setViewportSize({ width: 1280, height: 720 })
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

  test('shows the protected resource timeline and explicit visibility', async () => {
    await page.goto('http://localhost:3000/library')
    await expect(page).toHaveURL('http://localhost:3000/library')
    await expect(page.getByRole('heading', { name: '第二知识仓库' })).toBeVisible()
    await expect(page.getByText('默认私有').first()).toBeVisible()
    await expect(page.getByRole('button', { name: '收藏' })).toBeVisible()
    await expect(page.getByText('按收藏时间倒序')).toBeVisible()
  })

  test('keeps the private resource library usable on mobile', async () => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('http://localhost:3000/library')
    const dimensions = await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }))
    expect(dimensions.scrollWidth).toBe(dimensions.clientWidth)
    await expect(page.getByLabel('资源标题')).toBeVisible()
    await expect(page.getByText('最近记录')).toBeVisible()
    await page.setViewportSize({ width: 1280, height: 720 })
  })

  test('uploads, deduplicates, downloads, and removes a private PDF', async () => {
    const marker = `private-pdf-${Date.now()}`
    async function upload() {
      return page.evaluate(async (value) => {
        const form = new FormData()
        form.set('authorizationBasis', 'owned')
        form.set('authorizationNote', 'Test fixture owned by the test suite.')
        form.set('file', new File([`%PDF-1.7\n${value}`], `${value}.pdf`, { type: 'application/pdf' }))
        form.set('personalNotes', 'Private test note.')
        form.set('sourceDescription', 'Private test source description.')
        form.set('title', value)
        const response = await fetch('/api/internal/source-materials/upload', { body: form, method: 'POST' })
        return { body: await response.json(), status: response.status }
      }, marker)
    }
    const firstUpload = await upload()
    expect(firstUpload.status).toBe(201)
    const created = firstUpload.body as { id: number; sourceId: string }
    expect(created.sourceId).toMatch(/^source-/)

    const duplicate = await upload()
    expect(duplicate.status).toBe(409)
    expect(duplicate.body.code).toBe('DUPLICATE_FILE')

    const metadata = await page.evaluate(async (id) => {
      const response = await fetch(`/api/source-materials/${id}`)
      return { body: await response.json(), status: response.status }
    }, created.id)
    expect(metadata.status).toBe(200)
    const record = metadata.body
    expect(record.mimeType).toBe('application/pdf')
    expect(record.byteSize).toBe(Buffer.byteLength(`%PDF-1.7\n${marker}`))
    expect(record.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(record.privacy).toBe('private')

    const download = await page.evaluate(async (id) => {
      const response = await fetch(`/api/internal/source-materials/${id}/download`)
      return { body: await response.text(), cacheControl: response.headers.get('cache-control'), disposition: response.headers.get('content-disposition'), status: response.status }
    }, created.id)
    expect(download.status).toBe(200)
    expect(download.cacheControl).toContain('no-store')
    expect(download.disposition).toContain('attachment')
    expect(download.body).toContain(marker)

    const removedStatus = await page.evaluate(async (id) => (await fetch(`/api/source-materials/${id}`, { method: 'DELETE' })).status, created.id)
    expect(removedStatus).toBe(200)
  })

  test('can generate and review a structured AI draft', async () => {
    await page.route('**/api/internal/ai/workflow', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          generationId: 101,
          provider: 'deepseek',
          model: 'deepseek-chat',
          promptVersion: 'source-workflow-v1',
          factPackage: {
            facts: [{ claim: '活动由管理员本人记录。', evidenceRefs: ['M:manual'] }],
            missingInformation: ['活动时间'],
            reviewItems: ['发布前确认活动时间'],
            allowedSources: [{ ref: 'M:manual', label: '管理员本次补充', authorization: '个人笔记' }],
          },
          draft: {
            title: '测试生成的待审核文章',
            summary: '用于验证工作台展示和事实核实流程。',
            outline: ['背景'],
            sections: [{ id: 's1', heading: '背景', paragraphs: ['这是一段待管理员审核的正文。'] }],
            factChecklist: [{ claim: '活动时间', status: 'missing', question: '活动发生在什么时候？' }],
            suggestedTags: ['测试'],
            disclosure: { aiAssisted: true },
          },
          usage: { limit: 20, used: 2, remaining: 18 },
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
    await page.fill('textarea[name="manualText"]', '这是一段超过二十个字符的测试素材，用于验证管理员写作工作台。')
    await page.click('button[type="submit"]')

    await expect(page.getByRole('heading', { name: '测试生成的待审核文章' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '事实包' })).toBeVisible()
    await expect(page.getByText('活动发生在什么时候？')).toBeVisible()
    await expect(page.getByText('不会自动发布')).toBeVisible()
    await page.fill('input[pattern]', 'ai-test-draft')
    await page.getByRole('button', { name: '保存草稿' }).click()
    await expect(page.getByText('草稿已保存')).toBeVisible()
    await expect(page.getByText('content/articles/ai-test-draft.md')).toBeVisible()
  })

  test('shows the protected AI cover workbench on desktop and mobile', async () => {
    await page.goto('http://localhost:3000/studio/images')
    await expect(page.getByRole('heading', { name: 'AI 封面工作台' })).toBeVisible()
    await expect(page.getByText('SophNet')).toBeVisible()
    await expect(page.getByLabel('文章草稿')).toBeVisible()
    await expect(page.getByLabel('人物参考资产')).toBeVisible()
    await expect(page.getByText('AI 不会自动选择图片或发布文章')).toBeVisible()

    await page.setViewportSize({ width: 390, height: 844 })
    const dimensions = await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }))
    expect(dimensions.scrollWidth).toBe(dimensions.clientWidth)
    await expect(page.getByRole('heading', { name: 'AI 封面工作台' })).toBeVisible()
    await page.setViewportSize({ width: 1280, height: 720 })
  })
})
