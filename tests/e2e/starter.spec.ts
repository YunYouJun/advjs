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
  test('runs the hamster story through the star-map activity', async ({ page }) => {
    await page.goto('http://localhost:3333/')
    expect(page.url()).toContain('http://localhost:3333/')

    await expect(page.locator('text=Made with ADV.JS')).toBeVisible()
    await expect(page.getByRole('heading', { name: '仓鼠：星海回声' })).toBeVisible()

    await page.locator('.start-menu-item').first().click()
    await expect(page).toHaveURL(hashRootPattern)

    const narration = page.locator('.adv-black')
    const dialog = page.locator('.adv-dialog-box')
    await expect(narration).toContainText('透明笼中的仓鼠踩动转轮')
    await advanceTo(narration, dialog.filter({ hasText: '你相信笼子外面还有别的世界吗？' }))

    await expect(dialog).toContainText('你相信笼子外面还有别的世界吗？')
    await advanceTo(dialog, dialog.filter({ hasText: '仓鼠看不见两米之外' }))
    await expect(dialog).toContainText('仓鼠看不见两米之外')
    const starMapChoice = page.getByRole('button', { name: '继续观察星图' })
    await advanceTo(dialog, starMapChoice)

    await starMapChoice.click()
    await expect(dialog).toContainText('这组星点不属于今天的天空')
    const starMapActivity = page.getByRole('heading', { name: '星图比对' })
    await advanceTo(dialog, starMapActivity)

    await expect(starMapActivity).toBeVisible()
    await page.getByRole('button', { name: '确认匹配' }).click()
    await expect(dialog).toContainText('轮廓重合了')

    await page.locator('.menu-setting-button').first().click()
  })
})
