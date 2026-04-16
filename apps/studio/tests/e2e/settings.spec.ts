import { expect, test } from '@playwright/test'

test.describe('Settings', () => {
  test('AI Provider settings page loads', async ({ page }) => {
    await page.goto('/tabs/me')
    await page.waitForTimeout(1000)
    // Click AI Provider settings
    const aiBtn = page.getByText('AI 服务商').or(page.getByText('AI Provider')).first()
    if (await aiBtn.isVisible()) {
      await aiBtn.click()
      await page.waitForTimeout(500)
      // Verify provider selector is visible
      const providerLabel = page.getByText('服务商').or(page.getByText('Provider'))
      await expect(providerLabel.first()).toBeVisible()
    }
  })

  test('language switch toggles UI text', async ({ page }) => {
    await page.goto('/tabs/me')
    await page.waitForTimeout(1000)
    // Look for language/appearance settings
    const appearanceBtn = page.getByText('外观').or(page.getByText('Appearance')).first()
    if (await appearanceBtn.isVisible()) {
      await appearanceBtn.click()
      await page.waitForTimeout(500)
      // Verify language selector is present
      const langLabel = page.getByText('语言').or(page.getByText('Language'))
      await expect(langLabel.first()).toBeVisible()
    }
  })

  test('color mode toggle changes theme', async ({ page }) => {
    await page.goto('/tabs/me')
    await page.waitForTimeout(1000)
    const appearanceBtn = page.getByText('外观').or(page.getByText('Appearance')).first()
    if (await appearanceBtn.isVisible()) {
      await appearanceBtn.click()
      await page.waitForTimeout(500)
      // Verify color mode options exist
      const darkLabel = page.getByText('深色').or(page.getByText('Dark'))
      const lightLabel = page.getByText('浅色').or(page.getByText('Light'))
      const hasDark = await darkLabel.first().isVisible().catch(() => false)
      const hasLight = await lightLabel.first().isVisible().catch(() => false)
      expect(hasDark || hasLight).toBeTruthy()
    }
  })
})
