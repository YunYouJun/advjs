import { expect, test } from '@playwright/test'

test('diagnoses an unsaved broken link and inspects the repaired runtime trace', async ({ page }, testInfo) => {
  await page.goto('/tabs/workspace')
  const quickStart = page.getByRole('button', { name: /立即体验|Quick Start/ })
  await expect(quickStart).toBeVisible()
  await quickStart.click()
  await expect(page).toHaveURL(/\/tabs\/world/)

  const file = 'adv/chapters/01.adv.md'
  await page.goto(`/editor?file=${encodeURIComponent(file)}`)
  const textarea = page.locator('textarea.editor-textarea')
  await expect(textarea).toBeVisible()
  await expect(textarea).toHaveValue(/初秋的傍晚/, { timeout: 10000 })
  const original = await textarea.inputValue()
  expect(original).toContain('初秋的傍晚')
  const broken = `${original}\n\n- [断开的出口](missing#ending)`
  await textarea.fill(broken)

  await page.locator('[data-authoring-tab="diagnostics"]').click()
  const diagnostic = page.locator('[data-runtime-diagnostic]').filter({
    hasText: 'ADV_RUNTIME_UNKNOWN_TARGET',
  })
  await expect(diagnostic).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath('runtime-diagnostic.png'),
    fullPage: true,
  })

  await diagnostic.click()
  await expect(textarea).toBeFocused()
  const selectionStart = await textarea.evaluate(element => (element as HTMLTextAreaElement).selectionStart)
  expect(selectionStart).toBeGreaterThanOrEqual(original.length + 2)

  await textarea.fill(original)
  await expect(page.locator('[data-runtime-diagnostic]')).toHaveCount(0)
  await expect(page.getByText('没有运行时诊断').or(page.getByText('No runtime diagnostics'))).toBeVisible()

  await page.goto(`/tabs/play?file=${encodeURIComponent(file)}`)
  const runtimeButton = page.locator('.runtime-inspector-button')
  await expect(runtimeButton).toBeVisible({ timeout: 15000 })

  const narration = page.locator('.adv-black')
  await expect(narration).toBeVisible()
  await narration.click()
  await narration.click()

  await runtimeButton.click()
  const drawer = page.locator('.runtime-inspector-drawer')
  await expect(drawer).toBeVisible()
  await drawer.getByRole('tab', { name: 'Trace' }).click()
  await expect(drawer.locator('[data-trace-entry]').filter({ hasText: 'next' }).first()).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath('runtime-trace.png'),
    fullPage: true,
  })
})
