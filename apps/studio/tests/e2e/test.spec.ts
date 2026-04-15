import { expect, test } from '@playwright/test'

test.describe('App launch', () => {
  test('redirects root to /tabs/workspace', async ({ page }) => {
    await page.goto('/')
    await page.waitForURL(/\/tabs\/workspace/)
    await expect(page).toHaveURL(/\/tabs\/workspace/)
  })

  test('renders the workspace page with Ionic content', async ({ page }) => {
    await page.goto('/tabs/workspace')
    // The page should have at least one ion-content element
    await expect(page.locator('ion-content').first()).toBeVisible()
  })
})

test.describe('Tab navigation', () => {
  test('navigates between all main tabs', async ({ page }) => {
    await page.goto('/tabs/workspace')

    // Navigate to Chat tab
    await page.click('ion-tab-button[tab="chat"]')
    await page.waitForURL(/\/tabs\/chat/)
    await expect(page.locator('ion-content').first()).toBeVisible()

    // Navigate to World tab
    await page.click('ion-tab-button[tab="world"]')
    await page.waitForURL(/\/tabs\/world/)
    await expect(page.locator('ion-content').first()).toBeVisible()

    // Navigate to Play tab
    await page.click('ion-tab-button[tab="play"]')
    await page.waitForURL(/\/tabs\/play/)
    await expect(page.locator('ion-content').first()).toBeVisible()

    // Navigate to Me tab
    await page.click('ion-tab-button[tab="me"]')
    await page.waitForURL(/\/tabs\/me/)
    await expect(page.locator('ion-content').first()).toBeVisible()

    // Navigate back to Workspace tab
    await page.click('ion-tab-button[tab="workspace"]')
    await page.waitForURL(/\/tabs\/workspace/)
    await expect(page.locator('ion-content').first()).toBeVisible()
  })
})

test.describe('Tab bar visibility', () => {
  test('tab bar is present in the DOM', async ({ page }) => {
    await page.goto('/tabs/workspace')
    await expect(page.locator('ion-tab-bar')).toBeAttached()
  })

  test('all five tab buttons are rendered', async ({ page }) => {
    await page.goto('/tabs/workspace')
    const tabs = page.locator('ion-tab-button')
    await expect(tabs).toHaveCount(5)
  })
})
