import { expect, test } from '@playwright/test'

test.describe('Demo Starter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3333/')
  })

  test('basic nav', async ({ page }) => {
    // Verify the initial URL
    await expect(page).toHaveURL('http://localhost:3333/')

    // Check for the presence of the text '@YunYouJun'
    await expect(page.locator('text=@YunYouJun')).toBeVisible()

    // Click the first start menu item
    await page.locator('.start-menu-item').first().click()
    await expect(page).toHaveURL(/.*\/#\//)

    // Check for the presence of the first dialog text
    await expect(page.locator('text=你说世界上真的有外星人吗？')).toBeVisible()

    // Click the settings button
    await page.locator('.menu-setting-button').first().click()

    // Check for the presence of the settings text
    await expect(page.getByRole('heading', { name: '设置' })).toBeVisible()
  })

  // Uncomment and modify the following test if needed
  // test('markdown', async ({ page }) => {
  //   await page.locator('[data-test-id="about"]').click();
  //   await expect(page).toHaveURL('http://localhost:3333/about');

  //   await expect(page.locator('.shiki')).toBeVisible();
  // });
})
