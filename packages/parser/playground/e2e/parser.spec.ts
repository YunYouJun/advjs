import { expect, test } from '@playwright/test'

test('loads the production playground and shows ADV dialogue instead of raw Markdown text', async ({ page, request }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error')
      errors.push(message.text())
  })

  await page.goto('/#/')
  await expect(page).toHaveTitle('Playground | ADV.JS Parser')
  await expect(page.getByRole('heading', { name: /Demo for/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'ADV AST', exact: true })).toHaveAttribute('aria-pressed', 'true')

  for (const name of ['starter', 'love']) {
    const response = await request.get(`/examples/demo/${name}/index.adv.md`)
    expect(response.ok()).toBe(true)
    expect(await response.text()).toContain(name === 'starter' ? '@向导' : '@小云\nHello～')
  }

  const input = page.locator('.monaco-editor .view-lines').first()
  await expect(input).toContainText('@向导')
  await input.click()
  const selectAll = await page.evaluate(() => /Macintosh/.test(navigator.userAgent) ? 'Meta+A' : 'Control+A')
  await page.keyboard.press(selectAll)
  await page.keyboard.press('Backspace')
  await expect(input).not.toContainText('@向导')
  await page.keyboard.insertText('@小云\nHello～')
  const output = page.locator('#preview-container .view-lines')
  await expect(output).toContainText(/"type":\s*"dialog"/)
  await expect(output).toContainText(/"name":\s*"小云"/)
  await expect(output).toContainText('Hello～')
  await page.screenshot({ path: testInfo.outputPath('parser-dialogue-desktop.png') })

  await page.getByRole('button', { name: 'Markdown AST', exact: true }).click()
  await expect(output).toContainText(/"type":\s*"paragraph"/)
  await expect(output).toContainText(/@小云\\nHello～/)

  await page.getByRole('button', { name: 'ADV AST', exact: true }).click()
  await expect(output).toContainText(/"type":\s*"dialog"/)
  await page.getByRole('button', { name: 'Runtime Diagnostics', exact: true }).click()
  await expect(output).toHaveText('[]')
  await page.getByRole('button', { name: 'ADV AST', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(output).toContainText(/"type":\s*"dialog"/)
  await page.locator('#outputContent').scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('parser-dialogue-mobile.png') })
  await page.locator('#clear').click()
  await expect(output).toContainText(/"children":\s*\[\]/)
  expect(errors).toEqual([])
})

test('preserves saved Markdown AST preferences and parses the Love sample', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('advjs:editor:options', JSON.stringify({
      mdUrl: '/examples/demo/love/index.adv.md',
      outputType: 'markdown-it',
      inputText: '',
    }))
  })
  await page.goto('/#/')
  await expect(page.getByRole('button', { name: 'Markdown AST', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#preview-container .view-lines')).toContainText('Doki Doki Love')
  await page.getByRole('button', { name: 'ADV AST', exact: true }).click()
  await expect(page.locator('#preview-container .view-lines')).toContainText(/"type":\s*"dialog"/)
})
