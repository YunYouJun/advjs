import type { Locator, Page, TestInfo } from '@playwright/test'
import type { EditorBridge } from 'advjs/node'
import { resolve } from 'node:path'
import { expect } from '@playwright/test'
import { createEditorBridge } from 'advjs/node'
import { parseCharacterMd } from '../../packages/parser/src/character'
import { test } from './fixtures/browser-workspace'

const directory = 'character-migration-browser-project'
const characterPath = 'adv/characters/rain.character.md'
const original = `---
id: rain
name: 雨 / Rain
custom:
  owner: author
  review: preserve-me
visual:
  version: v1
  references:
    - path: adv/assets/reference.svg
      description: 正面参考 / Front reference with a long descriptive label
  fixedTraits:
    - 蓝眼睛 / Blue eyes
  allowedChanges:
    - 姿势与照明 / Pose and lighting
avatars:
  thoughtful:
    src: adv/assets/portrait.svg
    label: 思考 / Thoughtful expression
imagePrompt: Soft daylight, blue eyes, preserve the author's prompt.
tags: [主角, protagonist]
---

作者序言 / Author introduction.

## 性格

安静而敏锐 / Quiet and observant.

## 额外线索

Do not remove this author-defined section.
`
const reference = '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120"><rect width="240" height="120" fill="#496b87"/><circle cx="120" cy="60" r="36" fill="#dfc7a1"/></svg>'
let bridge: EditorBridge
let editorUrl: string

test.beforeAll(async () => {
  bridge = await createEditorBridge({ host: '127.0.0.1', port: 0, projectRoot: resolve(import.meta.dirname, '../launch/fixtures/golden-project'), publicRoot: resolve(import.meta.dirname, '../../editor/core/dist') })
  // Only serve the packaged UI. These tests open real browser directories,
  // rather than selecting the Bridge's local project or mocking Vue stores.
  editorUrl = new URL((await bridge.start()).url).origin
})
test.afterAll(async () => await bridge?.stop())
test.beforeEach(async ({ browserName }) => {
  test.skip(browserName !== 'chromium', 'Real File System Access recovery targets Chromium')
  test.setTimeout(90_000)
})

async function writeProjectFile(page: Page, path: string, content: string) {
  await page.evaluate(async ({ directory, path, content }) => {
    let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(directory, { create: true })
    const parts = path.split('/')
    const name = parts.pop()!
    for (const part of parts)
      dir = await dir.getDirectoryHandle(part, { create: true })
    const writable = await (await dir.getFileHandle(name, { create: true })).createWritable()
    await writable.write(content)
    await writable.close()
  }, { directory, path, content })
}

async function readCharacter(page: Page) {
  return page.evaluate(async ({ directory, characterPath }) => {
    let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(directory)
    const parts = characterPath.split('/')
    const name = parts.pop()!
    for (const part of parts)
      dir = await dir.getDirectoryHandle(part)
    return (await (await dir.getFileHandle(name)).getFile()).text()
  }, { directory, characterPath })
}

async function openProject(page: Page, locale = 'en', theme = 'dark') {
  await page.setViewportSize({ width: 1600, height: 1000 })
  await page.addInitScript(({ directory, locale, theme }) => {
    localStorage.setItem('advjs:editor:onboarded', 'true')
    localStorage.setItem('advjs:editor:locale', locale)
    localStorage.setItem('nuxt-color-mode', theme)
    window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle(directory)
  }, { directory, locale, theme })
  await page.goto(editorUrl)
  await writeProjectFile(page, 'adv.config.json', '{"id":"character-migration","root":"adv"}')
  await writeProjectFile(page, 'adv/chapters/intro.adv.md', '# Intro\n\n雨: Hello.\n')
  await writeProjectFile(page, characterPath, original)
  await writeProjectFile(page, 'adv/assets/reference.svg', reference)
  await writeProjectFile(page, 'adv/assets/portrait.svg', reference)
  await page.getByRole('button', { name: locale === 'en' ? 'Open local project' : '打开本地项目', exact: true }).click()
  await expect(page.getByText(locale === 'en' ? 'Browser workspace' : '浏览器工作区', { exact: true })).toBeVisible()
  // Reload only after the real directory handle's IndexedDB transaction commits.
  await expect.poll(() => page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('advjs-editor-workspaces', 1)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      return await new Promise<boolean>((resolve, reject) => {
        const request = db.transaction('sessions').objectStore('sessions').get('browser')
        request.onsuccess = () => resolve(request.result?.projects[0]?.handle instanceof FileSystemDirectoryHandle)
        request.onerror = () => reject(request.error)
      })
    }
    finally { db.close() }
  })).toBe(true)
}

