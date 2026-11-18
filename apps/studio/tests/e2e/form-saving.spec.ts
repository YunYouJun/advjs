import type { Page } from '@playwright/test'
import { createHash, randomUUID } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

const states = new WeakMap<Page, { id: string, errors: string[], warnings: string[], failedRequests: { url: string, error?: string }[] }>()
const originalImage = resolve(import.meta.dirname, '../../../../demo/love/public/img/characters/yun-alpha-compressed.webp')
const importedImage = resolve(import.meta.dirname, '../../../../demo/love/public/img/characters/yun-good-alpha-compressed.webp')
test.beforeEach(async ({ page }) => {
  const state = { id: randomUUID(), errors: [] as string[], warnings: [] as string[], failedRequests: [] as { url: string, error?: string }[] }
  states.set(page, state)
  page.on('pageerror', error => state.errors.push(error.message))
  page.on('requestfailed', request => state.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }))
  page.on('console', (message) => {
    if (message.type() === 'error')
      state.errors.push(message.text())
    if (message.type() === 'warning')
      state.warnings.push(message.text())
  })
  await page.goto(`/tests/fixtures/creative-team/form-saving.html?id=${state.id}`)
  await expect(page).toHaveTitle('Structured form saving fixture')
  await page.waitForFunction(() => Boolean((window as any).formSavingFixture))
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
})
test.afterEach(async ({ page }, info) => {
  const cleanup = await page.evaluate(() => (window as any).formSavingFixture.cleanup())
  const { errors, warnings, failedRequests } = states.get(page)!
  await writeFile(info.outputPath('cleanup.json'), JSON.stringify(cleanup))
  await writeFile(info.outputPath('browser-console.json'), JSON.stringify({ errors, warnings, failedRequests }))
  expect(cleanup.removed).toBe(true)
  expect(errors).toEqual([])
  expect(warnings).toEqual([])
})
const modal = (page: Page) => page.locator('ion-modal.show-modal').last()
const name = (page: Page) => modal(page).getByRole('textbox', { name: '角色名', exact: true })
const save = (page: Page) => modal(page).getByRole('button', { name: '保存', exact: true })
const saved = (page: Page) => page.evaluate(() => (window as any).formSavingFixture.saved())
async function openCharacter(page: Page) {
  await page.getByRole('button', { name: /林舟/ }).first().click()
  await expect(name(page)).toHaveValue('林舟')
}
async function dismissToasts(page: Page) {
  await page.locator('ion-toast').evaluateAll(elements => Promise.all(elements.map(element => (element as any).dismiss())))
}

test('opens the real Markdown editor only after explicitly switching from the form', async ({ page }, info) => {
  const monacoRequests: string[] = []
  page.on('request', (request) => {
    if (/monaco-editor(?:\.js|\/esm\/vs\/editor\/contrib\/)/.test(request.url()))
      monacoRequests.push(request.url())
  })
  await openCharacter(page)
  expect(monacoRequests).toEqual([])
  await expect(modal(page).locator('.monaco-editor')).toHaveCount(0)
  await modal(page).locator('ion-segment-button').filter({ hasText: 'Markdown' }).click()
  await expect(modal(page).locator('.monaco-editor').first()).toBeVisible()
  await expect.poll(() => monacoRequests.length).toBeGreaterThan(0)
  await writeFile(info.outputPath('form-saving-evidence.json'), JSON.stringify({ monacoRequests }, null, 2))
})

