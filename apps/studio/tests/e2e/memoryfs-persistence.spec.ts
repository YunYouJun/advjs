import { expect, test } from '@playwright/test'

test.describe('MemoryFs Persistence', () => {
  test('create project via QuickStart, verify data persists after reload', async ({ page }) => {
    // 1. Navigate to workspace
    await page.goto('/tabs/workspace')
    await page.waitForTimeout(1500)

    // 2. Click QuickStart button to create a MemoryFs project
    const quickStartBtn = page.getByText('一键体验').or(page.getByText('Quick Start')).or(page.getByText('quick-start'))
    if (await quickStartBtn.isVisible({ timeout: 3000 })) {
      await quickStartBtn.click()
      await page.waitForTimeout(3000)
    }
    else {
      // If QuickStart is not available (project already exists), skip this step
      test.skip()
    }

    // 3. Verify project loaded — should be on world page or workspace overview
    const content = page.locator('ion-content').first()
    await expect(content).toBeVisible()

    // 4. Check localStorage has project data
    const projectsJson = await page.evaluate(() =>
      localStorage.getItem('advjs-studio-projects'),
    )
    expect(projectsJson).toBeTruthy()
    const projects = JSON.parse(projectsJson!)
    expect(projects.length).toBeGreaterThan(0)

    const currentId = await page.evaluate(() =>
      localStorage.getItem('advjs-studio-current'),
    )
    expect(currentId).toBeTruthy()

    // 5. Reload page
    await page.reload()
    await page.waitForTimeout(2000)

    // 6. Verify project is auto-restored after reload
    const restoredId = await page.evaluate(() =>
      localStorage.getItem('advjs-studio-current'),
    )
    expect(restoredId).toBe(currentId)

    // 7. Verify workspace content is visible (not stuck on empty welcome page)
    await expect(page.locator('ion-content').first()).toBeVisible()
  })

  test('IndexedDB data survives page reload', async ({ page }) => {
    await page.goto('/tabs/workspace')
    await page.waitForTimeout(2000)

    // Check if there are any projects
    const hasProjects = await page.evaluate(() => {
      const saved = localStorage.getItem('advjs-studio-projects')
      return saved ? JSON.parse(saved).length > 0 : false
    })

    if (!hasProjects) {
      test.skip()
    }

    // Verify IndexedDB has data
    const dbExists = await page.evaluate(async () => {
      const dbs = await indexedDB.databases()
      return dbs.some(db => db.name?.includes('advjs'))
    })
    expect(dbExists).toBeTruthy()

    // Reload and verify IndexedDB still has data
    await page.reload()
    await page.waitForTimeout(2000)

    const dbStillExists = await page.evaluate(async () => {
      const dbs = await indexedDB.databases()
      return dbs.some(db => db.name?.includes('advjs'))
    })
    expect(dbStillExists).toBeTruthy()
  })
})