async function openCharacter(page: Page, locale = 'en') {
  const navigation = page.locator('[data-editor-region="navigation"]')
  await navigation.getByRole('textbox', { name: locale === 'en' ? 'Search project files' : '搜索项目文件', exact: true }).fill('rain.character.md')
  const file = navigation.getByRole('treeitem', { name: 'rain.character.md', exact: true })
  await file.focus()
  await file.press('Enter')
  await expect(page.locator('[data-editor-region="main"] .monaco-editor')).toBeVisible()
  await expect(page.locator('[data-editor-region="inspector"] .character-detail')).toBeVisible()
}

async function screenshot(locator: Locator, info: TestInfo, name: string) {
  const path = info.outputPath(`${name}.png`)
  await locator.screenshot({ path, animations: 'disabled' })
  await info.attach(name, { path, contentType: 'image/png' })
}

async function resizeRegion(region: Locator, width: number) {
  const pane = region.locator('xpath=ancestor::div[contains(@class, "splitpanes__pane")][1]')
  // Constrain the real docked panel, not a synthetic HTML/CSS rendering.
  await pane.evaluate((element, width) => Object.assign((element as HTMLElement).style, { width: `${width}px`, flex: `0 0 ${width}px` }), width)
  await expect.poll(async () => Math.round((await region.boundingBox())!.width)).toBe(width)
}

async function expectPreviews(root: Locator) {
  const visual = root.locator('.character-visual-panel')
  const avatars = root.locator('.character-avatar-panel')
  await expect(visual).toContainText('蓝眼睛 / Blue eyes')
  await expect(visual).toContainText('姿势与照明 / Pose and lighting')
  await expect(avatars).toContainText('thoughtful')
  for (const panel of [visual, avatars]) {
    await expect(panel.locator('img')).toBeVisible()
    await expect.poll(() => panel.locator('img').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(240)
    await expect(panel.locator('a')).toHaveAttribute('href', /^blob:/)
    expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  }
}

for (const locale of ['en', 'zh-CN']) {
  for (const theme of ['dark', 'light']) {
    test(`renders migrated character detail and reader [${locale}] [${theme}]`, async ({ page }, info) => {
      const errors: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      await openProject(page, locale, theme)
      await expect(page.locator('html')).toHaveClass(new RegExp(`editor-${theme}`))
      await openCharacter(page, locale)
      const inspector = page.locator('[data-editor-region="inspector"]')
      const detail = inspector.locator('.character-detail')
      const main = page.locator('[data-editor-region="main"]')
      const source = main.locator('.file-source')
      await resizeRegion(inspector, 480)
      await expectPreviews(detail)
      await screenshot(detail, info, 'character-detail-normal')
      await resizeRegion(inspector, 320)
      const summary = detail.locator('summary').filter({ hasText: locale === 'en' ? 'Visual identity' : '视觉设定' })
      // Native details must remain operable with a visible keyboard focus ring.
      await summary.focus()
      await expect(summary).toBeFocused()
      await summary.press('Enter')
      await expect(detail.locator('.character-visual-panel')).toBeHidden()
      await summary.press('Enter')
      await expectPreviews(detail)
      await expect(summary).toHaveCSS('outline-style', 'solid')
      await screenshot(detail, info, 'character-detail-narrow-focus')
      await source.getByRole('button', { name: locale === 'en' ? 'Reading' : '阅读', exact: true }).click()
      const reading = source.locator('.file-reading')
      await expectPreviews(reading)
      await screenshot(reading, info, 'character-reader-normal')
      // The reader scrolls independently; capture portraits below its first fold.
      await screenshot(reading.locator('.character-avatar-panel'), info, 'character-reader-avatars-normal')
      await reading.evaluate(element => element.scrollTop = 0)
      await resizeRegion(main, 320)
      await expectPreviews(reading)
      expect(await reading.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
      await screenshot(reading, info, 'character-reader-narrow')
      await screenshot(reading.locator('.character-avatar-panel'), info, 'character-reader-avatars-narrow')
      // The source fallback exposes all author fields; opening panels is read-only.
      const sourceButton = source.getByRole('button', { name: locale === 'en' ? 'Source' : '源码', exact: true })
      await sourceButton.focus()
      await sourceButton.press('Enter')
      await expect(source.locator('.monaco-editor')).toBeVisible()
      await expect(sourceButton).toHaveAttribute('aria-pressed', 'true')
      expect(await readCharacter(page)).toBe(original)
      expect(errors).toEqual([])
    })
  }
}

async function draftContent(page: Page) {
  // Read-only observation of the Monaco model, while all edits use its keyboard UI.
  return page.evaluate(() => {
    const root = document.getElementById('__nuxt') as HTMLElement & { __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, { fileContent: string }> } } } } }
    return root.__vue_app__.config.globalProperties.$pinia._s.get('@advjs/editor:monaco')!.fileContent
  })
}

async function appendDraft(page: Page, text: string) {
  await page.locator('[data-editor-region="main"] .monaco-editor').click()
  // Collapse a full-document selection at its end on both macOS and Linux.
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.insertText(text)
  await expect.poll(() => draftContent(page)).toContain(text)
}

