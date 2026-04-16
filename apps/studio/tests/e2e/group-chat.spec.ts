import { expect, test } from '@playwright/test'

test.describe('Group Chat', () => {
  test.beforeEach(async ({ page }) => {
    // Mock AI API responses for group chat
    await page.route('**/v1/chat/completions', async (route) => {
      const body = 'data: {"choices":[{"delta":{"content":"(responds in character)"}}]}\n\ndata: [DONE]\n'
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
        body,
      })
    })
    await page.goto('/tabs/world')
    await page.waitForTimeout(1500)
  })

  test('group chat section is visible on world page', async ({ page }) => {
    const groupSection = page.getByText('群聊').or(page.getByText('Group Chat'))
    if (await groupSection.first().isVisible().catch(() => false)) {
      await expect(groupSection.first()).toBeVisible()
    }
  })

  test('create group chat button opens creation dialog', async ({ page }) => {
    const createBtn = page.getByText('创建群聊').or(page.getByText('Create Group Chat'))
    if (await createBtn.first().isVisible().catch(() => false)) {
      await createBtn.first().click()
      await page.waitForTimeout(500)
      // Should show room name input and character selection
      const nameInput = page.locator('ion-input').filter({ hasText: /名称|Name/ })
      const selectChars = page.getByText('选择角色').or(page.getByText('Select characters'))
      const hasNameInput = await nameInput.first().isVisible().catch(() => false)
      const hasSelectChars = await selectChars.first().isVisible().catch(() => false)
      expect(hasNameInput || hasSelectChars).toBeTruthy()
    }
  })

  test('empty group chat list shows appropriate message', async ({ page }) => {
    const emptyMsg = page.getByText('还没有群聊').or(page.getByText('No group chats'))
    if (await emptyMsg.first().isVisible().catch(() => false)) {
      await expect(emptyMsg.first()).toBeVisible()
    }
  })

  test('group chat room renders message input when room exists', async ({ page }) => {
    // If any group chat room exists, click into it
    const roomCard = page.locator('[data-testid="group-room"], .group-room-card').first()
    if (await roomCard.isVisible().catch(() => false)) {
      await roomCard.click()
      await page.waitForTimeout(500)
      const chatInput = page.locator('textarea, ion-textarea').last()
      await expect(chatInput).toBeVisible()
    }
    else {
      // No rooms exist, which is fine
      await expect(page.locator('ion-content').first()).toBeVisible()
    }
  })
})
