import { expect, test } from '@playwright/test'

test('keeps game and editor slider semantics, pointer input and themes independent', async ({ page }, info) => {
  await page.setViewportSize({ width: 1000, height: 600 })
  await page.goto('http://127.0.0.1:3346')
  const editor = page.getByRole('region', { name: '编辑器属性' })
  const game = page.locator('[data-adv-ui="game"]')
  for (const [surface, name, rootClass] of [[editor, 'Exposure', '.agui-slider'], [game, '音乐音量', '.adv-slider']] as const) {
    const slider = surface.getByRole('slider', { name, exact: true })
    const input = surface.getByRole('spinbutton', { name, exact: true })
    await expect(slider).toHaveAttribute('aria-valuenow', '0.5')
    await slider.focus()
    await slider.press('ArrowRight')
    await expect(input).toHaveValue('0.55')
    await slider.press('Home')
    await expect(input).toHaveValue('0')
    await slider.press('End')
    await expect(input).toHaveValue('1')
    await input.fill('0.37')
    await expect(slider).toHaveAttribute('aria-valuenow', '0.37')
    await input.fill('')
    await slider.focus()
    await expect(input).toHaveValue('0.37')
    const root = surface.locator(rootClass).first()
    const bounds = (await root.boundingBox())!
    await root.click({ position: { x: bounds.width * 0.75, y: bounds.height / 2 } })
    await expect.poll(async () => Number(await slider.getAttribute('aria-valuenow'))).toBeCloseTo(0.75, 1)
    const thumb = (await slider.boundingBox())!
    await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2)
    await page.mouse.down()
    await page.mouse.move(bounds.x + bounds.width * 0.25, bounds.y + bounds.height / 2, { steps: 5 })
    await page.mouse.up()
    await expect.poll(async () => Number(await slider.getAttribute('aria-valuenow'))).toBeCloseTo(0.25, 1)
    const locked = surface.getByRole('slider', { name: surface === editor ? 'Locked exposure' : '锁定音量', exact: true })
    await expect(locked).toBeDisabled()
    await surface.locator(rootClass).last().click({ position: { x: 10, y: 12 }, force: true })
    await expect(locked).toHaveAttribute('aria-valuenow', '0.4')
  }
  await expect(editor.locator('.agui-slider').first()).toHaveCSS('height', '24px')
  await expect(game.locator('.adv-slider').first()).toHaveCSS('height', '36px')
  await expect(game.getByRole('slider', { name: '音乐音量', exact: true })).toHaveCSS('border-radius', '0px')
  for (const dark of [false, true]) {
    await page.locator('html').evaluate((element, value) => element.classList.toggle('dark', value), dark)
    const editorColor = dark ? 'rgb(60, 101, 155)' : 'rgb(53, 99, 154)'
    await expect(editor.locator('.agui-slider-range').first()).toHaveCSS('background-color', editorColor)
    await expect(game.locator('.adv-slider-range').first()).toHaveCSS('background-color', 'rgb(181, 135, 72)')
    for (const width of [1000, 320]) {
      await page.setViewportSize({ width, height: 600 })
      await expect.poll(() => page.locator('body').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1)
      await expect(editor.getByRole('slider', { name: 'Exposure', exact: true })).toBeInViewport({ ratio: 1 })
      await expect(game.getByRole('slider', { name: '音乐音量', exact: true })).toBeInViewport({ ratio: 1 })
      await page.screenshot({ path: info.outputPath(`sliders-${dark ? 'dark' : 'light'}-${width}.png`) })
    }
  }
})