async function persistedDraft(page: Page) {
  return page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('advjs:editor:documents:')).map(key => JSON.parse(localStorage.getItem(key)!)))
}

test('recovers real source edits after reload and resolves external conflicts without silent overwrite', async ({ page }, info) => {
  await openProject(page)
  await openCharacter(page)
  const source = page.locator('[data-editor-region="main"] .file-source')
  const local = `${original}\nLocal unsaved addition.\n`
  await appendDraft(page, '\nLocal unsaved addition.\n')
  await expect.poll(() => persistedDraft(page)).toEqual([expect.objectContaining({ source: { path: characterPath, base: original, content: local } })])
  expect(await readCharacter(page)).toBe(original)
  await page.reload()
  await expect(source.locator('.monaco-editor')).toBeVisible()
  await expect.poll(() => draftContent(page)).toBe(local)
  await expect(source.getByRole('button', { name: 'Save', exact: true })).toBeEnabled()
  await screenshot(source, info, 'source-draft-recovered')

  const external = `${original}\nExternal author addition.\n`
  await writeProjectFile(page, characterPath, external)
  await page.reload()
  await expect(source.locator('.file-conflict')).toContainText('changed outside the Editor')
  await expect.poll(() => draftContent(page)).toBe(local)
  await source.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(source.locator('.file-error')).toContainText('Resolve the external file conflict')
  expect(await readCharacter(page)).toBe(external)
  await screenshot(source, info, 'source-conflict-blocked-save')
  await source.getByRole('button', { name: 'Use external', exact: true }).click()
  await expect.poll(() => draftContent(page)).toBe(external)
  await expect(source.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()

  await appendDraft(page, '\nExplicitly retained local edit.\n')
  const retained = await draftContent(page)
  const newer = `${external}\nNew external revision.\n`
  await writeProjectFile(page, characterPath, newer)
  await page.reload()
  await expect(source.locator('.file-conflict')).toBeVisible()
  expect(await readCharacter(page)).toBe(newer)
  await source.getByRole('button', { name: 'Keep mine', exact: true }).click()
  await expect.poll(() => readCharacter(page)).toBe(retained)
  await expect(source.locator('.file-conflict')).toBeHidden()
  await expect(source.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
  await page.reload()
  // A full reload destroys Vue/Pinia before restoring the source editor.
  await expect(source.locator('.monaco-editor')).toBeVisible()
  await expect.poll(() => draftContent(page)).toBe(retained)
  await expect(source.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
  expect(retained).toContain('review: preserve-me')
  expect(retained).toContain('Do not remove this author-defined section.')
})

test('recovers character form edits and preserves visual, portrait, and custom author fields on explicit conflict save', async ({ page }, info) => {
  await openProject(page)
  await openCharacter(page)
  const inspector = page.locator('[data-editor-region="inspector"]')
  await inspector.getByRole('button', { name: 'Edit', exact: true }).click()
  const form = inspector.locator('.character-form')
  await form.getByRole('textbox', { name: 'Name', exact: true }).fill('Recovered 雨 / Rain')
  await expect.poll(() => persistedDraft(page)).toEqual([expect.objectContaining({ forms: { 'character:edit:rain': expect.objectContaining({ base: original, content: expect.stringContaining('Recovered 雨 / Rain') }) } })])
  expect(await readCharacter(page)).toBe(original)
  const external = original.replace('review: preserve-me', 'review: newer-author-review')
  await writeProjectFile(page, characterPath, external)
  await page.reload()
  await expect(page.getByText('Browser workspace', { exact: true })).toBeVisible()
  await openCharacter(page)
  await inspector.getByRole('button', { name: 'Edit', exact: true }).click()
  await form.getByRole('button', { name: 'Load Draft', exact: true }).click()
  await expect(form.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Recovered 雨 / Rain')
  await expect(form.getByRole('alert')).toContainText('source changed outside the editor')
  await form.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(form.getByRole('alert')).toBeVisible()
  expect(await readCharacter(page)).toBe(external)
  await screenshot(form, info, 'character-form-recovered-conflict')
  await form.getByRole('button', { name: 'Keep draft and overwrite', exact: true }).click()
  await expect(form).toBeHidden()
  const saved = await readCharacter(page)
  expect(parseCharacterMd(saved)).toMatchObject({ ...parseCharacterMd(original), name: 'Recovered 雨 / Rain' })
  expect(saved).toContain('review: newer-author-review')
  expect(saved).toContain('作者序言 / Author introduction.')
  expect(saved).toContain('## 额外线索\n\nDo not remove this author-defined section.')
  await expectPreviews(inspector.locator('.character-detail'))
  await page.reload()
  await expect(page.getByText('Browser workspace', { exact: true })).toBeVisible()
  await openCharacter(page)
  await inspector.getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(form.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Recovered 雨 / Rain')
  await expect(form.getByRole('button', { name: 'Load Draft', exact: true })).toHaveCount(0)
})
