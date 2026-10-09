import type { Page } from '@playwright/test'
import type { EditorBridge } from '../../packages/advjs/node/editor'
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { createEditorBridge } from '../../packages/advjs/node/editor'

const repositoryRoot = resolve(import.meta.dirname, '../..')
let bridge: EditorBridge | undefined
let editorUrl: string
let temporaryRoot = ''
let projectRoot = ''

test.beforeEach(async ({ page }, info) => {
  temporaryRoot = await mkdtemp(join(tmpdir(), 'advjs-content-creation-'))
  projectRoot = join(temporaryRoot, 'project')
  await cp(join(repositoryRoot, 'tests/launch/fixtures/golden-project'), projectRoot, { recursive: true })
  await mkdir(join(projectRoot, 'adv/assets'), { recursive: true })
  await writeFile(join(projectRoot, 'adv/assets/room.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#496b87"/></svg>')
  await writeFile(join(projectRoot, 'adv/assets.json'), JSON.stringify({ schemaVersion: 2, id: 'content-creation', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'adv/assets' } }, assets: [{ id: 'room', kind: 'background', type: 'image', path: 'room.svg' }] }))
  bridge = await createEditorBridge({ host: '127.0.0.1', port: 0, projectRoot, publicRoot: join(repositoryRoot, 'editor/core/dist') })
  editorUrl = (await bridge.start()).url
  await page.addInitScript((locale) => {
    localStorage.setItem('advjs:editor:locale', locale)
    localStorage.setItem('advjs:editor:onboarded', 'true')
    if (!localStorage.getItem('nuxt-color-mode'))
      localStorage.setItem('nuxt-color-mode', 'dark')
  }, info.title.includes('[en]') ? 'en' : 'zh-CN')
  await page.setViewportSize({ width: 1440, height: 900 })
})

test.afterEach(async () => {
  await bridge?.stop()
  bridge = undefined
  if (temporaryRoot)
    await rm(temporaryRoot, { recursive: true, force: true })
})

async function editorState(page: Page) {
  return page.evaluate(() => {
    const root = document.getElementById('__nuxt') as HTMLElement & {
      __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, unknown> } } } }
    }
    const stores = root.__vue_app__.config.globalProperties.$pinia._s
    const project = stores.get('@advjs/editor:project') as {
      chapters: { id: string, sources: string[] }[]
      scenes: { id: string, name?: string }[]
      diagnostics: { severity: string, message: string }[]
      localFilePaths: string[]
    }
    const file = stores.get('file') as { openedFilePath: string, isDirty: boolean }
    const monaco = stores.get('@advjs/editor:monaco') as { fileContent: string }
    return {
      chapters: project.chapters.map(({ id, sources }) => ({ id, sources: [...sources] })),
      scenes: project.scenes.map(({ id, name }) => ({ id, name })),
      errors: project.diagnostics.filter(item => item.severity === 'error'),
      paths: [...project.localFilePaths],
      openedFilePath: file.openedFilePath,
      dirty: file.isDirty,
      draft: monaco.fileContent,
    }
  })
}

async function loadEditor(page: Page) {
  await page.goto(editorUrl)
  await expect(page.locator('.advjs-editor-layout')).toBeVisible()
  await expect.poll(async () => (await editorState(page)).paths).toContain('adv/chapters/chapter_01.adv.md')
}

async function openCreation(page: Page, kind: '世界观' | '场景' | '章节') {
  await page.getByRole('menuitem', { name: '故事', exact: true }).click()
  const create = page.getByRole('menuitem', { name: '创建', exact: true })
  await create.focus()
  await create.press('ArrowRight')
  const item = page.getByRole('menuitem', { name: kind, exact: true })
  await item.focus()
  await item.press('Enter')
  const dialog = page.getByRole('dialog', { name: `创建${kind}`, exact: true })
  await expect(dialog).toBeVisible()
  return dialog
}

