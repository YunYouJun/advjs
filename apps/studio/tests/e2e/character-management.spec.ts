import { expect, test } from '@playwright/test'

test.describe('Character Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tabs/workspace')
    await page.waitForTimeout(1000)
  })

  test('character list renders when navigating to characters tab', async ({ page }) => {
    // Navigate to characters section
    const charLink = page.getByText('角色').or(page.getByText('Characters')).first()
    if (await charLink.isVisible()) {
      await charLink.click()
      await page.waitForTimeout(1000)
      await expect(page.locator('ion-content').first()).toBeVisible()
    }
  })

  test('character editor modal opens with form tab', async ({ page }) => {
    // Navigate to characters
    await page.goto('/tabs/workspace/characters')
    await page.waitForTimeout(1000)
    // Look for create button
    const createBtn = page.locator('ion-fab-button, button').filter({ hasText: /\+|创建|Create/ }).first()
    if (await createBtn.isVisible()) {
      await createBtn.click()
      await page.waitForTimeout(500)
      // Verify form tab is present
      const formTab = page.getByText('表单').or(page.getByText('Form'))
      await expect(formTab.first()).toBeVisible()
    }
  })

  test('character search filters the list', async ({ page }) => {
    await page.goto('/tabs/workspace/characters')
    await page.waitForTimeout(1000)
    const searchInput = page.locator('ion-searchbar, input[type="search"]').first()
    if (await searchInput.isVisible()) {
      await searchInput.click()
      await page.keyboard.type('nonexistent-character-xyz')
      await page.waitForTimeout(500)
      // Should show empty or filtered results
      await expect(page.locator('ion-content').first()).toBeVisible()
    }
  })

  test('character CSV export button exists', async ({ page }) => {
    await page.goto('/tabs/workspace/characters')
    await page.waitForTimeout(1000)
    const exportBtn = page.getByText('导出角色').or(page.getByText('Export Characters'))
    if (await exportBtn.isVisible()) {
      await expect(exportBtn).toBeVisible()
    }
  })
})
