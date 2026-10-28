import { writeFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

test.afterEach(async ({ page, context, browserName }, info) => {
  const focus = () => page.evaluate(() => {
    const chain: unknown[] = []
    let active = document.activeElement as HTMLElement | null
    while (active) {
      chain.push({ tag: active.tagName, id: active.id, text: active.textContent?.trim().slice(0, 100), name: active.getAttribute('aria-label') })
      active = active.shadowRoot?.activeElement as HTMLElement | null
    }
    return { chain, modals: [...document.querySelectorAll('ion-modal')].map(element => ({ shown: element.classList.contains('show-modal'), title: element.querySelector('ion-title')?.textContent?.trim() })) }
  })
  const observed = await focus().catch(() => ({ unavailable: true }))
  let keyboardProbe: unknown
  if (browserName === 'webkit' && info.status !== info.expectedStatus) {
    const probe = await context.newPage()
    await probe.setContent('<button id="a">First</button><button id="b">Second</button><input id="text">')
    const active = () => probe.evaluate(() => document.activeElement?.id)
    await probe.locator('#a').focus()
    await probe.keyboard.press('Tab')
    const tab = await active()
    await probe.locator('#a').focus()
    await probe.keyboard.press('Alt+Tab')
    keyboardProbe = { tab, altTab: await active() }
    await probe.close()
  }
  await writeFile(info.outputPath('focus-lifecycle-diagnostic.json'), JSON.stringify({ observed, keyboardProbe }, null, 2))
})

test('names the real nested creative dialog and preserves keyboard focus and the editor draft', async ({ page, browserName }, info) => {
  const errors: string[] = []
  const warnings: string[] = []
  const mutations: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error')
      errors.push(message.text())
    if (message.type() === 'warning')
      warnings.push(message.text())
  })
  await page.route('**/ai/v2/apps/advjs-studio-web/creative-team/**', (route) => {
    if (route.request().method() === 'POST')
      mutations.push(route.request().url())
    return route.abort()
  })
  await page.goto('/tabs/workspace')
  await page.getByText('立即体验', { exact: true }).first().click()
  await expect(page).toHaveURL(/\/tabs\/world$/)
  await page.goto('/tabs/workspace/characters')
  await expect(page).toHaveTitle(/ADV.JS Studio/)
  await page.locator('.cc').first().click()
  const editor = page.locator('ion-modal.show-modal').last()
  const name = editor.getByRole('textbox', { name: '角色名', exact: true })
  await name.fill('使用键盘编辑、尚未保存的人物草稿')
  await page.evaluate(() => {
    (window as any).creativeDialogPresentations = 0
    document.addEventListener('ionModalDidPresent', (event) => {
      const target = event.target as HTMLElement
      if (target.querySelector('ion-title')?.textContent?.trim() === '创作伙伴')
        (window as any).creativeDialogPresentations++
    }, { capture: true })
  })
  const opener = editor.getByRole('button', { name: '创作伙伴', exact: true })
  await opener.focus()
  await opener.press('Enter')
  const dialog = page.getByRole('dialog', { name: '创作伙伴', exact: true })
  const modal = page.locator('ion-modal.show-modal').last()
  await expect(dialog).toHaveCount(1)
  await expect(dialog).toBeVisible()
  await expect.poll(() => page.evaluate(() => (window as any).creativeDialogPresentations)).toBe(1)
  await expect(dialog).toHaveAccessibleName('创作伙伴')
  await expect(modal.locator('ion-title')).toHaveText('创作伙伴')
  await expect(modal.locator('.team-workspace')).toContainText('登录后可查看制作组服务')
  const writer = modal.getByRole('button', { name: /^编剧/ })
  await writer.focus()
  await writer.press('Enter')
  await expect(writer).toHaveAttribute('aria-pressed', 'true')
  const buttonTab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab'
  await writer.press(buttonTab)
  await expect(modal.getByRole('button', { name: /^角色设计师/ })).toBeFocused()
  const goal = modal.getByRole('textbox', { name: '这次想完成什么？', exact: true })
  await goal.focus()
  await page.keyboard.insertText('保留人物的克制口吻，只润色雨夜车站的开场对白。'.repeat(4))
  await expect(goal).toHaveAccessibleDescription(/未保存的内容不会发送/)
  await goal.press('Tab')
  const budget = modal.getByRole('textbox', { name: '本次总点数上限', exact: true })
  await expect(budget).toBeFocused()
  await page.keyboard.insertText('20')
  await expect(budget).toHaveAccessibleDescription(/计划、后续任务和返工/)
  await expect(modal.getByRole('button', { name: '建立任务并审阅', exact: true })).toBeDisabled()
  const aria = await dialog.ariaSnapshot()
  const viewports: unknown[] = []
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(dialog).toBeVisible()
    const bounds = await modal.locator('.team-workspace').evaluate(element => ({ viewportWidth: innerWidth, x: element.getBoundingClientRect().x, width: element.getBoundingClientRect().width, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }))
    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1)
    expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.clientWidth + 1)
    viewports.push(bounds)
    await modal.locator('.team-workspace').evaluate(element => (element.closest('ion-content') as HTMLElement & { scrollToTop: (duration: number) => Promise<void> }).scrollToTop(0))
    await page.screenshot({ path: info.outputPath(`creative-dialog-${width}.png`), animations: 'disabled' })
  }
  const back = modal.getByRole('button', { name: '返回编辑', exact: true })
  await back.focus()
  await back.press('Enter')
  await expect(dialog).toHaveCount(0)
  await expect(name).toBeVisible()
  await expect(name).toHaveValue('使用键盘编辑、尚未保存的人物草稿')
  await expect(opener).toBeFocused()
  await opener.press('Enter')
  await expect(dialog).toBeVisible()
  await expect.poll(() => page.evaluate(() => (window as any).creativeDialogPresentations)).toBe(2)
  await modal.getByRole('button', { name: '返回编辑', exact: true }).focus()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(opener).toBeFocused()
  await expect(name).toBeVisible()
  await expect(name).toHaveValue('使用键盘编辑、尚未保存的人物草稿')
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  expect(errors).toEqual([])
  expect(warnings).toEqual([])
  expect(mutations).toEqual([])
  await writeFile(info.outputPath('keyboard-dialog-evidence.json'), JSON.stringify({ scope: 'Real local product entry, nested Ionic dialog, accessible names/descriptions and keyboard actions. No configured service, paid calls, model output or actual screen-reader speech certification.', browserPath: 'Playwright', browserFallbackReason: 'Browser plugin not available', url: page.url(), title: await page.title(), buttonTab, aria, viewports, errors, warnings, mutations }, null, 2))
})