async function expectOpenedSource(page: Page, path: string, content: string, locale = 'zh-CN') {
  const main = page.locator('[data-editor-region="main"]')
  await expect(main.getByRole('tab', { name: locale === 'en' ? 'File' : '文件', exact: true })).toHaveAttribute('data-state', 'active')
  await expect(main.locator('.file-source .monaco-editor')).toBeVisible()
  await expect(main.getByRole('button', { name: locale === 'en' ? 'Source' : '源码', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(async () => (await editorState(page)).openedFilePath).toBe(path)
  await expect.poll(async () => (await editorState(page)).draft).toBe(content)
}

test('creates worldview, scene, and chapter files through the Story menu and opens their compiled source', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await loadEditor(page)

  const world = await openCreation(page, '世界观')
  await world.getByRole('textbox', { name: '名称', exact: true }).fill('风雨城')
  await world.getByRole('button', { name: '创建并编辑', exact: true }).click()
  await expect(world).toBeHidden()
  const worldContent = await readFile(join(projectRoot, 'adv/world.md'), 'utf8')
  expect(worldContent).toContain('风雨城')
  await expectOpenedSource(page, 'adv/world.md', worldContent)
  await expect.poll(async () => (await editorState(page)).paths).toContain('adv/world.md')

  const scene = await openCreation(page, '场景')
  await scene.getByRole('textbox', { name: '名称', exact: true }).fill('阅览室')
  await scene.getByRole('textbox', { name: '标识符', exact: true }).fill('reading-room')
  await scene.getByRole('button', { name: '创建并编辑', exact: true }).click()
  await expect(scene).toBeHidden()
  const sceneContent = await readFile(join(projectRoot, 'adv/scenes/reading-room.md'), 'utf8')
  expect(sceneContent).toContain('阅览室')
  await expectOpenedSource(page, 'adv/scenes/reading-room.md', sceneContent)
  await expect.poll(async () => (await editorState(page)).scenes).toContainEqual({ id: 'reading-room', name: '阅览室' })

  const chapter = await openCreation(page, '章节')
  await chapter.getByRole('textbox', { name: '名称', exact: true }).fill('第二封信')
  await chapter.getByRole('textbox', { name: '标识符', exact: true }).fill('second-letter')
  await chapter.getByRole('button', { name: '创建并编辑', exact: true }).click()
  await expect(chapter).toBeHidden()
  const chapterContent = await readFile(join(projectRoot, 'adv/chapters/second-letter.adv.md'), 'utf8')
  expect(chapterContent).toContain('第二封信')
  await expectOpenedSource(page, 'adv/chapters/second-letter.adv.md', chapterContent)
  await expect.poll(async () => (await editorState(page)).chapters).toContainEqual({ id: 'second-letter', sources: ['adv/chapters/second-letter.adv.md'] })
  expect((await editorState(page)).errors).toEqual([])
  expect((await editorState(page)).dirty).toBe(false)
  expect(errors).toEqual([])
})

test('keeps duplicate scenes and chapters intact and opens an existing worldview without replacing it', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const existingWorld = '# 现有世界观\n\n这段设定必须保留。\n'
  await writeFile(join(projectRoot, 'adv/world.md'), existingWorld)
  const originals = {
    场景: await readFile(join(projectRoot, 'adv/scenes/room.md'), 'utf8'),
    章节: await readFile(join(projectRoot, 'adv/chapters/chapter_01.adv.md'), 'utf8'),
  }
  await loadEditor(page)

  for (const [kind, id, path] of [['场景', 'room', 'adv/scenes/room.md'], ['章节', 'chapter_01', 'adv/chapters/chapter_01.adv.md']] as const) {
    const dialog = await openCreation(page, kind)
    await dialog.getByRole('textbox', { name: '名称', exact: true }).fill('不能覆盖原文件')
    await dialog.getByRole('textbox', { name: '标识符', exact: true }).fill(id)
    await expect(dialog.getByRole('alert')).toBeVisible()
    await expect(dialog.getByRole('button', { name: '创建并编辑', exact: true })).toBeDisabled()
    expect(await readFile(join(projectRoot, path), 'utf8')).toBe(originals[kind])
    await dialog.getByRole('button', { name: '取消', exact: true }).click()
    await expect(dialog).toBeHidden()
  }

  const world = await openCreation(page, '世界观')
  await expect(world.getByRole('textbox', { name: '名称', exact: true })).not.toBeEditable()
  await world.getByRole('button', { name: '打开编辑', exact: true }).click()
  await expect(world).toBeHidden()
  await expectOpenedSource(page, 'adv/world.md', existingWorld)
  expect(await readFile(join(projectRoot, 'adv/world.md'), 'utf8')).toBe(existingWorld)
  expect((await editorState(page)).chapters).toHaveLength(1)
  expect((await editorState(page)).scenes).toHaveLength(1)
  expect(errors).toEqual([])
})

test('preserves an unsaved chapter draft before creating content or opening the existing worldview', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const chapterPath = join(projectRoot, 'adv/chapters/chapter_01.adv.md')
  const original = await readFile(chapterPath, 'utf8')
  const existingWorld = '# 已有世界\n\n保留世界设定。\n'
  await writeFile(join(projectRoot, 'adv/world.md'), existingWorld)
  await loadEditor(page)
  const navigation = page.locator('[data-editor-region="navigation"]')
  await navigation.getByRole('tab', { name: '项目', exact: true }).click()
  await navigation.getByRole('textbox', { name: '搜索项目文件', exact: true }).fill('chapter_01.adv.md')
  await navigation.getByRole('treeitem', { name: 'chapter_01.adv.md', exact: true }).dblclick()
  await expectOpenedSource(page, 'adv/chapters/chapter_01.adv.md', original)
  const main = page.locator('[data-editor-region="main"]')
  await main.locator('.file-source .monaco-editor').click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.insertText('# 尚未保存的章节草稿\n\n不能被创建操作替换。\n')
  await expect.poll(async () => (await editorState(page)).dirty).toBe(true)
  const draft = (await editorState(page)).draft

  const scene = await openCreation(page, '场景')
  await scene.getByRole('textbox', { name: '名称', exact: true }).fill('待保存场景')
  await scene.getByRole('textbox', { name: '标识符', exact: true }).fill('pending-scene')
  await scene.getByRole('button', { name: '创建并编辑', exact: true }).click()
  await expect(scene.getByRole('alert')).toContainText('请先保存或放弃当前文件的修改')
  await scene.getByRole('button', { name: '取消', exact: true }).click()
  expect((await editorState(page)).draft).toBe(draft)
  expect((await editorState(page)).openedFilePath).toBe('adv/chapters/chapter_01.adv.md')
  expect(await readFile(chapterPath, 'utf8')).toBe(original)
  await expect(readFile(join(projectRoot, 'adv/scenes/pending-scene.md'), 'utf8')).rejects.toThrow()

  const world = await openCreation(page, '世界观')
  await world.getByRole('button', { name: '打开编辑', exact: true }).click()
  await expect(world.getByRole('alert')).toContainText('请先保存或放弃当前文件的修改')
  await world.getByRole('button', { name: '取消', exact: true }).click()
  await expectOpenedSource(page, 'adv/chapters/chapter_01.adv.md', draft)
  expect(await readFile(join(projectRoot, 'adv/world.md'), 'utf8')).toBe(existingWorld)
  expect((await editorState(page)).dirty).toBe(true)

  await main.getByRole('button', { name: '放弃修改', exact: true }).click()
  await expect.poll(async () => (await editorState(page)).dirty).toBe(false)
  const retry = await openCreation(page, '场景')
  await retry.getByRole('textbox', { name: '名称', exact: true }).fill('待保存场景')
  await retry.getByRole('textbox', { name: '标识符', exact: true }).fill('pending-scene')
  await retry.getByRole('button', { name: '创建并编辑', exact: true }).click()
  await expect(retry).toBeHidden()
  await expectOpenedSource(page, 'adv/scenes/pending-scene.md', await readFile(join(projectRoot, 'adv/scenes/pending-scene.md'), 'utf8'))
  expect(errors).toEqual([])
})

