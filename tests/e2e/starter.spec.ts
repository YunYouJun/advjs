import type { Locator } from '@playwright/test'
import { expect, test } from '@playwright/test'

test.use({
  locale: 'zh-CN',
})

const hashRootPattern = /.*\/#\//

async function advanceTo(current: Locator, next: Locator) {
  await current.click()
  try {
    await next.waitFor({ state: 'visible', timeout: 500 })
    return
  }
  catch {}
  await current.click()
  await expect(next).toBeVisible()
}

test.describe('Demo Starter', () => {
  test('runs the minimal story and opens settings', async ({ page }) => {
    await page.goto('http://localhost:3333/')
    expect(page.url()).toContain('http://localhost:3333/')

    await expect(page.locator('text=Made with ADV.JS')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'ADV.JS Starter' })).toBeVisible()

    await page.locator('.start-menu-item').first().click()
    await expect(page).toHaveURL(hashRootPattern)

    const narration = page.locator('.adv-black')
    const dialog = page.locator('.adv-dialog-box')
    await expect(narration).toContainText('这段旁白直接来自一个')
    await advanceTo(narration, dialog.filter({ hasText: '欢迎来到 ADV.JS' }))

    const syntaxChoice = page.getByRole('button', { name: '看看语法' })
    await advanceTo(dialog, syntaxChoice)
    await syntaxChoice.click()

    await expect(narration).toContainText('标题可以作为稳定锚点')
    const continueChoice = page.getByRole('button', { name: '继续' })
    await advanceTo(narration, continueChoice)
    await continueChoice.click()

    await expect(dialog).toContainText('最小项目已经跑通')

    await page.locator('.menu-setting-button').first().click()
    await expect(page.getByRole('tab', { name: '设置' })).toBeVisible()
  })
})
