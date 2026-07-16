import type { Locator } from '@playwright/test'
import { expect, test } from '@playwright/test'

test.use({ locale: 'zh-CN' })

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

test.describe('Hamster flagship demo', () => {
  test('runs the still-gazing route through both activities', async ({ page }) => {
    await page.goto('http://localhost:3334/')
    await expect(page.getByRole('heading', { name: '仓鼠：星海回声' })).toBeVisible()

    await page.locator('.start-menu-item').first().click()
    const narration = page.locator('.adv-black')
    const dialog = page.locator('.adv-dialog-box')

    await expect(narration).toContainText('透明笼中的仓鼠踩动转轮')
    await advanceTo(narration, dialog.filter({ hasText: '你相信笼子外面还有别的世界吗？' }))
    await advanceTo(dialog, dialog.filter({ hasText: '仓鼠看不见两米之外' }))

    const observe = page.getByRole('button', { name: '继续观察星图' })
    await advanceTo(dialog, observe)
    await observe.click()
    await expect(dialog).toContainText('不属于今天的天空')

    const starMap = page.getByRole('heading', { name: '星图比对' })
    await advanceTo(dialog, starMap)
    await page.getByRole('button', { name: '确认匹配' }).click()
    await expect(starMap).toBeHidden()
    await expect(dialog).toContainText('轮廓重合')

    const carry = page.getByRole('button', { name: '带着星图回声走向最后一夜' })
    await advanceTo(dialog, carry)
    await carry.click()

    await expect(narration).toContainText('星图回声贴在玻璃上')
    await advanceTo(narration, dialog.filter({ hasText: '如果明天不再到来' }))
    await advanceTo(dialog, dialog.filter({ hasText: '不要替仓鼠决定世界的大小' }))
    const openDoor = page.getByRole('button', { name: '打开笼门，让它自己寻找出口' })
    await advanceTo(dialog, openDoor)
    await openDoor.click()

    await expect(narration).toContainText('一只普通仓鼠在晨光里出生')
    await advanceTo(narration, dialog.filter({ hasText: '短暂并不等于空白' }))
    await advanceTo(dialog, narration.filter({ hasText: '旧世界的星图被刻进第一块记忆石' }))
    await advanceTo(narration, dialog.filter({ hasText: '个体会忘记' }))

    const civilization = page.getByRole('heading', { name: '文明初始化' })
    await advanceTo(dialog, civilization)
    await expect(page.getByRole('textbox', { name: '名称' })).toHaveValue('仓生')
    await expect(page.getByRole('spinbutton', { name: '等级' })).toHaveValue('1')
    await expect(page.getByRole('combobox', { name: '核心原则' })).toHaveValue('memory')
    await page.getByRole('button', { name: '初始化' }).click()
    await expect(civilization).toBeHidden()

    await expect(narration).toContainText('第一枚符号还很笨拙')
    const dimStars = page.getByRole('button', { name: '去看群星黯淡以后的世界' })
    await advanceTo(narration, dimStars)
    await dimStars.click()

    await expect(narration).toContainText('恒星一颗接一颗沉入黑暗')
    await advanceTo(narration, dialog.filter({ hasText: '没有永恒的笼子' }))
    const continueChoice = page.getByRole('button', { name: '继续', exact: true })
    await advanceTo(dialog, continueChoice)
    await expect(continueChoice).toHaveCount(1)
    await continueChoice.click()
    await expect(narration).toContainText('我们仍在仰望')

    await page.getByRole('button', { name: '⚔️' }).click()
    await expect(page.getByRole('heading', { name: 'Runtime Inspector' })).toBeVisible()
    await page.locator('div[class*="z-9998"]').click({ position: { x: 20, y: 20 } })

    await page.locator('.menu-setting-button').first().click()
    await expect(page.getByRole('tab', { name: '设置' })).toBeVisible()
  })
})
