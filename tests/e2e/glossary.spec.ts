import process from 'node:process'
import { expect, test } from '@playwright/test'

const gameUrl = process.env.ADV_TEST_GAME_URL || 'http://localhost:3333'
test.use({ locale: 'zh-CN' })

test('opens glossary with the keyboard, restores focus and preserves dialogue on repeated dismissal', async ({ page }, testInfo) => {
  await page.goto(`${gameUrl}/#/start`)
  await page.getByRole('button', { name: '开始游戏', exact: true }).click()
  // The starter begins with a narration before the first referenced dialogue.
  const narration = page.locator('.adv-black')
  await expect(narration).toBeVisible()
  await narration.click()
  try {
    await narration.waitFor({ state: 'hidden', timeout: 500 })
  }
  catch {
    await narration.click()
  }
  const box = page.locator('.adv-dialog-box')
  const reference = box.getByRole('button', { name: '[advjs]', exact: true })
  await expect(reference).toBeVisible()
  await expect(reference).toHaveAttribute('tabindex', '0')
  const before = await box.textContent()
  for (const [index, key] of ['Enter', 'Space'].entries()) {
    await page.setViewportSize(index === 0 ? { width: 1200, height: 720 } : { width: 390, height: 844 })
    await reference.focus()
    await reference.press(key)
    const dialog = page.getByRole('dialog', { name: 'advjs', exact: true })
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('使用 Markdown 编写文字冒险故事的开源引擎。')
    const close = dialog.getByRole('button', { name: '关闭', exact: true })
    await expect(close).toBeFocused()
    // Visibility alone permits the first opacity-zero frame of Vue's modal
    // transition. Capture settled, on-screen content at both viewport sizes.
    await expect(dialog).toHaveCSS('opacity', '1')
    await expect(dialog.locator('.modal-container')).toHaveCSS('opacity', '1')
    await expect(close).toBeInViewport({ ratio: 1 })
    await expect(dialog.locator('.adv-glossary-definition')).toBeInViewport({ ratio: 0.5 })
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    await testInfo.attach(`glossary-${index === 0 ? 'desktop' : 'narrow'}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' })
    await page.keyboard.press('Tab')
    await expect(dialog.locator(':focus')).toHaveCount(1)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(reference).toBeFocused()
    await expect(box).toHaveText(before!)
  }
  await reference.click()
  await page.getByRole('dialog', { name: 'advjs', exact: true }).getByRole('button', { name: '关闭', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'advjs', exact: true })).toBeHidden()
  await expect(box).toHaveText(before!)
})
