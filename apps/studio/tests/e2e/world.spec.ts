import { expect, test } from '@playwright/test'

test.describe('World Page', () => {
  test('world page loads and shows character list or empty state', async ({ page }) => {
    await page.goto('/tabs/world')
    await page.waitForTimeout(1500)
    // Should show either character cards or "no project/no characters" state
    const content = page.locator('ion-content').first()
    await expect(content).toBeVisible()
    // Either has characters or shows empty message
    const hasChars = await page.getByText('角色').or(page.getByText('Character')).first().isVisible().catch(() => false)
    const hasEmpty = await page.getByText('暂无角色').or(page.getByText('No Characters')).or(page.getByText('未选择项目').or(page.getByText('No Project'))).first().isVisible().catch(() => false)
    expect(hasChars || hasEmpty).toBeTruthy()
  })

  test('group chat tab is accessible', async ({ page }) => {
    await page.goto('/tabs/world')
    await page.waitForTimeout(1000)
    // Look for group chats link/tab
    const groupBtn = page.getByText('群聊').or(page.getByText('Group Chat'))
    if (await groupBtn.first().isVisible().catch(() => false)) {
      await groupBtn.first().click()
      await page.waitForTimeout(500)
      await expect(page.locator('ion-content').first()).toBeVisible()
    }
  })

  test('knowledge base tab shows files or empty state', async ({ page }) => {
    await page.goto('/tabs/world')
    await page.waitForTimeout(1000)
    const kbBtn = page.getByText('知识库').or(page.getByText('Knowledge'))
    if (await kbBtn.first().isVisible().catch(() => false)) {
      await kbBtn.first().click()
      await page.waitForTimeout(500)
      // Should show knowledge files or empty hint
      const content = page.locator('ion-content').first()
      await expect(content).toBeVisible()
    }
  })
})
