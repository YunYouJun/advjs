import type { Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

const runs = new WeakMap<Page, { id: string, errors: string[], warnings: string[] }>()
test.beforeEach(async ({ page }) => {
  const state = { id: randomUUID(), errors: [] as string[], warnings: [] as string[] }
  runs.set(page, state)
  page.on('pageerror', error => state.errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error')
      state.errors.push(message.text())
    if (message.type() === 'warning')
      state.warnings.push(message.text())
  })
  await page.goto(`/tests/fixtures/creative-team/text-editing.html?id=${state.id}`)
  await expect(page).toHaveTitle('Text editing persistence fixture')
  await page.waitForFunction(() => Boolean((window as any).textEditingFixture))
  await expect(page.locator('textarea.editor-textarea')).toHaveValue('# Original author world')
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
})
test.afterEach(async ({ page }, info) => {
  const cleanup = await page.evaluate(() => (window as any).textEditingFixture.cleanup())
  const { errors, warnings } = runs.get(page)!
  await writeFile(info.outputPath('cleanup.json'), JSON.stringify(cleanup))
  await writeFile(info.outputPath('browser-console.json'), JSON.stringify({ errors, warnings }))
  expect(cleanup.removed).toBe(true)
  expect(errors).toEqual([])
  expect(warnings).toEqual([])
})

const editor = (page: Page) => page.locator('textarea.editor-textarea')
const save = (page: Page) => page.getByRole('button', { name: '保存', exact: true })
const saved = (page: Page) => page.evaluate(() => (window as any).textEditingFixture.saved())
function deleteSource(page: Page) {
  return page.evaluate(() => {
    const f = (window as any).textEditingFixture
    return f.saved(undefined, f.deletedPath)
  })
}

test('an old open editor cannot overwrite a later saved author world', async ({ page }, info) => {
  await editor(page).fill('# Local draft still belongs to the author')
  await page.evaluate(() => (window as any).textEditingFixture.authorEdit('adv/world.md', '# Later saved author world'))
  await save(page).click()
  await expect(page.locator('ion-toast')).toContainText('草稿仍保留')
  await page.screenshot({ path: info.outputPath('editor-conflict-normal.png') })
  // Cross the old editor's actual 500 ms persistence timer too.
  await page.waitForTimeout(750)
  const evidence = { saved: await saved(page), draft: await editor(page).inputValue() }
  await writeFile(info.outputPath('text-editing-evidence.json'), JSON.stringify(evidence, null, 2))
  expect(evidence.saved).toBe('# Later saved author world')
  expect(evidence.draft).toBe('# Local draft still belongs to the author')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('ion-toast').evaluateAll(elements => Promise.all(elements.map(element => (element as any).dismiss())))
  await save(page).click()
  await expect(page.locator('ion-toast')).toContainText('草稿仍保留')
  await page.screenshot({ path: info.outputPath('editor-conflict-narrow.png') })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('a stale editor cannot save its old draft into a newly selected project', async ({ page }, info) => {
  await editor(page).fill('# Draft from the original project')
  await page.evaluate(() => (window as any).textEditingFixture.switchProject())
  await save(page).click()
  await expect(page.locator('ion-toast')).toContainText('草稿仍保留')
  const id = runs.get(page)!.id
  const files = await page.evaluate(async id => ({
    original: await (window as any).textEditingFixture.saved(id),
    other: await (window as any).textEditingFixture.saved(`${id}-other`),
  }), id)
  await writeFile(info.outputPath('text-editing-evidence.json'), JSON.stringify(files, null, 2))
  expect(files).toEqual({ original: '# Original author world', other: '# Original author world' })
  await expect(editor(page)).toHaveValue('# Draft from the original project')
})

for (const fail of [false, true]) {
  test(`text saving waits for real durable commit and retains drafts when failure is ${fail}`, async ({ page }, info) => {
    await editor(page).fill('# First author save')
    await page.evaluate(fail => (window as any).textEditingFixture.holdCommit(fail), fail)
    await save(page).click()
    await expect.poll(() => page.evaluate(() => (window as any).textEditingFixture.state().phase)).toBe('waiting')
    await expect(page.getByRole('button', { name: '保存中...', exact: true })).toBeDisabled()
    expect(await saved(page)).toBe('# Original author world')
    await editor(page).fill('# Newer unsaved author draft')
    await page.evaluate(() => (window as any).textEditingFixture.release())
    await expect(save(page)).toBeEnabled()
    await expect(page.locator('ion-toast')).toContainText(fail ? '保存失败' : '已保存')
    const afterFirst = await saved(page)
    expect(afterFirst).toBe(fail ? '# Original author world' : '# First author save')
    await expect(editor(page)).toHaveValue('# Newer unsaved author draft')
    await page.locator('ion-toast').evaluateAll(elements => Promise.all(elements.map(element => (element as any).dismiss())))
    await save(page).click()
    await expect(page.locator('ion-toast')).toContainText('已保存')
    expect(await saved(page)).toBe('# Newer unsaved author draft')
    await writeFile(info.outputPath('text-editing-evidence.json'), JSON.stringify({ fail, afterFirst, final: await saved(page) }, null, 2))
  })
}

test('a deletion confirmed after switching projects cannot delete the new project file', async ({ page }, info) => {
  await page.getByTestId('delete-file').click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await page.evaluate(() => (window as any).textEditingFixture.switchProject())
  await page.getByRole('button', { name: '删除', exact: true }).click()
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await expect(page.locator('ion-toast')).toContainText('操作已停止')
  const id = runs.get(page)!.id
  const files = await page.evaluate(async (id) => {
    const f = (window as any).textEditingFixture
    return { original: await f.saved(id, f.deletedPath), other: await f.saved(`${id}-other`, f.deletedPath) }
  }, id)
  await writeFile(info.outputPath('text-editing-evidence.json'), JSON.stringify(files, null, 2))
  expect(files.original).toContain('Original character')
  expect(files.other).toContain('Original character')
})

test('a deletion dialog preserves a later author edit to its source', async ({ page }, info) => {
  await page.getByTestId('delete-file').click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await page.evaluate(() => {
    const f = (window as any).textEditingFixture
    return f.authorEdit(f.deletedPath, 'New author character while confirming')
  })
  await page.getByRole('button', { name: '删除', exact: true }).click()
  await expect(page.locator('ion-toast')).toContainText('操作已停止')
  const content = await deleteSource(page)
  expect(content).toBe('New author character while confirming')
  await writeFile(info.outputPath('text-editing-evidence.json'), JSON.stringify({ content }, null, 2))
})

test('dismisses deletion with Escape and deletes only after an explicit unchanged confirmation', async ({ page }, info) => {
  await page.getByTestId('delete-file').click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  expect(await deleteSource(page)).toContain('Original character')
  await page.getByTestId('delete-file').click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await page.getByRole('button', { name: '删除', exact: true }).click()
  await expect(page.locator('ion-toast')).toContainText('删除成功')
  const content = await deleteSource(page)
  expect(content).toBeNull()
  await writeFile(info.outputPath('text-editing-evidence.json'), JSON.stringify({ content }, null, 2))
})
