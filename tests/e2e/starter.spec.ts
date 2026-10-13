import { expect, test } from '@playwright/test'

test.use({
  locale: 'zh-CN',
})

const hashRootPattern = /.*\/#\//

test.describe('Demo Starter', () => {
  test('basic nav', async ({ page }, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('/')
    // Verify the initial URL
    expect(page.url()).toContain(testInfo.project.use.baseURL!)

    // The starter title is configured by its public game configuration.
    await expect(page.getByRole('heading', { name: 'ADVJS Starter', exact: true })).toBeVisible()

    // Click the first start menu item
    await page.locator('.start-menu-item').first().click()
    await expect(page).toHaveURL(hashRootPattern)

    // Check for the presence of the first dialog text
    await expect(page.locator('text=你说世界上真的有外星人吗？')).toBeVisible()

    // Click the settings button
    await page.locator('.menu-setting-button').first().click()
    expect(errors).toEqual([])

    // Check for the presence of the settings text
    // await expect(page.getByRole('heading', { name: '设置' })).toBeVisible()
  })

  // Uncomment and modify the following test if needed
  // test('markdown', async ({ page }) => {
  //   await page.locator('[data-test-id="about"]').click();
  //   await expect(page).toHaveURL('http://localhost:3333/about');

  //   await expect(page.locator('.shiki')).toBeVisible();
  // });
})
