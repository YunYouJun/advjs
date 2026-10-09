import type { Locator } from '@playwright/test'
import { expect, test } from '@playwright/test'

test.use({
  locale: 'zh-CN',
})

const gameRoutePattern = /.*\/#\/game(?:\?.*)?$/
const starterUrl = 'http://localhost:3333/#/start'

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
  test('runs the shared story opening and opens settings', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', error => pageErrors.push(error.message))
    await page.goto(starterUrl)
    const title = page.getByRole('heading', { name: 'ADV.JS Starter' })
    await expect.poll(async () => {
      if (pageErrors.length)
        return pageErrors[0]
      return await title.isVisible() ? 'ready' : 'loading'
    }, { timeout: 15_000 }).toBe('ready')

    await page.reload()
    await expect(title).toBeVisible()

    await page.locator('.start-menu-item').first().click()
    await expect(page).toHaveURL(gameRoutePattern)

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

    const settingsButton = page.getByRole('navigation', { name: '游戏设置与显示', exact: true }).getByRole('button', { name: '设置', exact: true })
    await settingsButton.click()
    const settings = page.getByRole('dialog', { name: '设置', exact: true })
    await expect(settings).toBeVisible()
    await expect(settings.getByRole('tab', { name: '对白', exact: true })).toHaveAttribute('aria-selected', 'true')
    await settings.getByRole('tab', { name: '画面', exact: true }).click()
    await expect(settings.getByRole('tab', { name: '画面', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(settings.getByRole('tabpanel', { name: '画面', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(settings).toBeHidden()
    await expect(dialog).toContainText('最小项目已经跑通')
    expect(pageErrors).toEqual([])
  })
})
