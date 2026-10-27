import { expect, test, type Page } from '@playwright/test'

const surfaces = [
  ['home', '/'],
  ['journal', '/journal/llm-medical-literature-review'],
  ['project', '/projects/privacyguard'],
  ['assistant', '/assistant'],
  ['management-boundary', '/manage'],
] as const

async function settle(page: Page) {
  await page.waitForLoadState('domcontentloaded')
  await page.evaluate(async () => {
    await document.fonts.ready
    const images = Array.from(document.images).filter((image) => {
      const rect = image.getBoundingClientRect()
      return !image.closest('[aria-hidden="true"]') && rect.bottom > 0 && rect.top < window.innerHeight
    })
    await Promise.race([Promise.all(images.map((image) => image.complete ? undefined : new Promise<void>((resolve) => {
      image.addEventListener('load', () => resolve(), { once: true })
      image.addEventListener('error', () => resolve(), { once: true })
    }))), new Promise((resolve) => setTimeout(resolve, 5000))])
  })
}

for (const viewport of [
  { height: 1000, label: 'desktop', width: 1440 },
  { height: 844, label: 'mobile', width: 390 },
] as const) {
  test.describe(`visual regression at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport: { height: viewport.height, width: viewport.width } })

    for (const [name, route] of surfaces) {
      test(`${name} remains visually stable`, async ({ page }) => {
        const pageErrors: string[] = []
        const consoleErrors: string[] = []
        page.on('pageerror', (error) => pageErrors.push(error.message))
        page.on('console', (message) => {
          if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) consoleErrors.push(message.text())
        })
        await page.goto(`http://localhost:3000${route}`)
        await settle(page)

        const quality = await page.evaluate(() => {
          const visibleImages = Array.from(document.images).filter((image) => {
            const rect = image.getBoundingClientRect()
            return !image.closest('[aria-hidden="true"]') && rect.bottom > 0 && rect.top < window.innerHeight
          })
          return {
            brokenImages: visibleImages.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.currentSrc || image.src),
            clientWidth: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
          }
        })
        expect(quality.brokenImages).toEqual([])
        expect(quality.scrollWidth).toBe(quality.clientWidth)
        expect(pageErrors).toEqual([])
        expect(consoleErrors).toEqual([])
        await expect(page).toHaveScreenshot(`${name}-${viewport.label}.png`, {
          animations: 'disabled',
          maxDiffPixelRatio: 0.025,
          scale: 'css',
        })
      })
    }
  })
}

test('expanded mobile navigation remains visually stable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:3000/journal')
  await page.getByRole('button', { name: '打开主菜单' }).click()
  await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: /文章/ })).toHaveAttribute('aria-current', 'page')
  await expect(page).toHaveScreenshot('mobile-navigation-open.png', { animations: 'disabled', maxDiffPixelRatio: 0.025, scale: 'css' })
})