test('cancels without writing files and keeps the compact dialog usable at desktop and 320px widths in both themes', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await loadEditor(page)
  const before = (await readdir(join(projectRoot, 'adv'), { recursive: true })).sort()
  const scene = await openCreation(page, '场景')
  await scene.getByRole('textbox', { name: '名称', exact: true }).fill('很长的场景名称用于检查窄屏表单布局')
  await scene.getByRole('textbox', { name: '标识符', exact: true }).fill('cancelled-scene')
  await expect(page.locator('html')).toHaveClass(/editor-dark/)
  await scene.screenshot({ path: info.outputPath('content-creation-desktop-dark.png') })
  await scene.getByRole('button', { name: '取消', exact: true }).click()

  await page.setViewportSize({ width: 320, height: 640 })
  const narrow = await openCreation(page, '场景')
  await narrow.getByRole('textbox', { name: '名称', exact: true }).fill('很长的场景名称用于检查窄屏表单布局')
  await narrow.getByRole('textbox', { name: '标识符', exact: true }).fill('cancelled-scene')
  await expect(narrow.getByRole('button', { name: '创建并编辑', exact: true })).toBeInViewport()
  await expect.poll(() => narrow.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  expect((await narrow.boundingBox())!.width).toBeLessThanOrEqual(320)
  await narrow.screenshot({ path: info.outputPath('content-creation-320-dark.png') })
  await narrow.getByRole('button', { name: '取消', exact: true }).click()

  await page.evaluate(() => localStorage.setItem('nuxt-color-mode', 'light'))
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/editor-light/)
  await expect.poll(async () => (await editorState(page)).paths).toContain('adv/chapters/chapter_01.adv.md')
  const light = await openCreation(page, '章节')
  await light.getByRole('textbox', { name: '名称', exact: true }).fill('取消创建的章节')
  await light.getByRole('textbox', { name: '标识符', exact: true }).fill('cancelled-chapter')
  await expect(light.getByRole('button', { name: '创建并编辑', exact: true })).toBeInViewport()
  await expect.poll(() => light.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  await light.screenshot({ path: info.outputPath('content-creation-320-light.png') })
  await page.keyboard.press('Escape')
  await expect(light).toBeHidden()

  await page.setViewportSize({ width: 1440, height: 900 })
  const world = await openCreation(page, '世界观')
  await world.getByRole('textbox', { name: '名称', exact: true }).fill('取消创建的世界观')
  await world.screenshot({ path: info.outputPath('content-creation-desktop-light.png') })
  await world.getByRole('button', { name: '取消', exact: true }).click()
  expect((await readdir(join(projectRoot, 'adv'), { recursive: true })).sort()).toEqual(before)
  await expect(readFile(join(projectRoot, 'adv/world.md'), 'utf8')).rejects.toThrow()
  await expect(readFile(join(projectRoot, 'adv/scenes/cancelled-scene.md'), 'utf8')).rejects.toThrow()
  await expect(readFile(join(projectRoot, 'adv/chapters/cancelled-chapter.adv.md'), 'utf8')).rejects.toThrow()
  expect(errors).toEqual([])
})

