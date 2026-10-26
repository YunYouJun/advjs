import { writeFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

/** Real product entry, local project only: this test never configures or calls a paid service. */
test('opens creative partners, prevents unavailable generation and preserves the content editor draft', async ({ page }, info) => {
  test.setTimeout(120000)
  const errors: string[] = []
  const warnings: string[] = []
  const paidRequests: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error')
      errors.push(message.text())
    if (message.type() === 'warning')
      warnings.push(message.text())
  })
  await page.route('**/ai/v2/apps/advjs-studio-web/creative-team/**', async (route) => {
    if (route.request().method() === 'POST')
      paidRequests.push(route.request().url())
    await route.abort()
  })
  await page.goto('/tabs/workspace')
  await page.getByText('立即体验', { exact: true }).first().click()
  await expect(page).toHaveURL(/\/tabs\/world$/)
  await page.goto('/tabs/workspace')
  await page.getByRole('link', { name: /与制作组一起创作/ }).click()
  await expect(page).toHaveURL(/workspace\/creative-team/)
  await expect(page).toHaveTitle(/ADV.JS Studio/)
  const workspace = page.locator('.team-workspace')
  await expect(workspace).toContainText('登录后可查看制作组服务')
  await expect(workspace.locator('.partner-roster__item')).toHaveCount(6)
  await expect(page.locator('.managed-agent-dock, .managed-agent-rail')).toHaveCount(0)
  await expect.poll(() => workspace.evaluate(element => new DOMMatrix(getComputedStyle(element.closest('.ion-page')!).transform).m41)).toBe(0)
  const writer = workspace.getByRole('button', { name: /^编剧/ })
  await writer.focus()
  await writer.press('Enter')
  await expect(writer).toHaveAttribute('aria-pressed', 'true')
  await workspace.getByLabel('这次想完成什么？').fill('请润色一段很长的中文对白，保留人物的克制口吻、明确的说话动机与雨夜车站的悬疑氛围。'.repeat(3))
  await workspace.getByLabel('本次总点数上限').fill('20')
  await workspace.getByLabel('本次总点数上限').blur()
  await expect(workspace.getByRole('button', { name: '建立任务并审阅' })).toBeDisabled()
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  await expect.poll(() => workspace.evaluate(element => new DOMMatrix(getComputedStyle(element.closest('.ion-page')!).transform).m41)).toBe(0)
  await expect(page.locator('ion-toast')).toHaveCount(0)
  await workspace.evaluate(async element => (element.closest('ion-content') as HTMLElement & { scrollToTop: (duration: number) => Promise<void> }).scrollToTop(0))
  await page.screenshot({ path: info.outputPath('creative-team-desktop.png'), fullPage: true, animations: 'disabled' })
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    await workspace.evaluate(async element => (element.closest('ion-content') as HTMLElement & { scrollToTop: (duration: number) => Promise<void> }).scrollToTop(0))
    // Ionic's page transition may still be running after the route and text are ready.
    await expect.poll(async () => {
      const bounds = await workspace.boundingBox()
      return bounds!.x + bounds!.width
    }).toBeLessThanOrEqual(width + 1)
    expect((await workspace.boundingBox())!.x).toBeGreaterThanOrEqual(0)
    await page.screenshot({ path: info.outputPath(`creative-team-${width}.png`), fullPage: true, animations: 'disabled' })
  }

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/tabs/workspace/characters')
  await page.locator('.cc').first().click()
  const editor = page.locator('ion-modal.show-modal').last()
  const name = editor.getByRole('textbox', { name: '角色名', exact: true })
  await name.fill('未保存的创作草稿')
  await editor.getByRole('button', { name: '创作伙伴', exact: true }).click()
  const team = page.locator('ion-modal.show-modal').last()
  await expect(team.locator('.team-workspace')).toContainText('编辑器中未保存的内容不会发送')
  await team.getByRole('button', { name: '返回编辑', exact: true }).click()
  await expect(name).toHaveValue('未保存的创作草稿')
  await expect(editor).toBeVisible()
  await editor.getByRole('button', { name: '创作伙伴', exact: true }).click()
  await team.getByRole('link', { name: '打开文件编辑器', exact: true }).click()
  await expect(page).toHaveURL(/\/editor$/)
  await expect(page.locator('ion-modal.show-modal')).toHaveCount(0)
  expect(await page.evaluate(() => Object.entries(localStorage).some(([key, value]) => key.startsWith('advjs-studio-draft-') && value.includes('未保存的创作草稿')))).toBe(true)
  expect(paidRequests).toEqual([])
  expect(errors).toEqual([])
  await writeFile(info.outputPath('browser-checks.json'), JSON.stringify({ url: page.url(), title: await page.title(), widths: [1280, 390, 320], errors, warnings, paidRequests, scope: 'real product entry; local project; no managed service execution' }, null, 2))
})
