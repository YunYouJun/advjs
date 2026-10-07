import type { ElectronApplication, Page } from '@playwright/test'
import { execFile } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { _electron, expect, test } from '@playwright/test'

const repo = resolve(import.meta.dirname, '../../..')
async function ready(page: Page) {
  await expect(page.locator('.ae-editor-splash')).toHaveCount(0)
  await expect(page.locator('.editor-status-bar')).toBeVisible()
}
async function picker(app: ElectronApplication, path: string, response = 0) {
  await app.evaluate(({ dialog }, { path, response }) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] })
    dialog.showMessageBox = async () => {
      (globalThis as any).guardCalls = ((globalThis as any).guardCalls ?? 0) + 1
      return { response, checkboxChecked: false }
    }
  }, { path, response })
}

test('isolates project windows, focuses canonical paths, guards close and restores workspace state', async ({ browserName }, testInfo) => {
  test.skip(browserName !== 'chromium', 'Electron uses Chromium')
  const workspace = await realpath(await mkdtemp(resolve(tmpdir(), 'advjs-windows-')))
  const a = resolve(workspace, '项目 A')
  const b = resolve(workspace, '项目 B')
  const c = resolve(workspace, '项目 C')
  const alias = resolve(workspace, '项目 A alias')
  const userData = resolve(workspace, 'host')
  for (const path of [a, b, c])
    await cp(resolve(repo, 'tests/launch/fixtures/golden-project'), path, { recursive: true })
  await symlink(a, alias, 'dir')
  await writeFile(resolve(a, 'adv/notes.md'), Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`).join('\n'))
  await mkdir(userData, { recursive: true })
  await writeFile(resolve(userData, 'editor-preferences.json'), JSON.stringify({ locale: 'zh-CN', onboarded: true }))
  let app: ElectronApplication | undefined
  const errors: string[] = []
  async function launch() {
    app = await _electron.launch({
      ...(process.env.ADVJS_DESKTOP_EXECUTABLE ? { executablePath: process.env.ADVJS_DESKTOP_EXECUTABLE } : {}),
      cwd: workspace,
      args: [...(process.env.ADVJS_DESKTOP_EXECUTABLE ? [] : [resolve(repo, 'apps/desktop')]), `--project=${a}`],
      env: { ...process.env, NODE_OPTIONS: '', ADVJS_DESKTOP_TEST_DATA: userData },
    })
    app.on('window', page => page.on('pageerror', error => errors.push(error.message)))
    const page = await app.firstWindow()
    await ready(page)
    return page
  }
  try {
    let first = await launch()
    const firstSession = await first.evaluate(() => window.advDesktop!.session())
    await picker(app!, b)
    const secondOpened = app!.waitForEvent('window')
    expect(await first.evaluate(() => window.advDesktop!.openProject())).toBe(true)
    const second = await secondOpened
    await ready(second)
    expect((await first.evaluate(() => window.advDesktop!.session())).root).toBe(a)
    const secondSession = await second.evaluate(() => window.advDesktop!.session())
    expect(secondSession.root).toBe(b)
    expect(secondSession.token).not.toBe(firstSession.token)
    expect(await fetch(`${secondSession.origin}/__advjs/api/project`, { headers: { authorization: `Bearer ${firstSession.token}` } }).then(response => response.status)).toBe(401)
    expect(await app!.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map(window => window.getTitle()).sort())).toEqual(['项目 A — ADV.JS Editor', '项目 B — ADV.JS Editor'])
    await expect(first.locator('.desktop-toolbar')).toHaveCount(0)

    await second.getByRole('button', { name: '切换项目', exact: true }).click()
    const switcher = second.getByRole('dialog', { name: '切换项目', exact: true })
    await expect(switcher.getByRole('region', { name: '已打开', exact: true }).getByRole('button')).toHaveCount(2)
    await expect(switcher.getByRole('region', { name: '最近使用', exact: true }).getByTitle(a, { exact: true })).toBeVisible()
    await switcher.screenshot({ path: testInfo.outputPath('project-switcher-dark.png') })
    await switcher.getByRole('region', { name: '已打开', exact: true }).getByTitle(a, { exact: true }).click()
    await expect.poll(() => app!.evaluate(({ BrowserWindow }) => BrowserWindow.getFocusedWindow()?.getTitle())).toBe('项目 A — ADV.JS Editor')
    await picker(app!, alias)
    expect(await second.evaluate(() => Promise.all([window.advDesktop!.openProject(), window.advDesktop!.openProject('current')]))).toEqual([true, true])
    expect(app!.windows()).toHaveLength(2)
    await promisify(execFile)(app!.process().spawnfile, [...(process.env.ADVJS_DESKTOP_EXECUTABLE ? [] : [resolve(repo, 'apps/desktop')]), `--project=${b}`], {
      env: { ...process.env, NODE_OPTIONS: '', ADVJS_DESKTOP_TEST_DATA: userData },
      timeout: 15000,
    })
    await expect.poll(() => app!.evaluate(({ BrowserWindow }) => BrowserWindow.getFocusedWindow()?.getTitle())).toBe('项目 B — ADV.JS Editor')
    expect(app!.windows()).toHaveLength(2)
    const focusedA = (await first.evaluate(() => window.advDesktop!.projects())).opened.find(item => item.current)!
    await first.evaluate(id => window.advDesktop!.focusProject(id), focusedA.id)

    // Persist actual file selection, panel selection, geometry and cursor changes.
    await first.evaluate(async () => {
      const pinia = (document.querySelector('#__nuxt') as any).__vue_app__.config.globalProperties.$pinia
      const project = pinia._s.get('@advjs/editor:project')
      const file = pinia._s.get('file')
      await file.setOpenedFileHandle(await project.getLocalFileHandle('adv/notes.md'), 'adv/notes.md')
      pinia._s.get('@advjs/editor:app').layout.children[0].size = 70
      pinia._s.get('@advjs/editor:app').layout.children[1].size = 30
    })
    await first.getByRole('tab', { name: '文件', exact: true }).click()
    await first.getByRole('tab', { name: '控制台', exact: true }).click()
    await expect(first.locator('.monaco-editor textarea')).toBeVisible()
    await expect(first.locator('.monaco-editor .view-lines')).toContainText('Line 3')
    await first.locator('.monaco-editor .view-lines').click({ position: { x: 50, y: 10 } })
    await first.keyboard.press(process.platform === 'darwin' ? 'Meta+ArrowUp' : 'Control+Home')
    await first.keyboard.press('ArrowDown')
    await first.keyboard.press('ArrowDown')
    await first.keyboard.press('ArrowRight')
    await expect(first.locator('.status-position')).toHaveText('行 3，列 2')
    await expect.poll(() => first.evaluate(async () => (await window.advDesktop!.workspaceState()).positions?.['adv/notes.md']?.lineNumber)).toBe(3)
    const savedState = await first.evaluate(() => window.advDesktop!.workspaceState())
    expect(savedState.openedFile).toBe('adv/notes.md')
    expect(savedState.activeViews?.bottom).toBe('advjs.core/console')
    expect(savedState.layout?.children?.[0]?.size).toBe(70)
    expect((await second.evaluate(() => window.advDesktop!.workspaceState())).openedFile).toBeFalsy()

    // Default open leaves unsaved source content intact; replacing/closing guards it.
    await first.keyboard.type('unsaved-')
    await expect(first.locator('.status-saved')).toHaveText('未保存')
    await expect.poll(() => first.evaluate(() => window.advDesktop!.status())).toMatchObject({ dirty: true })
    await picker(app!, c)
    const beforeOpenGuards = await app!.evaluate(() => (globalThis as any).guardCalls ?? 0)
    const thirdOpened = app!.waitForEvent('window')
    expect(await first.evaluate(() => window.advDesktop!.openProject())).toBe(true)
    const third = await thirdOpened
    await ready(third)
    expect(await app!.evaluate(() => (globalThis as any).guardCalls ?? 0)).toBe(beforeOpenGuards)
    expect((await first.evaluate(() => window.advDesktop!.status())).dirty).toBe(true)
    const thirdHandle = await app!.browserWindow(third)
    const thirdClosed = third.waitForEvent('close')
    await thirdHandle.evaluate(window => window.close())
    await thirdClosed
    await thirdHandle.dispose()
    await picker(app!, c, 1)
    expect(await first.evaluate(() => window.advDesktop!.openProject('current'))).toBe(false)
    expect((await first.evaluate(() => window.advDesktop!.session())).root).toBe(a)
    await picker(app!, b, 1)
    expect(await first.evaluate(() => window.advDesktop!.closeProject())).toBe(false)
    const guards = await app!.evaluate(() => (globalThis as any).guardCalls)
    await app!.evaluate(({ app }) => app.quit())
    await expect.poll(() => app!.evaluate(() => (globalThis as any).guardCalls)).toBeGreaterThan(guards)
    expect(app!.windows()).toHaveLength(2)
    const handle = await app!.browserWindow(first)
    await handle.evaluate(window => window.close())
    await expect.poll(() => app!.evaluate(() => (globalThis as any).guardCalls)).toBeGreaterThan(guards + 1)
    expect(app!.windows()).toHaveLength(2)
    await handle.dispose()
    await first.route('**/__advjs/api/changes', route => route.request().method() === 'POST' ? route.fulfill({ status: 500, body: '{"error":"disk-full"}', contentType: 'application/json' }) : route.continue())
    await picker(app!, b, 0)
    expect(await first.evaluate(() => window.advDesktop!.closeProject())).toBe(false)
    await expect(first.locator('.ToastRoot').filter({ hasText: '保存失败' })).toBeVisible()
    expect(app!.windows()).toHaveLength(2)
    await first.unroute('**/__advjs/api/changes')
    const oldURL = first.url()
    await first.evaluate(() => {
      void window.advDesktop!.closeProject()
    })
    await first.waitForURL(url => url.href !== oldURL)
    await ready(first)
    expect(await readFile(resolve(a, 'adv/notes.md'), 'utf8')).toContain('unsaved-')
    expect((await first.evaluate(() => window.advDesktop!.session())).root).toBeUndefined()
    // Empty window is reused and restores A independently from B.
    await picker(app!, a)
    const emptyURL = first.url()
    await first.evaluate(() => {
      void window.advDesktop!.openProject()
    })
    await first.waitForURL(url => url.href !== emptyURL)
    await ready(first)
    expect(app!.windows()).toHaveLength(2)
    await expect(first.getByRole('tab', { name: '文件', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(first.getByRole('tab', { name: '控制台', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(first.locator('.status-file')).toHaveText('adv/notes.md')
    await expect(first.locator('.status-position')).toContainText('行 3')

    // Closing a project releases its path; explicit current-window open replaces it.
    await second.evaluate(() => {
      void window.advDesktop!.closeProject()
    })
    await expect.poll(() => second.evaluate(async () => (await window.advDesktop!.session()).root).catch(() => 'loading')).toBeUndefined()
    await ready(second)
    await picker(app!, b)
    const beforeReplace = first.url()
    await first.evaluate(() => {
      void window.advDesktop!.openProject('current')
    })
    await first.waitForURL(url => url.href !== beforeReplace)
    await ready(first)
    expect((await first.evaluate(() => window.advDesktop!.session())).root).toBe(b)
    await expect(first.locator('.status-file')).toHaveCount(0)
    expect(app!.windows()).toHaveLength(2)
    await app!.close()
    app = undefined
    first = await launch()
    await expect(first.locator('.status-file')).toHaveText('adv/notes.md')
    await expect(first.locator('.status-position')).toContainText('行 3')
    expect(errors).toEqual([])
  }
  finally {
    await app?.close()
    await rm(workspace, { recursive: true, force: true })
  }
})

test('shows task errors in global toasts above the status bar with a copyable report', async ({ browserName }, testInfo) => {
  test.skip(browserName !== 'chromium', 'Electron uses Chromium')
  const workspace = await realpath(await mkdtemp(resolve(tmpdir(), 'advjs-status-')))
  const root = resolve(workspace, 'missing-resource-project')
  const host = resolve(workspace, 'host')
  await cp(resolve(repo, 'tests/launch/fixtures/golden-project'), root, { recursive: true })
  await writeFile(resolve(root, 'adv/assets.json'), JSON.stringify({ schemaVersion: 2, id: 'rain', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'adv/assets' } }, assets: [{ id: 'room', kind: 'background', type: 'image', path: 'room.svg' }] }))
  const scene = resolve(root, 'adv/scenes/room.md')
  await writeFile(scene, (await readFile(scene, 'utf8')).replace('id: room', 'id: room\nassetId: room'))
  await mkdir(resolve(root, 'adv/assets'), { recursive: true })
  await writeFile(resolve(root, 'adv/assets/room.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"/>')
  await mkdir(host, { recursive: true })
  await writeFile(resolve(host, 'editor-preferences.json'), JSON.stringify({ locale: 'zh-CN', onboarded: true }))
  const app = await _electron.launch({ cwd: workspace, args: [resolve(repo, 'apps/desktop'), `--project=${root}`], env: { ...process.env, NODE_OPTIONS: '', ADVJS_DESKTOP_TEST_DATA: host } })
  const previousClipboard = await app.evaluate(({ clipboard }) => clipboard.readText())
  try {
    const page = await app.firstWindow()
    await ready(page)
    await rm(resolve(root, 'adv/assets/room.svg'))
    await page.evaluate(() => window.advDesktop!.preview())
    const toast = page.locator('.ToastRoot').filter({ hasText: '构建失败' })
    await expect(toast).toBeVisible({ timeout: 60000 })
    await expect(toast).toContainText('Missing project resource')
    await expect(page.locator('.status-task')).toHaveText('预览 · 失败')
    await toast.getByRole('button', { name: '复制信息给 AI', exact: true }).click()
    const report = await app.evaluate(({ clipboard }) => clipboard.readText())
    expect(report).toContain('Missing project resource')
    expect(report).toContain('Environment:')
    expect(report).not.toContain((await page.evaluate(() => window.advDesktop!.session())).token)
    for (const [mode, width] of [['dark', 1440], ['light', 800]] as const) {
      await page.evaluate((mode) => {
        document.documentElement.classList.remove('light', 'dark')
        document.documentElement.classList.add(mode)
      }, mode)
      await page.setViewportSize({ width, height: 800 })
      const bar = (await page.locator('.editor-status-bar').boundingBox())!
      const notice = (await toast.boundingBox())!
      expect(bar.y + bar.height).toBe(800)
      expect(notice.y + notice.height).toBeLessThanOrEqual(bar.y)
      expect(await page.locator('.editor-status-bar').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
      await page.screenshot({ path: testInfo.outputPath(`toast-status-${mode}-${width}.png`) })
    }
    await toast.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(toast).toHaveCount(0)
    await page.locator('.status-task').click()
    const details = page.getByRole('dialog', { name: '任务详情与日志', exact: true })
    await expect(details).toContainText('Missing project resource')
    await details.getByRole('button', { name: '复制信息给 AI', exact: true }).click()
    await expect(details.getByRole('button', { name: '已复制，可粘贴给 AI' })).toBeVisible()
  }
  finally {
    await app.evaluate(({ clipboard }, previous) => clipboard.writeText(previous), previousClipboard)
    await app.close()
    await rm(workspace, { recursive: true, force: true })
  }
})
