import type { EditorBridge, EditorBridgeReadyEvent } from '../../packages/advjs/node/editor'
import { Buffer } from 'node:buffer'
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { expect, test } from '@playwright/test'
import { createEditorBridge } from '../../packages/advjs/node/editor'

const repositoryRoot = resolve(import.meta.dirname, '../..')
let bridge: EditorBridge | undefined
let ready: EditorBridgeReadyEvent
let temporaryRoot = ''
let projectRoot = ''

test('keeps console actions above scrolling logs in short and narrow panels', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('advjs:editor:locale', 'zh-CN')
    localStorage.setItem('advjs:editor:onboarded', 'true')
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } })
  })
  await page.goto(ready.url)
  const bottom = page.locator('[data-editor-region="bottom"]')
  await bottom.getByRole('tab', { name: '控制台', exact: true }).click()
  await expect(bottom.locator('.editor-console')).toBeVisible()
  await page.evaluate(() => {
    const root = document.getElementById('__nuxt') as HTMLElement & {
      __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, { clear: () => void, info: (message: string) => void, error: (message: string, data: unknown) => void }> } } } }
    }
    const store = root.__vue_app__.config.globalProperties.$pinia._s.get('@advjs/editor/console')!
    store.clear()
    for (let i = 0; i < 20; i++)
      store.info(`Earlier log ${i}`)
    store.error('diagnostic-console-write-failed', { error: { name: 'Error', message: '写入章节失败 / A long error message '.repeat(30), stack: 'at example.ts:10:2\n'.repeat(20) } })
  })
  const notification = page.locator('.ToastRoot').filter({ hasText: 'diagnostic-console-write-failed' })
  await expect(notification).toBeVisible()
  await notification.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(notification).toBeHidden()
  const consoleView = bottom.locator('.editor-console')
  const toolbar = consoleView.locator('.console-toolbar')
  const logs = consoleView.locator('.console-logs')
  const errorLog = logs.locator('.console-log').filter({ hasText: 'diagnostic-console-write-failed' })
  await toolbar.getByRole('button', { name: '复制日志给 AI', exact: true }).click()
  await errorLog.getByRole('button', { name: '复制错误信息', exact: true }).click()
  await expect(toolbar.getByRole('button', { name: '当前日志已复制，可粘贴给 AI' })).toBeVisible()
  await expect(errorLog.getByRole('button', { name: '这条错误已复制，可粘贴给 AI' })).toBeVisible()
  for (const size of [{ width: 1100, height: 224 }, { width: 1100, height: 84 }, { width: 320, height: 132 }, { width: 320, height: 64 }]) {
    await consoleView.evaluate((element, size) => Object.assign((element as HTMLElement).style, { width: `${size.width}px`, height: `${size.height}px` }), size)
    const toolbarBounds = (await toolbar.boundingBox())!
    const logBounds = (await logs.boundingBox())!
    expect(toolbarBounds.height).toBeLessThanOrEqual(32)
    expect(logBounds.y).toBeGreaterThanOrEqual(toolbarBounds.y + toolbarBounds.height)
    expect(await consoleView.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    expect(await logs.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    await expect(errorLog.getByRole('button')).toBeInViewport()
    expect((await errorLog.getByRole('button').boundingBox())!.height).toBe(24)
    const allCopyBounds = (await toolbar.getByRole('button').last().boundingBox())!
    const entryCopyBounds = (await errorLog.getByRole('button').boundingBox())!
    expect(Math.abs(allCopyBounds.x - entryCopyBounds.x)).toBeLessThanOrEqual(0.5)
    await logs.evaluate(element => element.scrollTop = element.scrollHeight)
    await expect(logs.getByText('Earlier log 0', { exact: true })).toBeInViewport()
    expect((await toolbar.boundingBox())!.y).toBe(toolbarBounds.y)
    await logs.evaluate(element => element.scrollTop = 0)
    if (process.env.ADVJS_LAYOUT_SCREENSHOTS) {
      await mkdir(process.env.ADVJS_LAYOUT_SCREENSHOTS, { recursive: true })
      await consoleView.screenshot({ path: join(process.env.ADVJS_LAYOUT_SCREENSHOTS, `console-${size.width}-${size.height}-dark.png`) })
    }
  }
  // Classic scrollbars also need to reserve the same space in both action columns.
  const scrollbarStyle = await page.addStyleTag({ content: '.console-toolbar::-webkit-scrollbar, .console-logs::-webkit-scrollbar { width: 12px; }' })
  expect(await logs.evaluate(element => (element as HTMLElement).offsetWidth - element.clientWidth)).toBeGreaterThan(0)
  const allCopyBounds = (await toolbar.getByRole('button').last().boundingBox())!
  const entryCopyBounds = (await errorLog.getByRole('button').boundingBox())!
  expect(Math.abs(allCopyBounds.x - entryCopyBounds.x)).toBeLessThanOrEqual(0.5)
  await scrollbarStyle.evaluate(element => element.remove())
  // Clipboard failures must offer a report without expanding the toolbar into the logs.
  await page.evaluate(() => Object.defineProperty(navigator.clipboard, 'writeText', {
    configurable: true,
    value: async () => {
      throw new Error('Clipboard unavailable')
    },
  }))
  await toolbar.getByRole('button').last().click()
  const fallback = page.getByRole('dialog', { name: '手动复制错误信息' })
  await expect(fallback.getByRole('textbox', { name: '错误排查信息' })).toHaveValue(/diagnostic-console-write-failed/)
  expect((await toolbar.boundingBox())!.height).toBeLessThanOrEqual(32)
  await page.keyboard.press('Escape')
  await expect(fallback).toBeHidden()
  await expect(toolbar.getByRole('button').last()).toBeFocused()
  await consoleView.evaluate(element => element.style.height = '132px')
  await page.getByRole('menuitem', { name: 'ADV.JS', exact: true }).click()
  await page.getByRole('menuitem', { name: '设置', exact: false }).click()
  const preferences = page.getByRole('dialog', { name: '偏好设置', exact: true })
  await preferences.getByRole('combobox', { name: '主题预设', exact: true }).click()
  await page.getByRole('option', { name: '亮色', exact: true }).click()
  await preferences.getByRole('treeitem', { name: '界面', exact: true }).click()
  await preferences.getByRole('combobox', { name: '语言', exact: true }).click()
  await page.getByRole('option', { name: 'English', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(preferences).toBeHidden()
  await expect(consoleView.getByRole('textbox', { name: 'Filter logs' })).toBeVisible()
  expect((await toolbar.boundingBox())!.height).toBeLessThanOrEqual(32)
  if (process.env.ADVJS_LAYOUT_SCREENSHOTS)
    await consoleView.screenshot({ path: join(process.env.ADVJS_LAYOUT_SCREENSHOTS, 'console-320-light-en.png') })
  await consoleView.getByRole('textbox', { name: 'Filter logs' }).fill('Earlier log 0')
  await expect(logs.locator('.console-log')).toHaveCount(1)
  await toolbar.getByRole('button', { name: 'Clear logs', exact: true }).click()
  await expect(logs.locator('.console-log')).toHaveCount(0)
  await expect(toolbar.getByRole('button', { name: 'Copy logs for AI', exact: true })).toBeDisabled()
})

test.beforeAll(async () => {
  const publicRoot = resolve(repositoryRoot, 'editor/core/dist')
  await stat(resolve(publicRoot, 'index.html'))
  temporaryRoot = await mkdtemp(join(tmpdir(), 'advjs-editor-local-e2e-'))
  projectRoot = join(temporaryRoot, 'project')
  await cp(resolve(repositoryRoot, 'tests/launch/fixtures/golden-project'), projectRoot, { recursive: true })
  await mkdir(join(projectRoot, 'adv/assets'), { recursive: true })
  await writeFile(join(projectRoot, 'adv/assets/preview.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#496b87"/><text x="320" y="190" text-anchor="middle" font-size="32" fill="white">ADV.JS</text></svg>')
  await mkdir(join(projectRoot, 'adv/assets/backgrounds'), { recursive: true })
  await mkdir(join(projectRoot, 'adv/assets/portraits'), { recursive: true })
  await writeFile(join(projectRoot, 'adv/assets/backgrounds/桃园结义-章节背景-with-a-long-name.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#527052"/><path d="M0 280 160 80 320 280 480 100 640 280V360H0" fill="#384e38"/></svg>')
  await writeFile(join(projectRoot, 'adv/assets/portraits/hero.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="360"><rect width="240" height="360" fill="#765f52"/><circle cx="120" cy="110" r="60" fill="#c4a98b"/><path d="M40 340V230Q120 160 200 230V340" fill="#493d36"/></svg>')
  bridge = await createEditorBridge({
    host: '127.0.0.1',
    port: 0,
    projectRoot,
    publicRoot,
  })
  ready = await bridge.start()
})

test.afterAll(async () => {
  await bridge?.stop()
  if (temporaryRoot)
    await rm(temporaryRoot, { force: true, recursive: true })
})

test('loads, live-refreshes, resolves conflicts, and saves the source project', async ({ browserName, page }) => {
  test.skip(browserName !== 'chromium', 'The launch support matrix targets Chromium stable')
  const launchUrl = new URL(ready.url)
  const token = new URLSearchParams(launchUrl.hash.slice(1)).get('advjs-token')!
  const thirdPartyRequests: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if ((url.protocol === 'http:' || url.protocol === 'https:') && url.origin !== launchUrl.origin)
      thirdPartyRequests.push(url.href)
  })

  const projectResponse = page.waitForResponse(response => response.url().endsWith('/__advjs/api/project'), { timeout: 10_000 })
  await page.goto(ready.url)
  const loadedProjectResponse = await projectResponse
  expect(loadedProjectResponse.status()).toBe(200)
  const skipOnboarding = page.getByRole('dialog', { name: 'Welcome to ADV.JS Editor' }).getByRole('button', { name: 'Skip', exact: true })
  if (await skipOnboarding.waitFor({ state: 'visible', timeout: 5_000 }).then(() => true).catch(() => false))
    await skipOnboarding.click()
  await expect(page.getByRole('dialog', { name: 'Welcome to ADV.JS Editor' })).toBeHidden()
  expect(page.url()).not.toContain('advjs-token')
  expect(await page.evaluate(sessionToken => ({
    document: document.documentElement.outerHTML.includes(sessionToken),
    localStorage: Object.values(localStorage).some(value => value.includes(sessionToken)),
    sessionStorage: Object.values(sessionStorage).some(value => value.includes(sessionToken)),
  }), token)).toEqual({ document: false, localStorage: false, sessionStorage: false })
  await expect(page.getByText('Live local workspace')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('1 chapters')).toBeVisible()
  await expect(page.getByText('1 characters')).toBeVisible()
  await expect(page.getByText('1 scenes')).toBeVisible()
  const reloadResponse = page.waitForResponse(response => response.url().endsWith('/__advjs/api/project'))
  await page.reload()
  expect((await reloadResponse).status()).toBe(200)
  await expect(page.getByText('Live local workspace')).toBeVisible()
  expect(page.url()).not.toContain('advjs-token')
  await page.getByRole('menuitem', { name: 'Story', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Characters', exact: true }).click()
  await expect(page).toHaveURL(/\/characters$/)
  const routeReloadResponse = page.waitForResponse(response => response.url().endsWith('/__advjs/api/project'))
  await page.reload()
  expect((await routeReloadResponse).status()).toBe(200)
  await page.goBack()
  await expect(page.getByText('Live local workspace')).toBeVisible()
  const startSourcePreview = page.getByRole('button', { name: 'Start source preview' })
  await expect(startSourcePreview).toBeVisible()
  await expect(stat(join(projectRoot, 'dist'))).rejects.toThrow()
  await startSourcePreview.click()
  await expect(startSourcePreview).toBeHidden({ timeout: 15_000 })
  await expect(stat(join(projectRoot, 'dist'))).rejects.toThrow()

  await writeFile(join(projectRoot, 'adv/characters/agent.character.md'), [
    '---',
    'id: agent',
    'name: Agent',
    '---',
    '',
    '# Agent',
    '',
  ].join('\n'), 'utf8')
  await expect(page.getByText('2 characters')).toBeVisible({ timeout: 10_000 })

  const navigation = page.locator('[data-editor-region="navigation"]')
  const main = page.locator('[data-editor-region="main"]')
  const inspector = page.locator('[data-editor-region="inspector"]')
  const assets = page.locator('[data-editor-region="bottom"]')
  await expect(navigation.getByRole('tab', { name: 'Project', exact: true })).toBeVisible()
  await expect(assets.getByRole('tab', { name: 'Assets', exact: true })).toBeVisible()
  await expect(assets.getByRole('tab', { name: 'Project', exact: true })).toHaveCount(0)
  await navigation.getByText('chapter_01.adv.md', { exact: true }).click()
  await expect(main.getByRole('tab', { name: 'File', exact: true })).toHaveAttribute('data-state', 'active')
  await expect(main.getByText('chapter_01.adv.md', { exact: true })).toBeVisible()
  await expect(inspector.getByText('File information', { exact: true })).toBeVisible()
  await expect(inspector.locator('.monaco-editor')).toHaveCount(0)
  await main.getByRole('button', { name: 'Reading', exact: true }).click()
  await expect(main.locator('.context-document')).toBeVisible()
  await main.getByRole('button', { name: 'Source', exact: true }).click()

  const editor = page.locator('.monaco-editor').last()
  await editor.click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
  await page.keyboard.type('# Unsaved Editor change')
  await assets.getByRole('button', { name: 'preview.svg', exact: true }).click()
  await expect(inspector.getByText('Asset information', { exact: true })).toBeVisible()
  await expect(main.getByText('chapter_01.adv.md •', { exact: true })).toBeVisible()
  await expect(main.locator('.monaco-editor')).toBeVisible()
  await assets.getByRole('button', { name: 'preview.svg', exact: true }).dblclick()
  await expect(main.getByText('chapter_01.adv.md •', { exact: true })).toBeVisible()

  const chapterPath = join(projectRoot, 'adv/chapters/chapter_01.adv.md')
  await writeFile(chapterPath, '# External Agent change\n', 'utf8')
  const conflictMessage = page.getByText('This file changed outside the Editor while you have unsaved edits.')
  await expect(conflictMessage).toBeVisible({ timeout: 10_000 })

  await page.getByRole('button', { name: 'Use external' }).click()
  await expect(conflictMessage).toBeHidden()
  await editor.click()
  await page.keyboard.press('End')
  await page.keyboard.insertText('\n# SavedFromEditor')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect.poll(async () => await readFile(chapterPath, 'utf8')).toContain('# SavedFromEditor')
  await assets.getByRole('button', { name: 'preview.svg', exact: true }).dblclick()
  await expect(main.getByRole('img', { name: 'preview.svg', exact: true })).toBeVisible()
  await expect(main.locator('.monaco-editor')).toHaveCount(0)
  await expect(stat(join(projectRoot, 'dist'))).rejects.toThrow()
  expect(thirdPartyRequests).toEqual([])
})

test('restores the project tab in navigation and previews assets in the main region', async ({ page }) => {
  await writeFile(join(projectRoot, 'adv/chapters/chapter_01.adv.md'), await readFile(resolve(repositoryRoot, 'tests/launch/fixtures/golden-project/adv/chapters/chapter_01.adv.md')))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.addInitScript(() => {
    localStorage.setItem('advjs:editor:locale', 'zh-CN')
    localStorage.setItem('advjs:editor:onboarded', 'true')
    localStorage.setItem('advjs:editor:ui:v1', JSON.stringify({ version: 1, active: { bottom: 'advjs.core/project' } }))
  })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.stack || error.message))
  page.on('console', (message) => {
    if (message.type() === 'error')
      errors.push(message.text())
  })
  page.on('requestfailed', request => errors.push(`${request.url()} ${request.failure()?.errorText}`))
  await page.goto(ready.url)
  const navigation = page.locator('[data-editor-region="navigation"]')
  const main = page.locator('[data-editor-region="main"]')
  const assets = page.locator('[data-editor-region="bottom"]')
  await expect(navigation.getByRole('tab', { name: '项目', exact: true })).toHaveAttribute('data-state', 'active')
  await expect(assets.getByRole('tab', { name: '素材', exact: true })).toHaveAttribute('data-state', 'active')
  const search = navigation.getByRole('textbox', { name: '搜索项目文件' })
  await search.fill('chapter_01')
  const chapter = navigation.getByRole('treeitem', { name: 'chapter_01.adv.md', exact: true })
  await chapter.focus()
  await page.keyboard.press('Enter')
  await expect(main.getByRole('tab', { name: '文件', exact: true })).toHaveAttribute('data-state', 'active')
  await expect(main.locator('.monaco-editor')).toBeVisible()
  await search.fill('')
  await main.getByRole('button', { name: '阅读', exact: true }).click()
  await expect(main.locator('.context-document')).toBeVisible()
  const assetBrowser = assets.locator('.project-assets')
  const assetToolbar = assets.getByRole('toolbar', { name: '项目素材', exact: true })
  await expect(assets.locator('.project-asset')).toHaveCount(3)
  await expect(assets.getByRole('navigation', { name: '素材路径', exact: true })).toHaveCount(0)
  expect((await assetToolbar.boundingBox())!.height).toBeLessThanOrEqual(32)
  const assetBounds = await assets.locator('.project-asset').evaluateAll(elements => elements.map(element => ({ left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right })))
  expect(Math.round(assetBounds[1].left - assetBounds[0].right)).toBe(4)
  for (const [name, icon] of [['assets', 'i-ri-folders-line'], ['chapters', 'i-ri-book-open-line'], ['characters', 'i-ri-folder-user-line'], ['scenes', 'i-ri-landscape-line']]) {
    const folderIcon = navigation.getByRole('treeitem', { name, exact: true }).locator('.agui-tree-node').first().locator('.agui-tree-icon')
    await expect(folderIcon).toHaveClass(new RegExp(icon))
    await expect.poll(() => folderIcon.evaluate(element => getComputedStyle(element).maskImage)).not.toBe('none')
  }
  const rootToggle = assets.getByRole('button', { name: 'Collapse 全部素材', exact: true })
  expect((await rootToggle.boundingBox())!.width).toBe(24)
  expect((await rootToggle.boundingBox())!.height).toBe(24)
  if (process.env.ADVJS_LAYOUT_SCREENSHOTS) {
    await expect(page.locator('.ToastRoot')).toHaveCount(0)
    await mkdir(process.env.ADVJS_LAYOUT_SCREENSHOTS, { recursive: true })
    await page.screenshot({ path: join(process.env.ADVJS_LAYOUT_SCREENSHOTS, 'desktop-dark.png') })
  }
  await assetBrowser.evaluate(element => element.style.height = '132px')
  const firstAsset = assets.locator('.project-asset').first()
  await expect.poll(() => firstAsset.locator('.asset-thumbnail').evaluate(element => element.getBoundingClientRect().height)).toBe(40)
  expect((await firstAsset.boundingBox())!.y + (await firstAsset.boundingBox())!.height).toBeLessThanOrEqual((await assetBrowser.boundingBox())!.y + 132)
  if (process.env.ADVJS_LAYOUT_SCREENSHOTS)
    await assetBrowser.screenshot({ path: join(process.env.ADVJS_LAYOUT_SCREENSHOTS, 'assets-short-dark.png') })
  await assetBrowser.evaluate(element => element.style.height = '84px')
  await expect.poll(() => firstAsset.locator('.asset-thumbnail').evaluate(element => element.getBoundingClientRect().height)).toBe(24)
  expect((await firstAsset.boundingBox())!.y + (await firstAsset.boundingBox())!.height).toBeLessThanOrEqual((await assetBrowser.boundingBox())!.y + 84)
  await assetBrowser.evaluate(element => element.style.height = '')
  await assets.getByRole('button', { name: 'preview.svg', exact: true }).dblclick()
  const image = main.getByRole('img', { name: 'preview.svg', exact: true })
  await expect(image).toBeVisible()
  await expect.poll(() => image.evaluate(img => (img as HTMLImageElement).naturalWidth)).toBe(640)
  await expect(assets.getByRole('button', { name: 'preview.svg', exact: true })).toHaveAttribute('title', /双击或按 Enter 预览/)
  await assets.getByRole('textbox', { name: '搜索素材' }).fill('missing')
  await expect(assets.getByText('没有匹配的素材，可更换目录或调整筛选条件。')).toBeVisible()
  await assets.getByRole('textbox', { name: '搜索素材' }).fill('')
  await page.setViewportSize({ width: 1280, height: 800 })
  const navigationPane = navigation.locator('xpath=ancestor::div[contains(@class, "splitpanes__pane")][1]')
  const splitter = navigationPane.locator('xpath=following-sibling::div[contains(@class, "splitpanes__splitter")]').first()
  const boundary = await splitter.boundingBox()
  const navBounds = await navigation.boundingBox()
  await page.mouse.move(boundary!.x + boundary!.width / 2, boundary!.y + 20)
  await page.mouse.down()
  await page.mouse.move(boundary!.x + 320 - navBounds!.width, boundary!.y + 20)
  await page.mouse.up()
  await expect.poll(async () => Math.round((await navigation.boundingBox())!.width)).toBeGreaterThanOrEqual(315)
  await expect.poll(async () => Math.round((await navigation.boundingBox())!.width)).toBeLessThanOrEqual(325)
  await assets.getByRole('button', { name: '列表视图', exact: true }).click()
  await expect(assets.locator('.project-assets-list')).toHaveClass(/list/)
  if (process.env.ADVJS_LAYOUT_SCREENSHOTS)
    await page.screenshot({ path: join(process.env.ADVJS_LAYOUT_SCREENSHOTS, 'narrow-dark.png') })
  await page.getByRole('menuitem', { name: 'ADV.JS', exact: true }).click()
  await page.getByRole('menuitem', { name: '设置', exact: false }).click()
  const preferences = page.getByRole('dialog', { name: '偏好设置', exact: true })
  await preferences.getByRole('combobox', { name: '主题预设', exact: true }).click()
  await page.getByRole('option', { name: '亮色', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(preferences).toBeHidden()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  if (process.env.ADVJS_LAYOUT_SCREENSHOTS)
    await page.screenshot({ path: join(process.env.ADVJS_LAYOUT_SCREENSHOTS, 'narrow-light.png') })
  const pngPath = join(projectRoot, 'adv/assets/native-preview.png')
  await writeFile(pngPath, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6aQAAAAASUVORK5CYII=', 'base64'))
  const pngAsset = assets.getByRole('button', { name: 'native-preview.png', exact: true })
  await expect(pngAsset).toBeVisible()
  await pngAsset.dblclick()
  const pngImage = main.getByRole('img', { name: 'native-preview.png', exact: true })
  await expect(pngImage).toBeVisible()
  await expect.poll(() => pngImage.evaluate(img => (img as HTMLImageElement).naturalWidth)).toBe(1)
  expect(errors).toEqual([])
})

test('browses asset folders, preserves the draft on selection, and remembers navigation preferences', async ({ browser, page }) => {
  // Remove the raster fixture after the previous test's browsing context closes.
  await rm(join(projectRoot, 'adv/assets/native-preview.png'), { force: true })
  await page.addInitScript(() => {
    localStorage.setItem('advjs:editor:locale', 'zh-CN')
    localStorage.setItem('advjs:editor:onboarded', 'true')
  })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.stack || error.message))
  page.on('console', (message) => {
    if (message.type() === 'error')
      errors.push(message.text())
  })
  await page.goto(ready.url)
  const navigation = page.locator('[data-editor-region="navigation"]')
  const main = page.locator('[data-editor-region="main"]')
  const inspector = page.locator('[data-editor-region="inspector"]')
  const assets = page.locator('[data-editor-region="bottom"]')
  const folders = assets.getByRole('tree', { name: '素材目录', exact: true })
  await expect(folders).toBeVisible()
  await folders.getByRole('treeitem', { name: 'backgrounds', exact: true }).click()
  await expect(assets.locator('.project-asset')).toHaveCount(1)
  await expect(assets.getByRole('button', { name: 'hero.svg', exact: true })).toHaveCount(0)
  const search = assets.getByRole('textbox', { name: '搜索素材', exact: true })
  await search.fill('hero')
  await expect(assets.getByRole('status')).toContainText('没有匹配的素材')
  await assets.getByRole('button', { name: '浏览范围', exact: true }).click()
  await page.getByRole('menuitem', { name: '全部素材', exact: true }).click()
  const hero = assets.getByRole('button', { name: 'hero.svg', exact: true })
  await expect(hero).toBeVisible()
  await assets.getByRole('navigation', { name: '素材路径', exact: true }).getByRole('link', { name: '全部素材', exact: true }).click()
  await search.fill('')
  await expect(assets.locator('.project-asset')).toHaveCount(3)

  await navigation.getByText('chapter_01.adv.md', { exact: true }).click()
  const editor = main.locator('.monaco-editor')
  await editor.click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
  await page.keyboard.insertText('# Draft retained while browsing assets')
  await hero.click()
  await expect(main.getByText('chapter_01.adv.md •', { exact: true })).toBeVisible()
  await expect(inspector.getByText('素材信息', { exact: true })).toBeVisible()
  await expect(inspector.getByText('adv/assets/portraits/hero.svg', { exact: true })).toBeVisible()
  await navigation.getByRole('textbox', { name: '搜索项目文件', exact: true }).fill('chapter')
  await assets.getByRole('button', { name: '在项目中定位', exact: true }).click()
  const revealed = navigation.getByRole('treeitem', { name: 'hero.svg', exact: true })
  await expect(revealed).toHaveAttribute('aria-selected', 'true')
  await expect(revealed).toBeFocused()
  await expect(main.getByText('chapter_01.adv.md •', { exact: true })).toBeVisible()
  await navigation.getByRole('button', { name: '在素材中显示', exact: true }).click()
  await expect(folders.getByRole('treeitem', { name: 'portraits', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(hero).toBeFocused()
  await expect(assets.locator('.project-asset')).toHaveCount(1)
  await main.getByRole('button', { name: '放弃修改', exact: true }).click()
  await hero.focus()
  await page.keyboard.press('Enter')
  await expect(main.getByRole('img', { name: 'hero.svg', exact: true })).toBeVisible()

  const separator = assets.getByRole('separator', { name: '调整素材目录宽度', exact: true })
  await separator.focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await expect(separator).toHaveAttribute('aria-valuenow', '220')
  const boundary = (await separator.boundingBox())!
  await page.mouse.move(boundary.x + boundary.width / 2, boundary.y + 10)
  await page.mouse.down()
  await page.mouse.move(boundary.x + boundary.width / 2 + 20, boundary.y + 10)
  await page.mouse.up()
  await expect(separator).toHaveAttribute('aria-valuenow', '240')
  await assets.getByRole('button', { name: '列表视图', exact: true }).click()
  await assets.getByRole('button', { name: '目录侧栏', exact: true }).click()
  await expect(folders).toHaveCount(0)
  await page.reload()
  await expect(assets.getByRole('navigation', { name: '素材路径', exact: true })).toContainText('portraits')
  await expect(assets.locator('.project-assets-list')).toHaveClass(/list/)
  await expect(folders).toHaveCount(0)
  await assets.getByRole('button', { name: '目录侧栏', exact: true }).click()
  await expect(separator).toHaveAttribute('aria-valuenow', '240')

  await assets.locator('.project-assets').evaluate(element => element.style.width = '320px')
  await expect(folders).toHaveCount(0)
  await expect(assets.getByRole('button', { name: '目录侧栏', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await assets.getByRole('button', { name: '目录侧栏', exact: true }).click()
  await expect(folders).toBeVisible()
  await expect(assets.locator('.project-assets')).toHaveJSProperty('scrollWidth', 320)
  expect((await assets.getByRole('toolbar', { name: '项目素材', exact: true }).boundingBox())!.height).toBeLessThanOrEqual(32)
  const pathMenu = assets.getByRole('button', { name: '素材路径', exact: true })
  await expect(pathMenu).toHaveAttribute('title', 'adv/assets/portraits')
  await pathMenu.click()
  await expect(page.getByRole('menuitem', { name: '全部素材', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  const viewMenu = assets.getByRole('button', { name: '素材视图与操作', exact: true })
  await viewMenu.focus()
  await page.keyboard.press('Enter')
  await page.getByRole('menuitem', { name: '缩略图视图', exact: true }).click()
  await expect(assets.locator('.project-assets-list')).toHaveClass(/grid/)
  await expect(viewMenu).toBeFocused()
  if (process.env.ADVJS_LAYOUT_SCREENSHOTS) {
    await expect(page.locator('.ToastRoot')).toHaveCount(0)
    await assets.locator('.project-assets').screenshot({ path: join(process.env.ADVJS_LAYOUT_SCREENSHOTS, 'assets-320-dark.png') })
  }
  await page.getByRole('menuitem', { name: 'ADV.JS', exact: true }).click()
  await page.getByRole('menuitem', { name: '设置', exact: false }).click()
  const preferences = page.getByRole('dialog', { name: '偏好设置', exact: true })
  await preferences.getByRole('combobox', { name: '主题预设', exact: true }).click()
  await page.getByRole('option', { name: '亮色', exact: true }).click()
  await preferences.getByRole('treeitem', { name: '界面', exact: true }).click()
  await preferences.getByRole('combobox', { name: '语言', exact: true }).click()
  await page.getByRole('option', { name: 'English', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(assets.getByRole('button', { name: 'Folder sidebar', exact: true })).toBeVisible()
  await expect(assets.getByRole('button', { name: 'Browse scope', exact: true })).toHaveAttribute('title', 'Browse scope: Folder and descendants')
  await expect(assets.locator('.project-assets')).toHaveJSProperty('scrollWidth', 320)
  if (process.env.ADVJS_LAYOUT_SCREENSHOTS)
    await assets.locator('.project-assets').screenshot({ path: join(process.env.ADVJS_LAYOUT_SCREENSHOTS, 'assets-320-light-en.png') })
  const bottomPane = assets.locator('xpath=ancestor::div[contains(@class, "splitpanes__pane")][1]')
  const horizontalSplitter = bottomPane.locator('xpath=preceding-sibling::div[contains(@class, "splitpanes__splitter")]').last()
  const horizontalBoundary = (await horizontalSplitter.boundingBox())!
  await page.mouse.move(horizontalBoundary.x + 20, horizontalBoundary.y + horizontalBoundary.height / 2)
  await page.mouse.down()
  await page.mouse.move(horizontalBoundary.x + 20, horizontalBoundary.y - 160)
  await page.mouse.up()
  // Match 200% browser zoom on a 1440 × 900 display.
  const enlarged = await browser.newContext({
    viewport: { width: 720, height: 450 },
    deviceScaleFactor: 2,
    storageState: await page.context().storageState(),
  })
  try {
    const enlargedPage = await enlarged.newPage()
    enlargedPage.on('pageerror', error => errors.push(error.stack || error.message))
    enlargedPage.on('console', (message) => {
      if (message.type() === 'error')
        errors.push(message.text())
    })
    await enlargedPage.goto(ready.url)
    const enlargedAssets = enlargedPage.locator('[data-editor-region="bottom"] .project-assets')
    await enlargedAssets.evaluate(element => element.style.width = '320px')
    const scope = enlargedAssets.getByRole('button', { name: 'Browse scope', exact: true })
    await scope.click()
    const allAssets = enlargedPage.getByRole('menuitem', { name: 'All assets', exact: true })
    await expect(allAssets).toBeInViewport()
    await allAssets.click()
    await expect(scope).toHaveAttribute('title', 'Browse scope: All assets')
    await expect(scope).toHaveAttribute('aria-pressed', 'true')
    await expect(enlargedAssets).toHaveJSProperty('scrollWidth', 320)
    if (process.env.ADVJS_LAYOUT_SCREENSHOTS) {
      await expect(enlargedPage.locator('.ToastRoot')).toHaveCount(0)
      await enlargedAssets.screenshot({ path: join(process.env.ADVJS_LAYOUT_SCREENSHOTS, 'assets-200-percent-light-en.png') })
    }
  }
  finally {
    await enlarged.close()
  }
  expect(errors).toEqual([])
})
