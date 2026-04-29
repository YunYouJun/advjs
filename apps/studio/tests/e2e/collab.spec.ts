import { expect, test } from '@playwright/test'

test.describe('Collaboration', () => {
  test('collab settings page is accessible', async ({ page }) => {
    await page.goto('/tabs/workspace/collab')
    await page.waitForTimeout(1000)

    // Should show the page title
    const title = page.getByText('协作设置').or(page.getByText('Collaboration Settings'))
    await expect(title.first()).toBeVisible()
  })

  test('collab settings shows no-room hint when not in a room', async ({ page }) => {
    await page.goto('/tabs/workspace/collab')
    await page.waitForTimeout(1000)

    // Should show the "no room" message
    const noRoomHint = page.getByText('当前未加入协作房间').or(page.getByText('Not in a collaboration room'))
    await expect(noRoomHint.first()).toBeVisible()
  })

  test('collab bar appears in content editor markdown tab', async ({ page }) => {
    await page.goto('/tabs/workspace')
    await page.waitForTimeout(1000)

    // Create or select a project first
    const createBtn = page.getByText('创建项目').or(page.getByText('Create Project')).first()
    if (await createBtn.isVisible()) {
      await createBtn.click()
      await page.waitForTimeout(500)
    }

    // Navigate to chapters
    const chaptersBtn = page.getByText('章节').or(page.getByText('Chapters')).first()
    if (await chaptersBtn.isVisible()) {
      await chaptersBtn.click()
      await page.waitForTimeout(500)

      // Look for collab-related UI in the editor
      const collabBar = page.locator('.cem-collab-bar')
      // The collab bar is only visible when markdown tab is active
      // This test verifies the element exists in the DOM
      const markdownTab = page.getByText('Markdown').first()
      if (await markdownTab.isVisible()) {
        await markdownTab.click()
        await page.waitForTimeout(500)
        await expect(collabBar.first()).toBeVisible()
      }
    }
  })

  test('collab status shows idle when not connected', async ({ page }) => {
    await page.goto('/tabs/workspace')
    await page.waitForTimeout(1000)

    // Navigate to a content editor
    const chaptersBtn = page.getByText('章节').or(page.getByText('Chapters')).first()
    if (await chaptersBtn.isVisible()) {
      await chaptersBtn.click()
      await page.waitForTimeout(500)

      const markdownTab = page.getByText('Markdown').first()
      if (await markdownTab.isVisible()) {
        await markdownTab.click()
        await page.waitForTimeout(500)

        // Should show idle or login required status
        const idleText = page.getByText('单人编辑').or(page.getByText('Solo editing'))
        const loginText = page.getByText('登录后可启用协作').or(page.getByText('Sign in to collaborate'))
        const unavailText = page.getByText('暂不可协作').or(page.getByText('unavailable'))

        const hasIdle = await idleText.first().isVisible().catch(() => false)
        const hasLogin = await loginText.first().isVisible().catch(() => false)
        const hasUnavail = await unavailText.first().isVisible().catch(() => false)

        expect(hasIdle || hasLogin || hasUnavail).toBeTruthy()
      }
    }
  })

  test('collab start button exists in markdown editor', async ({ page }) => {
    await page.goto('/tabs/workspace')
    await page.waitForTimeout(1000)

    const chaptersBtn = page.getByText('章节').or(page.getByText('Chapters')).first()
    if (await chaptersBtn.isVisible()) {
      await chaptersBtn.click()
      await page.waitForTimeout(500)

      const markdownTab = page.getByText('Markdown').first()
      if (await markdownTab.isVisible()) {
        await markdownTab.click()
        await page.waitForTimeout(500)

        // Should have a start/stop collaboration button
        const startBtn = page.getByText('启用协作').or(page.getByText('Start collaboration'))
        const stopBtn = page.getByText('离开协作').or(page.getByText('Leave collaboration'))

        const hasStart = await startBtn.first().isVisible().catch(() => false)
        const hasStop = await stopBtn.first().isVisible().catch(() => false)

        expect(hasStart || hasStop).toBeTruthy()
      }
    }
  })
})