test('[en] creates a scene with Enter and cancels chapter creation with Escape using English form labels', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await loadEditor(page)
  await page.getByRole('menuitem', { name: 'Story', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Create', exact: true }).hover()
  await page.getByRole('menuitem', { name: 'Scene', exact: true }).click()
  const scene = page.getByRole('dialog', { name: 'Create scene', exact: true })
  await expect(scene).toBeVisible()
  await expect(scene.getByRole('textbox', { name: 'Name', exact: true })).toBeFocused()
  await scene.getByRole('textbox', { name: 'Name', exact: true }).fill('Rain library')
  await scene.getByRole('textbox', { name: 'ID', exact: true }).fill('rain-library')
  await expect(scene.getByRole('button', { name: 'Create and edit', exact: true })).toBeEnabled()
  await scene.screenshot({ path: info.outputPath('content-creation-en-keyboard.png') })
  await page.keyboard.press('Enter')
  await expect(scene).toBeHidden()
  const content = await readFile(join(projectRoot, 'adv/scenes/rain-library.md'), 'utf8')
  expect(content).toContain('Rain library')
  expect(content).toContain('Describe this scene and its atmosphere.')
  await expectOpenedSource(page, 'adv/scenes/rain-library.md', content, 'en')
  await expect.poll(async () => (await editorState(page)).scenes).toContainEqual({ id: 'rain-library', name: 'Rain library' })

  await page.getByRole('menuitem', { name: 'Story', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Create', exact: true }).hover()
  await page.getByRole('menuitem', { name: 'Chapter', exact: true }).click()
  const chapter = page.getByRole('dialog', { name: 'Create chapter', exact: true })
  await expect(chapter).toBeVisible()
  await chapter.getByRole('textbox', { name: 'Name', exact: true }).fill('Cancelled keyboard chapter')
  await chapter.getByRole('textbox', { name: 'ID', exact: true }).fill('cancelled-en')
  await page.keyboard.press('Escape')
  await expect(chapter).toBeHidden()
  await expect(readFile(join(projectRoot, 'adv/chapters/cancelled-en.adv.md'), 'utf8')).rejects.toThrow()
  expect((await editorState(page)).openedFilePath).toBe('adv/scenes/rain-library.md')
  expect((await editorState(page)).dirty).toBe(false)
  expect(errors).toEqual([])
})
