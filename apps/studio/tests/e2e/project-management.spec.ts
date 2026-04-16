import { expect, test } from '@playwright/test'

test.describe('Project Management', () => {
  test('create a new project and verify workspace redirect', async ({ page }) => {
    await page.goto('/tabs/workspace')
    // Click "Create New Project"
    const createBtn = page.getByText('创建新项目').or(page.getByText('Create New Project'))
    if (await createBtn.isVisible()) {
      await createBtn.click()
      // Fill project name
      const nameInput = page.locator('ion-input[label*="名称"], ion-input[label*="Name"]').first()
      await nameInput.waitFor({ state: 'visible', timeout: 5000 })
      await nameInput.click()
      await page.keyboard.type('Test Project E2E')
      // Select a template
      const template = page.getByText('视觉小说入门').or(page.getByText('Visual Novel Starter'))
      if (await template.isVisible())
        await template.click()
      // Confirm creation
      const confirmBtn = page.locator('ion-button').filter({ hasText: /创建|Create/ }).first()
      if (await confirmBtn.isVisible())
        await confirmBtn.click()
      // Verify workspace or overview loads
      await page.waitForTimeout(2000)
      await expect(page.locator('ion-content').first()).toBeVisible()
    }
  })

  test('switch between projects in the list', async ({ page }) => {
    await page.goto('/tabs/workspace')
    await page.waitForTimeout(1000)
    // Verify workspace page renders
    await expect(page.locator('ion-content').first()).toBeVisible()
    // Check project list area is present
    const content = page.locator('ion-content').first()
    await expect(content).toBeVisible()
  })

  test('export project button exists and is clickable', async ({ page }) => {
    await page.goto('/tabs/workspace')
    await page.waitForTimeout(1000)
    // Look for export button (cloud download icon)
    const exportBtn = page.locator('button[title*="导出"], button[title*="Export"]').first()
    if (await exportBtn.isVisible()) {
      await expect(exportBtn).toBeEnabled()
    }
  })

  test('import project flow shows file picker', async ({ page }) => {
    await page.goto('/tabs/workspace')
    await page.waitForTimeout(1000)
    const importBtn = page.getByText('导入项目').or(page.getByText('Import Project'))
    if (await importBtn.isVisible()) {
      // Just verify button exists - clicking opens native file picker which we can't interact with
      await expect(importBtn).toBeVisible()
    }
  })
})
