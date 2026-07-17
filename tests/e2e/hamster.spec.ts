import type { Locator } from '@playwright/test'
import { expect, test } from '@playwright/test'

test.use({ locale: 'zh-CN' })

async function finishAndAdvance(locator: Locator) {
  await locator.evaluate((element: HTMLElement) => element.click())
  await locator.evaluate((element: HTMLElement) => element.click())
}

test.describe('Hamster flagship demo', () => {
  test('uses the project start screen and generated stage art', async ({ page }) => {
    const failedResponses: string[] = []
    page.on('response', (response) => {
      if (response.status() >= 400)
        failedResponses.push(`${response.status()} ${response.url()}`)
    })

    await page.goto('http://localhost:3334/')

    await expect(page.getByRole('heading', { name: /仓鼠/ })).toBeVisible()
    await expect(page.getByText('星海回声', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /开始观测/ })).toBeVisible()
    await expect(page.getByRole('link', { name: '创作档案' })).toBeVisible()

    await page.getByRole('button', { name: /开始观测/ }).click()
    const narration = page.locator('.adv-black')
    await expect(narration).toContainText('第一份观测记录已经就绪')
    await finishAndAdvance(narration)

    const canonical = page.getByRole('button', { name: /从《仓鼠》开始原作主线/ })
    await expect(canonical).toBeVisible()
    await expect(page.getByRole('button', { name: /A\+ 演绎模式/ })).toHaveCount(0)
    await canonical.click()

    await expect(narration).toContainText('冷气把盛夏挡在玻璃幕墙之外')
    await expect(page.locator('.adv-background')).toHaveCSS(
      'background-image',
      /games\/hamster\/v1\/backgrounds\/summer-room/,
    )
    await expect(page.locator('.tachie-character')).toHaveCount(3)

    await expect.poll(async () => page.locator('.adv-screen').evaluate(element => ({
      left: element.scrollLeft,
      top: element.scrollTop,
    }))).toEqual({ left: 0, top: 0 })

    await finishAndAdvance(narration)
    const dialog = page.locator('.adv-dialog-box')
    await expect(dialog).toContainText('你说，世界上真的有外星人吗？')
    await expect(dialog.locator('.dialog-name')).toHaveText('观测者')
    await expect(page.locator('.tachie-character.active')).toHaveCount(1)

    expect(failedResponses).toEqual([])
  })

  test('opens the dedicated adaptation credits page', async ({ page }) => {
    await page.goto('http://localhost:3334/')
    await page.getByRole('link', { name: '创作档案' }).click()

    await expect(page).toHaveURL(/#\/credits$/)
    await expect(page.getByRole('heading', { name: '创作档案' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'YunYouJun《仓鼠》' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'YunYouJun《仓生》' })).toBeVisible()
    await expect(page.getByText('CC BY-NC-SA 4.0')).toBeVisible()
  })
})