test('a stale character form cannot overwrite a newer author character', async ({ page }, info) => {
  await openCharacter(page)
  await name(page).fill('旧表单草稿')
  await page.evaluate(() => (window as any).formSavingFixture.authorEdit())
  await save(page).click()
  await expect(page.locator('ion-toast')).toContainText('草稿仍保留')
  await page.screenshot({ path: info.outputPath('form-conflict-normal.png') })
  await page.waitForTimeout(750)
  const content = await saved(page)
  await writeFile(info.outputPath('form-saving-evidence.json'), JSON.stringify({ content }, null, 2))
  expect(content).toContain('name: 新作者的人物')
  expect(content).toContain('新作者的性格')
  await expect(modal(page)).toBeVisible()
  await expect(name(page)).toHaveValue('旧表单草稿')
  await page.setViewportSize({ width: 390, height: 844 })
  await dismissToasts(page)
  await save(page).click()
  await expect(page.locator('ion-toast')).toContainText('草稿仍保留')
  await page.screenshot({ path: info.outputPath('form-conflict-narrow.png') })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('reopening a persisted old form draft never rebases it onto a later author file', async ({ page }, info) => {
  await openCharacter(page)
  await name(page).fill('需保留的旧草稿')
  await page.evaluate(() => (window as any).formSavingFixture.authorEdit())
  await modal(page).evaluate((element) => {
    (window as any).formModalDidDismiss = (element as any).onDidDismiss()
  })
  await modal(page).getByRole('button', { name: '取消', exact: true }).click()
  await page.evaluate(() => (window as any).formModalDidDismiss)
  await expect(page.locator('ion-modal.show-modal')).toHaveCount(0)
  await page.reload()
  await page.waitForFunction(() => Boolean((window as any).formSavingFixture))
  await page.getByRole('button', { name: '恢复', exact: true }).click()
  await expect(name(page)).toHaveValue('需保留的旧草稿')
  await save(page).click()
  await expect(page.locator('ion-toast')).toContainText('草稿仍保留')
  const content = await saved(page)
  expect(content).toContain('name: 新作者的人物')
  await writeFile(info.outputPath('form-saving-evidence.json'), JSON.stringify({ content, draft: await name(page).inputValue() }, null, 2))
})

test('opening an out-of-date card reads the actual current author source', async ({ page }, info) => {
  await page.evaluate(() => (window as any).formSavingFixture.authorEdit())
  await page.getByRole('button', { name: /林舟/ }).first().click()
  await expect(name(page)).toHaveValue('新作者的人物')
  await name(page).fill('作者在新版本上的修改')
  await save(page).click()
  await expect(page.locator('ion-modal.show-modal')).toHaveCount(0)
  const content = await saved(page)
  expect(content).toContain('name: 作者在新版本上的修改')
  expect(content).toContain('opaque: preserve-me')
  expect(content).toContain('Unmanaged author preamble')
  expect(content).toContain('新作者的性格')
  await writeFile(info.outputPath('form-saving-evidence.json'), JSON.stringify({ content }, null, 2))
})

test('saving an earlier form version keeps later typing open for a second explicit save', async ({ page }, info) => {
  await openCharacter(page)
  await name(page).fill('本次提交的名字')
  await page.evaluate(() => (window as any).formSavingFixture.holdWrite(false))
  await save(page).click()
  await expect.poll(() => page.evaluate(() => (window as any).formSavingFixture.state().phase)).toBe('waiting')
  expect(await saved(page)).toContain('name: 林舟')
  await name(page).fill('之后继续输入的名字')
  await page.evaluate(() => (window as any).formSavingFixture.release())
  await expect(page.locator('ion-toast')).toContainText('之后的新修改仍留在表单中')
  await expect(modal(page)).toBeVisible()
  const first = await saved(page)
  expect(first).toContain('name: 本次提交的名字')
  await expect(name(page)).toHaveValue('之后继续输入的名字')
  await dismissToasts(page)
  await save(page).click()
  await expect(page.locator('ion-modal.show-modal')).toHaveCount(0)
  const final = await saved(page)
  expect(final).toContain('name: 之后继续输入的名字')
  await writeFile(info.outputPath('form-saving-evidence.json'), JSON.stringify({ first, final }, null, 2))
})

for (const fail of [true, false]) {
  test(`real inline images share the form transaction when write failure is ${fail}`, async ({ page }, info) => {
    await page.locator('#original-image').setInputFiles(originalImage)
    await page.evaluate(() => (window as any).formSavingFixture.seedMaster())
    const before = await saved(page)
    const mediaBefore = await page.evaluate(() => (window as any).formSavingFixture.media())
    await openCharacter(page)
    await modal(page).locator('input[type="file"]').first().setInputFiles(importedImage)
    await expect(modal(page).locator('.cef-avatar__img')).toHaveAttribute('src', /^data:image/)
    await page.evaluate(fail => (window as any).formSavingFixture.holdWrite(fail), fail)
    await save(page).click()
    await expect.poll(() => page.evaluate(() => (window as any).formSavingFixture.state().phase)).toBe('waiting')
    await page.waitForTimeout(750)
    expect(await saved(page)).toBe(before)
    expect(await page.evaluate(() => (window as any).formSavingFixture.media())).toEqual(mediaBefore)
    await page.evaluate(() => (window as any).formSavingFixture.release())
    await expect(page.locator('ion-toast')).toContainText(fail ? '保存失败' : '保存成功')
    const content = await saved(page)
    const media = await page.evaluate(() => (window as any).formSavingFixture.media())
    const originalSha = createHash('sha256').update(await readFile(originalImage)).digest('hex')
    const importedSha = createHash('sha256').update(await readFile(importedImage)).digest('hex')
    expect(originalSha).not.toBe(importedSha)
    expect(media.find((item: any) => item.path.endsWith('/avatar.webp')).sha256).toBe(originalSha)
    if (fail) {
      expect(content).toBe(before)
      expect(media).toEqual(mediaBefore)
      await expect(modal(page)).toBeVisible()
    }
    else {
      expect(content).toContain(`avatar.${importedSha}.webp`)
      expect(media).toHaveLength(2)
      expect(media.find((item: any) => item.path.includes(importedSha)).sha256).toBe(importedSha)
      await expect(page.locator('ion-modal.show-modal')).toHaveCount(0)
    }
    await writeFile(info.outputPath('form-saving-evidence.json'), JSON.stringify({ fail, before, content, mediaBefore, media, originalSha, importedSha }, null, 2))
  })
}

for (const kind of ['scene', 'location'] as const) {
  test(`a stale ${kind} form preserves the later exact source`, async ({ page }, info) => {
    await page.evaluate(kind => (window as any).formSavingFixture.navigate(kind), kind)
    const path = kind === 'scene' ? 'adv/scenes/platform.md' : 'adv/locations/station.md'
    const before = await page.evaluate(path => (window as any).formSavingFixture.saved(path), path)
    if (kind === 'scene')
      await page.getByText('站台', { exact: true }).click()
    else
      await page.getByRole('button', { name: '编辑地点', exact: true }).click()
    const field = modal(page).getByRole('textbox', { name: kind === 'scene' ? '场景名' : '地点名称', exact: true })
    await field.fill('旧表单改稿')
    const newer = before.replace(kind === 'scene' ? 'name: 站台' : 'name: 雨夜车站', 'name: Later author source')
    await page.evaluate(({ path, newer }) => (window as any).formSavingFixture.authorEditFile(path, newer), { path, newer })
    await save(page).click()
    await expect(page.locator('ion-toast')).toContainText('草稿仍保留')
    expect(await page.evaluate(path => (window as any).formSavingFixture.saved(path), path)).toBe(newer)
    await expect(field).toHaveValue('旧表单改稿')
    await writeFile(info.outputPath('form-saving-evidence.json'), JSON.stringify({ kind, before, newer }, null, 2))
  })
}

test('an old-project form keeps its draft private and cannot write the new project', async ({ page }, info) => {
  await openCharacter(page)
  await name(page).fill('旧项目草稿')
  await page.evaluate(() => (window as any).formSavingFixture.switchProject())
  await save(page).click()
  await expect(page.locator('ion-toast')).toContainText('草稿仍保留')
  const id = states.get(page)!.id
  const evidence = await page.evaluate(async (id) => {
    const f = (window as any).formSavingFixture
    return { original: await f.saved(f.path, id), other: await f.saved(f.path, `${id}-other`), oldDraft: localStorage.getItem(`advjs-studio-draft-${id}-character`), newDraft: localStorage.getItem(`advjs-studio-draft-${id}-other-character`) }
  }, id)
  expect(evidence.original).toBe(evidence.other)
  expect(evidence.original).toContain('name: 林舟')
  expect(evidence.oldDraft).toContain('旧项目草稿')
  expect(evidence.newDraft).toBeNull()
  await expect(name(page)).toHaveValue('旧项目草稿')
  await writeFile(info.outputPath('form-saving-evidence.json'), JSON.stringify(evidence, null, 2))
})

const rawCharacter = `---
id: lin
name: 林舟
opaque: authored-in-markdown
---
作者在原文里补充的前言

## 性格
谨慎

## 作者备注
尚未公开的身世
`
// Desktop Chrome's device profile uses a Windows UA even on this macOS host.
// Follow Monaco's browser platform, rather than Playwright's host shortcut alias.
async function monacoKey(page: Page, key: string) {
  return `${await page.evaluate(() => navigator.userAgent.includes('Macintosh')) ? 'Meta' : 'Control'}+${key}`
}
async function editMarkdown(page: Page, text: string) {
  await modal(page).locator('ion-segment-button').filter({ hasText: 'Markdown' }).click()
  const input = modal(page).getByRole('textbox', { name: 'Editor content', exact: true })
  await expect(input).toBeVisible()
  await modal(page).locator('.monaco-editor').first().click()
  await expect(input).toBeFocused()
  await input.press(await monacoKey(page, 'a'))
  // Chromium's native EditContext updates on render, after the key event returns.
  await expect.poll(() => input.evaluate((element) => {
    const context = (element as HTMLElement & { editContext?: { text: string, selectionStart: number, selectionEnd: number } }).editContext
    return !context || (context.selectionStart === 0 && context.selectionEnd === context.text.length)
  })).toBe(true)
  await input.press('Backspace')
  await expect.poll(async () => (await modal(page).locator('.view-lines').first().textContent())?.trim()).toBe('')
  await page.keyboard.insertText(text)
}

test('Markdown preserves authored unknown metadata and body through form round trips', async ({ page }, info) => {
  await openCharacter(page)
  await editMarkdown(page, rawCharacter)
  await modal(page).locator('ion-segment-button').filter({ hasText: '表单' }).click()
  await name(page).fill('原文之后的表单修改')
  await modal(page).locator('ion-segment-button').filter({ hasText: 'Markdown' }).click()
  await save(page).click()
  await expect(page.locator('ion-modal.show-modal')).toHaveCount(0)
  const content = await saved(page)
  await writeFile(info.outputPath('markdown-evidence.json'), JSON.stringify({ content }, null, 2))
  expect(content).toContain('opaque: authored-in-markdown')
  expect(content).toContain('作者在原文里补充的前言')
  expect(content).toContain('尚未公开的身世')
  expect(content).toContain('name: 原文之后的表单修改')
})

test('Markdown close and reload restores the exact unparsed private draft', async ({ page }, info) => {
  await openCharacter(page)
  const raw = rawCharacter.replace('opaque: authored-in-markdown', 'opaque: [未完成的 YAML')
  await editMarkdown(page, raw)
  await modal(page).evaluate((element) => {
    (window as any).formModalDidDismiss = (element as any).onDidDismiss()
  })
  await modal(page).getByRole('button', { name: '取消', exact: true }).click()
  await page.evaluate(() => (window as any).formModalDidDismiss)
  await page.reload()
  await page.waitForFunction(() => Boolean((window as any).formSavingFixture))
  const draft = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(key => key.endsWith('-character') && key.startsWith('advjs-studio-draft-'))
    return key ? JSON.parse(localStorage.getItem(key)!) : null
  })
  await writeFile(info.outputPath('markdown-evidence.json'), JSON.stringify({ raw, draft }, null, 2))
  expect(draft.markdown).toBe(raw)
  await page.getByRole('button', { name: '恢复', exact: true }).click()
  await expect(modal(page).getByRole('alert')).toContainText('Markdown')
  await expect(save(page)).toBeDisabled()
  expect(await saved(page)).not.toContain('尚未公开的身世')
})

