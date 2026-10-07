import type { ElectronApplication } from '@playwright/test'
import { cp, mkdir, mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import process from 'node:process'
import { _electron, expect, test } from '@playwright/test'
import { waitForGamePreview } from './preview'

const repo = resolve(import.meta.dirname, '../../..')
const evidence = resolve(repo, 'apps/desktop/out/evidence')

async function select(app: ElectronApplication, id: string) {
  return app.evaluate(async ({ Menu, BrowserWindow }, id) => {
    const item = Menu.getApplicationMenu()!.getMenuItemById(id)!
    if (!item.enabled)
      throw new Error(`Disabled native action: ${id}`)
    return await item.click(item, BrowserWindow.getAllWindows()[0], {} as never)
  }, id)
}

test('macOS native menus replace the window menu and retain authoring actions on every route', async () => {
  test.skip(process.platform !== 'darwin', 'macOS native menu acceptance')
  const workspace = await realpath(await mkdtemp(resolve(tmpdir(), 'advjs-native-menu-')))
  const root = resolve(workspace, 'project')
  const second = resolve(workspace, 'second-project')
  const host = resolve(workspace, 'host')
  await cp(resolve(repo, 'tests/launch/fixtures/golden-project'), root, { recursive: true })
  await mkdir(resolve(root, 'adv/assets'), { recursive: true })
  await writeFile(resolve(root, 'adv/assets/room.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#345"/></svg>')
  await writeFile(resolve(root, 'adv/assets.json'), JSON.stringify({ schemaVersion: 2, id: 'rain', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'adv/assets' } }, assets: [{ id: 'room', kind: 'background', type: 'image', path: 'room.svg' }] }))
  const scene = resolve(root, 'adv/scenes/room.md')
  await writeFile(scene, (await readFile(scene, 'utf8')).replace('id: room', 'id: room\nassetId: room'))
  await cp(root, second, { recursive: true })
  await mkdir(host, { recursive: true })
  await writeFile(resolve(host, 'editor-preferences.json'), JSON.stringify({ locale: 'zh-CN', onboarded: true }))
  await mkdir(evidence, { recursive: true })
  const app = await _electron.launch({
    ...(process.env.ADVJS_DESKTOP_EXECUTABLE ? { executablePath: process.env.ADVJS_DESKTOP_EXECUTABLE } : {}),
    cwd: workspace,
    args: [...(process.env.ADVJS_DESKTOP_EXECUTABLE ? [] : [resolve(repo, 'apps/desktop')]), `--project=${root}`],
    env: { ...process.env, PATH: process.env.ADVJS_DESKTOP_EXECUTABLE ? '/usr/bin:/bin' : process.env.PATH, NODE_PATH: '', NODE_OPTIONS: '', ADVJS_DESKTOP_TEST_DATA: host },
  })
  try {
    const page = await app.firstWindow()
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
    await expect(page.locator('.advjs-editor-layout, .project-welcome.is-full-page')).toBeVisible()
    await expect(page.locator('.ae-editor-splash')).toHaveCount(0)
    expect(await page.evaluate(() => window.advDesktop!.nativeMenu)).toBe(true)
    await expect(page.getByRole('menubar')).toHaveCount(0)
    await expect(page.locator('.desktop-actions')).toHaveCount(0)
    await expect(page.locator('.desktop-project-status')).toHaveCount(0)
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.getTitle())).toBe('project — ADV.JS Editor')
    await expect(page.getByRole('button', { name: /^(Local workspace|Plugin commands|插件命令)$/ })).toHaveCount(0)
    const native = await app.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu()!
      return { labels: menu.items.map(item => item.label), preferencesShortcut: menu.getMenuItemById('desktop.preferences')!.accelerator, saveShortcut: menu.getMenuItemById('desktop.save')!.accelerator }
    })
    expect(native.labels).toEqual(expect.arrayContaining(['文件', '编辑', '故事', '视图', '窗口', '帮助']))
    expect(native.preferencesShortcut).toBe('CmdOrCtrl+,')
    expect(native.saveShortcut).toBe('CmdOrCtrl+S')
    expect(await page.locator('.advjs-editor-layout').evaluate(element => getComputedStyle(element).getPropertyValue('--agui-menu-bar-height').trim())).toBe('0px')

    await select(app, 'desktop.characters')
    await expect(page.getByPlaceholder('搜索角色...')).toBeVisible()
    await select(app, 'desktop.preferences')
    const preferences = page.getByRole('dialog', { name: '偏好设置', exact: true })
    await expect(preferences).toBeVisible()
    await preferences.getByRole('treeitem', { name: '界面', exact: true }).click()
    await preferences.getByRole('combobox', { name: '语言', exact: true }).click()
    await page.getByRole('option', { name: 'English', exact: true }).click()
    await expect.poll(() => app.evaluate(({ Menu }) => Menu.getApplicationMenu()!.getMenuItemById('desktop.open')!.label)).toBe('Open Project…')
    expect(JSON.parse(await readFile(resolve(host, 'editor-preferences.json'), 'utf8')).locale).toBe('en')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await select(app, 'desktop.about')
    await expect(page.getByRole('dialog', { name: 'About', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await select(app, 'desktop.codex-workflow')
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')

    await page.getByText('小雨', { exact: true }).first().click()
    await page.getByRole('button', { name: 'Edit', exact: true }).first().click()
    await page.locator('input[id$="-name"]').fill('Native menu saved character')
    await page.locator('input[id$="-aliases"]').fill('小雨')
    await app.evaluate(({ dialog }) => {
      (globalThis as any).nativeReloadGuards = 0
      dialog.showMessageBox = async () => {
        (globalThis as any).nativeReloadGuards++
        return { response: 1, checkboxChecked: false }
      }
    })
    await select(app, 'desktop.reload')
    expect(await app.evaluate(() => (globalThis as any).nativeReloadGuards)).toBe(1)
    await expect(page.locator('input[id$="-name"]')).toHaveValue('Native menu saved character')
    expect(await readFile(resolve(root, 'adv/characters/xiaoyu.character.md'), 'utf8')).not.toContain('Native menu saved character')
    await select(app, 'desktop.save')
    await expect.poll(() => readFile(resolve(root, 'adv/characters/xiaoyu.character.md'), 'utf8')).toContain('Native menu saved character')
    await select(app, 'desktop.workspace')
    await expect(page.locator('.advjs-editor-layout, .project-welcome.is-full-page')).toBeVisible()
    await select(app, 'desktop.project-settings')
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await select(app, 'desktop.extensions')
    await expect(page.getByRole('tab', { name: 'Plugins', exact: true }).first()).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('.editor-plugin-manager').getByRole('button', { name: 'Plugin commands', exact: true })).toBeVisible()
    await page.locator('.editor-plugin-manager').getByRole('button', { name: 'Plugin commands', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Check again', exact: true }).click()
    await select(app, 'desktop.reset-layout')

    const previousSession = await page.evaluate(() => window.advDesktop!.session())
    await select(app, 'desktop.reconnect')
    await expect.poll(() => page.evaluate(async () => (await window.advDesktop!.session()).token)).not.toBe(previousSession.token)
    expect((await page.evaluate(() => window.advDesktop!.session())).root).toBe(root)

    const captures = []
    for (const [mode, width, height] of [['dark', 1440, 900], ['light', 800, 600]] as const) {
      await page.evaluate(mode => localStorage.setItem('nuxt-color-mode', mode), mode)
      await app.evaluate(({ BrowserWindow }, { width, height }) => BrowserWindow.getAllWindows()[0]!.setContentSize(width, height), { width, height })
      await page.reload()
      await expect(page.locator('.advjs-editor-layout, .project-welcome.is-full-page')).toBeVisible()
      await expect(page.locator('.ae-editor-splash')).toHaveCount(0)
      await expect(page.getByRole('menubar')).toHaveCount(0)
      await page.screenshot({ path: resolve(evidence, `native-menu-${mode}-${width}.png`) })
      const geometry = await page.locator('main.has-native-menu').evaluate(element => ({ height: element.getBoundingClientRect().height, viewport: innerHeight, overflow: element.scrollHeight > element.clientHeight }))
      expect(geometry.height + (await page.locator('.editor-status-bar').boundingBox())!.height).toBe(geometry.viewport)
      expect(geometry.overflow).toBe(false)
      const status = page.locator('.editor-status-bar')
      await status.evaluate((element) => {
        element.style.width = '320px'
      })
      expect(await status.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
      await status.screenshot({ path: resolve(evidence, `native-menu-status-${mode}-320.png`) })
      await status.evaluate((element) => {
        element.style.removeProperty('width')
      })
      captures.push({ mode, width, height, ...geometry })
    }

    await select(app, 'desktop.preview-window')
    const preview = await waitForGamePreview(app, page)
    await preview.waitForLoadState()
    expect(await preview.evaluate(() => typeof window.advDesktop)).toBe('undefined')
    await expect(page.locator('.status-task')).toContainText('Live preview · Running')
    // A focused preview targets its project, even after an empty editor was active.
    const emptyOpened = app.waitForEvent('window')
    await select(app, 'desktop.new-window')
    const empty = await emptyOpened
    await expect(empty.locator('.editor-status-bar')).toBeVisible()
    await expect.poll(() => app.evaluate(({ Menu }) => Menu.getApplicationMenu()!.getMenuItemById('desktop.save')!.enabled)).toBe(false)
    await app.evaluate(({ BrowserWindow }, url) => {
      BrowserWindow.getAllWindows().find(window => window.contentView.children.some(view => 'webContents' in view && (view as any).webContents.getURL() === url))!.focus()
    }, preview.url())
    await expect.poll(() => app.evaluate(({ Menu }) => Menu.getApplicationMenu()!.getMenuItemById('desktop.save')!.enabled)).toBe(true)
    await select(app, 'desktop.preview')
    await expect.poll(() => page.evaluate(async () => (await window.advDesktop!.status()).preview?.mode)).toBe('embedded')
    expect((await empty.evaluate(() => window.advDesktop!.status())).preview?.active).toBe(false)
    const emptyWindow = await app.browserWindow(empty)
    await emptyWindow.evaluate(window => window.close())
    await expect.poll(() => app.windows().includes(empty)).toBe(false)
    await emptyWindow.dispose()
    await select(app, 'desktop.stop-preview')
    await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1)

    await app.evaluate(({ dialog, shell }) => {
      (globalThis as any).nativeMenuCalls = { saves: 0, help: [] }
      dialog.showSaveDialog = async () => {
        (globalThis as any).nativeMenuCalls.saves++
        return { canceled: true, filePath: undefined }
      }
      shell.openExternal = async (url) => {
        (globalThis as any).nativeMenuCalls.help.push(url)
      }
    })
    await select(app, 'desktop.export-directory')
    await select(app, 'desktop.export-zip')
    await select(app, 'desktop.help.documentation')
    await expect.poll(() => app.evaluate(() => (globalThis as any).nativeMenuCalls)).toEqual({ saves: 2, help: ['https://docs.advjs.org'] })

    await app.evaluate(({ dialog }, root) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: root })
    }, root)
    await select(app, 'desktop.export-directory')
    await expect(page.locator('.ToastRoot').last()).toBeVisible()
    await expect(page.locator('.ToastRoot').last()).toContainText('导出目标不能覆盖项目、应用或工作目录')

    await app.evaluate(({ dialog }, second) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [second] })
    }, second)
    const beforeOpen = page.url()
    await select(app, 'desktop.open-current')
    await page.waitForURL(url => url.href !== beforeOpen)
    await expect(page.locator('.advjs-editor-layout, .project-welcome.is-full-page')).toBeVisible()
    expect((await page.evaluate(() => window.advDesktop!.session())).root).toBe(second)
    // Recent entries update after the previous project service has stopped.
    await expect.poll(() => app.evaluate(({ Menu }) => Menu.getApplicationMenu()!.getMenuItemById('desktop.recent')!.submenu!.items[0]!.label)).toBe('second-project')
    const recentId = await app.evaluate(({ Menu }) => Menu.getApplicationMenu()!.getMenuItemById('desktop.recent')!.submenu!.items.find(item => item.label === 'project')!.id)
    const beforeRecent = page.url()
    await page.evaluate((id) => {
      void window.advDesktop!.openRecent(id.replace('desktop.recent.', ''), 'current')
    }, recentId)
    await page.waitForURL(url => url.href !== beforeRecent)
    await expect(page.locator('.advjs-editor-layout, .project-welcome.is-full-page')).toBeVisible()
    expect((await page.evaluate(() => window.advDesktop!.session())).root).toBe(root)
    await expect.poll(() => app.evaluate(({ Menu }) => Menu.getApplicationMenu()!.getMenuItemById('desktop.recent')!.submenu!.items[0]!.label)).toBe('project')
    const beforeClose = page.url()
    await select(app, 'desktop.close-project')
    await page.waitForURL(url => url.href !== beforeClose)
    await expect(page.locator('.advjs-editor-layout, .project-welcome.is-full-page')).toBeVisible()
    expect((await page.evaluate(() => window.advDesktop!.session())).root).toBeUndefined()
    await expect.poll(() => app.evaluate(({ Menu }) => Menu.getApplicationMenu()!.getMenuItemById('desktop.save')!.enabled)).toBe(false)
    for (const id of ['save', 'reconnect', 'preview', 'export-directory', 'export-zip'])
      expect(await app.evaluate(({ Menu }, id) => Menu.getApplicationMenu()!.getMenuItemById(`desktop.${id}`)!.enabled, id)).toBe(false)
    await select(app, 'desktop.preferences')
    await expect(page.getByRole('dialog', { name: 'Preferences', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await writeFile(resolve(evidence, 'native-menu.json'), JSON.stringify({ packaged: !!process.env.ADVJS_DESKTOP_EXECUTABLE, native, captures, noWindowMenu: true, directRouteDialogs: true, localeSynced: true, realDiskSave: true, guardedReloadCancellation: true, sandboxedNativePreview: true, openRecentClose: true, exportCancellation: true, fixedExternalHelp: true }, null, 2))
  }
  finally {
    await app.close()
  }
})
