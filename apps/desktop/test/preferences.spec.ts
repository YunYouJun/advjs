import type { ElectronApplication, Page } from '@playwright/test'
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import process from 'node:process'
import { _electron, chromium, expect, test } from '@playwright/test'
import { createEditorBridge } from 'advjs'

const repo = resolve(import.meta.dirname, '../../..')
const evidence = resolve(repo, 'apps/desktop/out/evidence')

async function waitForEditor(page: Page) {
  await expect(page.getByRole('menuitem', { name: /^(File|文件)$/, includeHidden: true })).toBeVisible()
  await expect(page.locator('svg[role="img"][aria-label="ADV.JS"]')).toHaveCount(0)
}

async function captureSplash(page: Page, name: string) {
  // Hold a real project read so the splash remains visible until it completes.
  let release!: () => void
  const pending = new Promise<void>((done) => {
    release = done
  })
  const project = '**/__advjs/api/project'
  await page.route(project, async (route) => {
    await pending
    await route.continue()
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')
  const logo = page.getByRole('img', { name: 'ADV.JS', exact: true })
  await expect(logo).toBeVisible()
  expect(await logo.evaluate(element => element.tagName.toLowerCase())).toBe('svg')
  expect(await logo.evaluate(element => element.querySelector('path')!.getBBox().width)).toBeGreaterThan(0)
  await page.screenshot({ path: resolve(evidence, name) })
  release()
  await waitForEditor(page)
  await page.unroute(project)
}

test('desktop remembers language and onboarding across origins, projects and app restarts', async () => {
  const workspace = await mkdtemp(resolve(tmpdir(), 'advjs-preferences-'))
  const root = resolve(workspace, 'first-project')
  const second = resolve(workspace, 'second-project')
  const userData = resolve(workspace, 'host')
  await cp(resolve(repo, 'tests/launch/fixtures/golden-project'), root, { recursive: true })
  await cp(root, second, { recursive: true })
  await mkdir(evidence, { recursive: true })
  let app: ElectronApplication | undefined
  let page: Page
  async function launch() {
    app = await _electron.launch({
      ...(process.env.ADVJS_DESKTOP_EXECUTABLE ? { executablePath: process.env.ADVJS_DESKTOP_EXECUTABLE } : {}),
      cwd: workspace,
      args: [...(process.env.ADVJS_DESKTOP_EXECUTABLE ? [] : [resolve(repo, 'apps/desktop')]), `--project=${root}`],
      env: { ...process.env, PATH: process.env.ADVJS_DESKTOP_EXECUTABLE ? '/usr/bin:/bin' : process.env.PATH, NODE_PATH: '', NODE_OPTIONS: '', ADVJS_DESKTOP_TEST_DATA: userData },
    })
    page = await app.firstWindow()
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
    await waitForEditor(page)
  }
  async function quit() {
    const completion = app!.waitForEvent('close')
    await app!.evaluate(({ app }) => app.quit())
    await completion
    app = undefined
  }
  try {
    await launch()
    // Exercise the first-run language choice without pre-seeding WebStorage.
    await page!.getByRole('button', { name: '中文（简体）', exact: true }).click()
    await expect(page!.getByRole('menuitem', { name: '文件', exact: true })).toBeVisible()
    await expect(page!.getByText('选择你偏好的语言', { exact: true })).toHaveCount(0)
    expect(JSON.parse(await readFile(resolve(userData, 'editor-preferences.json'), 'utf8'))).toEqual({ locale: 'zh-CN', onboarded: true })
    await expect(page!.evaluate(() => window.advDesktop!.setPreferences({ locale: 'bad' as 'en' }))).rejects.toThrow('Invalid editor preferences')
    await expect(page!.evaluate(() => window.advDesktop!.setPreferences({ path: '/tmp' } as any))).rejects.toThrow('Invalid editor preferences')
    const firstOrigin = new URL(page!.url()).origin
    await captureSplash(page!, 'preferences-splash-desktop.png')
    await expect(page!.getByRole('menuitem', { name: '文件', exact: true })).toBeVisible()
    await expect(page!.getByRole('button', { name: /跳过|Skip/ })).toHaveCount(0)
    await app!.evaluate(({ dialog }, second) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [second] })
    }, second)
    await Promise.all([
      page!.waitForURL(url => url.origin !== firstOrigin),
      page!.evaluate(() => { void window.advDesktop!.openProject() }),
    ])
    await waitForEditor(page!)
    expect(new URL(page!.url()).origin).not.toBe(firstOrigin)
    await expect(page!.getByRole('menuitem', { name: '文件', exact: true })).toBeVisible()
    await expect(page!.getByRole('button', { name: /跳过|Skip/ })).toHaveCount(0)
    const secondOrigin = new URL(page!.url()).origin
    await quit()
    await launch()
    await expect(page!.getByRole('menuitem', { name: '文件', exact: true })).toBeVisible()
    await expect(page!.getByRole('button', { name: /跳过|Skip/ })).toHaveCount(0)
    // Preferences still restore on a route that never mounts the welcome page.
    await page!.goto(`${new URL(page!.url()).origin}/characters/xiaoyu`)
    await expect(page!.getByRole('button', { name: '编辑', exact: true }).first()).toBeVisible()
    await page!.goto(`${new URL(page!.url()).origin}/`)
    await page!.setViewportSize({ width: 800, height: 600 })
    await captureSplash(page!, 'preferences-splash-narrow.png')
    await writeFile(resolve(evidence, 'preferences.json'), JSON.stringify({ packaged: !!process.env.ADVJS_DESKTOP_EXECUTABLE, firstOrigin, secondOrigin, restartedOrigin: new URL(page!.url()).origin, locale: 'zh-CN', onboarded: true, inlineSvg: true }, null, 2))
  }
  finally {
    if (app)
      await quit()
  }
})

test('Web Editor restores language on reload and on a direct character route', async () => {
  const workspace = await mkdtemp(resolve(tmpdir(), 'advjs-web-preferences-'))
  await cp(resolve(repo, 'tests/launch/fixtures/golden-project'), workspace, { recursive: true })
  const bridge = await createEditorBridge({ projectRoot: workspace, publicRoot: resolve(repo, 'editor/core/dist'), port: 0 })
  const { url } = await bridge.start()
  const browser = await chromium.launch({ channel: process.env.ADVJS_WEB_CHANNEL ?? 'chrome' })
  try {
    const page = await browser.newPage()
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
    await page.goto(url)
    await waitForEditor(page)
    await page.getByRole('button', { name: '中文（简体）', exact: true }).click()
    await expect(page.getByRole('button', { name: /跳过|Skip/ })).toHaveCount(0)
    await page.reload()
    await waitForEditor(page)
    await expect(page.getByRole('menuitem', { name: '文件', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /跳过|Skip/ })).toHaveCount(0)
    await page.goto(`${new URL(url).origin}/characters`)
    await expect(page.getByPlaceholder('搜索角色...')).toBeVisible()
    await writeFile(resolve(evidence, 'preferences-web.json'), JSON.stringify({ locale: await page.evaluate(() => localStorage.getItem('advjs:editor:locale')), desktopApi: await page.evaluate(() => typeof window.advDesktop), restoredOnDirectRoute: true }, null, 2))
  }
  finally {
    await browser.close()
    await bridge.stop()
  }
})
