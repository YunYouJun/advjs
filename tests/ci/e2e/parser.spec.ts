import { expect, test } from '@playwright/test'

test('loads the production Parser and parses an edited dialogue', async ({ page, request }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error')
      errors.push(message.text())
  })

  const sample = await request.get('/examples/demo/starter/index.adv.md')
  expect(sample.ok()).toBe(true)
  expect(await sample.text()).toContain('@')
  await page.goto('/#/')
  await expect(page.getByRole('heading', { name: /Demo for/ })).toBeVisible()
  const input = page.locator('.monaco-editor .view-lines').first()
  await expect(input).toContainText('@')
  await input.click()
  const selectAll = await page.evaluate(() => /Macintosh/.test(navigator.userAgent) ? 'Meta+A' : 'Control+A')
  await page.keyboard.press(selectAll)
  await page.keyboard.press('Backspace')
  await expect(input).not.toContainText('@我')
  await page.keyboard.insertText('@小云\nHello～')
  await expect(input).toContainText('小云')
  await page.getByTitle('ADV Lexer', { exact: true }).click()
  const output = page.locator('#preview-container .view-lines')
  await expect(output).toContainText(/"type":\s*"dialog"/)
  await expect(output).toContainText('小云')
  await expect(output).toContainText('Hello～')
  expect(errors).toEqual([])
})