test('Markdown syntax errors cannot silently save the previous valid form', async ({ page }, info) => {
  await openCharacter(page)
  const before = await saved(page)
  await editMarkdown(page, rawCharacter.replace('opaque: authored-in-markdown', 'opaque: [未完成的 YAML'))
  // Keyboard Save must obey the same validation as the visible button.
  await page.keyboard.press(await monacoKey(page, 's'))
  await expect(modal(page).getByRole('alert')).toContainText('Markdown')
  await expect(save(page)).toBeDisabled()
  await page.screenshot({ path: info.outputPath('markdown-error-normal.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: info.outputPath('markdown-error-narrow.png') })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const content = await saved(page)
  await writeFile(info.outputPath('markdown-evidence.json'), JSON.stringify({ before, content }, null, 2))
  expect(content).toBe(before)
  await expect(modal(page)).toBeVisible()
  await modal(page).locator('ion-segment-button').filter({ hasText: '表单' }).click()
  await expect(modal(page).locator('.cem-panel--form')).toHaveAttribute('inert', '')
  await editMarkdown(page, rawCharacter)
  await expect(modal(page).getByRole('alert')).toHaveCount(0)
  await expect(save(page)).toBeEnabled()
  await save(page).click()
  await expect(page.locator('ion-modal.show-modal')).toHaveCount(0)
  expect(await saved(page)).toBe(rawCharacter)
})

test('Markdown-only edits during a pending save remain open for explicit adoption', async ({ page }, info) => {
  await openCharacter(page)
  await editMarkdown(page, rawCharacter)
  await page.evaluate(() => (window as any).formSavingFixture.holdWrite(false))
  await save(page).click()
  await expect.poll(() => page.evaluate(() => (window as any).formSavingFixture.state().phase)).toBe('waiting')
  const later = rawCharacter.replace('尚未公开的身世', '保存期间又补充的作者原文')
  await editMarkdown(page, later)
  await page.evaluate(() => (window as any).formSavingFixture.release())
  await expect(page.locator('ion-toast')).toContainText('之后的新修改仍留在表单中')
  const first = await saved(page)
  expect(first).toBe(rawCharacter)
  await expect(modal(page)).toBeVisible()
  await dismissToasts(page)
  await save(page).click()
  await expect(page.locator('ion-modal.show-modal')).toHaveCount(0)
  const final = await saved(page)
  expect(final).toBe(later)
  await writeFile(info.outputPath('markdown-evidence.json'), JSON.stringify({ first, final }, null, 2))
})

for (const kind of ['scene', 'location', 'locations'] as const) {
  test(`Markdown saves exact author text through the actual ${kind} page`, async ({ page }, info) => {
    await page.evaluate(kind => (window as any).formSavingFixture.navigate(kind), kind)
    if (kind === 'scene')
      await page.getByText('站台', { exact: true }).click()
    else if (kind === 'location')
      await page.getByRole('button', { name: '编辑地点', exact: true }).click()
    else
      await page.locator('ion-fab-button').click()
    const id = kind === 'scene' ? 'platform' : kind === 'location' ? 'station' : 'new-platform'
    const path = `adv/${kind === 'scene' ? 'scenes' : 'locations'}/${id}.md`
    const raw = `---\nid: ${id}\nname: 原文中的新名称\nopaque: author-${kind}\n---\n原文新增的完整正文，不经表单截断。\n`
    await editMarkdown(page, raw)
    await save(page).click()
    await expect(page.locator('ion-modal.show-modal')).toHaveCount(0)
    const content = await page.evaluate(path => (window as any).formSavingFixture.saved(path), path)
    expect(content).toBe(raw)
    await writeFile(info.outputPath('markdown-evidence.json'), JSON.stringify({ kind, path, content }, null, 2))
  })
}

test('Markdown chapter metadata and script survive later structured title changes', async ({ page }, info) => {
  await page.evaluate(() => (window as any).formSavingFixture.navigate('chapter'))
  await page.locator('ion-fab-button').click()
  await modal(page).getByRole('textbox', { name: '文件名', exact: true }).fill('rain-extra')
  const raw = '---\ntitle: 原文标题\nplotSummary: 原文提纲\nopaque: keep-chapter\n---\n林舟：「原文里的对白。」\n'
  await editMarkdown(page, raw)
  await modal(page).locator('ion-segment-button').filter({ hasText: '表单' }).click()
  await expect(modal(page).getByRole('textbox', { name: '章节标题', exact: true })).toHaveValue('原文标题')
  await modal(page).getByRole('textbox', { name: '章节标题', exact: true }).fill('表单修订标题')
  await modal(page).locator('ion-segment-button').filter({ hasText: 'Markdown' }).click()
  await save(page).click()
  await expect(page.locator('ion-modal.show-modal')).toHaveCount(0)
  const content = await page.evaluate(() => (window as any).formSavingFixture.saved('adv/chapters/rain-extra.adv.md'))
  expect(content).toContain('title: 表单修订标题')
  expect(content).toContain('plotSummary: 原文提纲')
  expect(content).toContain('opaque: keep-chapter')
  expect(content).toContain('林舟：「原文里的对白。」')
  await writeFile(info.outputPath('markdown-evidence.json'), JSON.stringify({ content }, null, 2))
})

test('Markdown ID changes retain keyboard focus and undo history for continued writing', async ({ page }, info) => {
  await openCharacter(page)
  const raw = rawCharacter.replace('id: lin', 'id: lin-new')
  await editMarkdown(page, raw)
  await expect(modal(page).locator('.file-preview__filename')).toHaveText('lin-new.character.md')
  await expect(modal(page).getByRole('textbox', { name: 'Editor content', exact: true })).toBeFocused()
  await page.keyboard.insertText('继续写作的末句')
  await page.keyboard.press(await monacoKey(page, 'z'))
  await expect(modal(page).locator('.view-lines')).not.toContainText('继续写作的末句')
  await page.keyboard.insertText('保留焦点后继续写作')
  await save(page).click()
  await expect(page.locator('ion-modal.show-modal')).toHaveCount(0)
  const content = await page.evaluate(() => (window as any).formSavingFixture.saved('adv/characters/lin-new.character.md'))
  expect(content).toContain('保留焦点后继续写作')
  expect(content).toContain('opaque: authored-in-markdown')
  const original = await saved(page)
  expect(original).toContain('id: lin\n')
  expect(original).not.toContain('尚未公开的身世')
  await writeFile(info.outputPath('markdown-evidence.json'), JSON.stringify({ content, original }, null, 2))
})
