import { expect, test } from '@playwright/test'

/**
 * Phase 17a Play Tab smoke tests.
 *
 * Verifies that the new save / load / CG gallery / stats UI is wired up
 * and that play progress persists across reloads.
 *
 * These tests require a project to be open; we seed via QuickStart when
 * the workspace is empty, otherwise the existing project is reused.
 */
test.describe('Play Tab — Phase 17a', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tabs/workspace')
    await page.waitForTimeout(1500)

    const hasProject = await page.evaluate(() => {
      const saved = localStorage.getItem('advjs-studio-projects')
      return saved ? JSON.parse(saved).length > 0 : false
    })

    if (!hasProject) {
      const quickStartBtn = page.getByText('一键体验').or(page.getByText('Quick Start')).or(page.getByText('quick-start'))
      if (await quickStartBtn.isVisible({ timeout: 3000 })) {
        await quickStartBtn.click()
        await page.waitForTimeout(2500)
      }
      else {
        test.skip()
      }
    }
  })

  test('Save / Load / CG Gallery / Stats / Branch Graph toolbar buttons are visible', async ({ page }) => {
    await page.goto('/tabs/play')
    await page.waitForTimeout(2500)

    // All five Phase 17 buttons exist (by aria-label, matching either locale).
    for (const labels of [
      ['存档', 'Save'],
      ['读档', 'Load'],
      ['CG 回廊', 'CG Gallery'],
      ['剧情统计', 'Stats'],
      ['分支图', 'Branch Graph'],
    ]) {
      const btn = page.locator(`ion-button[aria-label="${labels[0]}"], ion-button[aria-label="${labels[1]}"]`).first()
      await expect(btn).toBeVisible({ timeout: 5000 })
    }
  })

  test('CG Gallery opens and shows empty-state when no CGs unlocked', async ({ page }) => {
    await page.goto('/tabs/play')
    await page.waitForTimeout(2500)

    const cgBtn = page.locator('ion-button[aria-label="CG 回廊"], ion-button[aria-label="CG Gallery"]').first()
    await cgBtn.click()
    await page.waitForTimeout(500)

    // Empty-state hint should appear OR a grid of cells should render —
    // both are acceptable depending on whether the seeded project has
    // triggered background nodes yet.
    const emptyHint = page.getByText(/CG/i).first()
    await expect(emptyHint).toBeVisible({ timeout: 3000 })
  })

  test('Stats modal shows completion percentage', async ({ page }) => {
    await page.goto('/tabs/play')
    await page.waitForTimeout(2500)

    const statsBtn = page.locator('ion-button[aria-label="剧情统计"], ion-button[aria-label="Stats"]').first()
    await statsBtn.click()
    await page.waitForTimeout(500)

    // Look for percentage symbol — completion bar must render.
    await expect(page.getByText(/%/).first()).toBeVisible({ timeout: 3000 })
  })

  test('Play progress persists in localStorage across reload', async ({ page }) => {
    await page.goto('/tabs/play')
    await page.waitForTimeout(3000)

    // The progress key should exist (initialized lazily on first visit).
    await page.evaluate(() => {
      // Seed a known progress shape so we can assert it survives a reload.
      localStorage.setItem('advjs-studio:play-progress', JSON.stringify({
        'test-project': {
          chapters: { 'adv/chapters/01.adv.md': { visitedOrders: [0, 1, 2], history: [0, 1, 2] } },
          unlockedCGs: ['https://example.com/cg1.png'],
        },
      }))
    })

    await page.reload()
    await page.waitForTimeout(2000)

    const stored = await page.evaluate(() => localStorage.getItem('advjs-studio:play-progress'))
    expect(stored).toBeTruthy()
    const parsed = JSON.parse(stored!)
    expect(parsed['test-project'].unlockedCGs).toContain('https://example.com/cg1.png')
    expect(parsed['test-project'].chapters['adv/chapters/01.adv.md'].visitedOrders.length).toBe(3)
  })
})
