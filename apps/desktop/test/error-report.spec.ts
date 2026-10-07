import type { ElectronApplication, Page } from '@playwright/test'
import { cp, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import process from 'node:process'
import { _electron, expect, test } from '@playwright/test'

const repo = resolve(import.meta.dirname, '../../..')
async function ready(page: Page) {
  await expect(page.locator('.ae-editor-splash')).toHaveCount(0)
  await expect(page.locator('.advjs-editor-layout, .project-welcome.is-full-page')).toBeVisible()
}

test('copies startup and console errors and native project failures as diagnostic reports', async ({ browserName }, testInfo) => {
  test.skip(browserName !== 'chromium', 'Electron uses Chromium')
  const workspace = await realpath(await mkdtemp(resolve(tmpdir(), 'advjs-error-report-')))
  const root = resolve(workspace, '排查测试项目')
  const userData = resolve(workspace, 'host')
  await cp(resolve(repo, 'tests/launch/fixtures/golden-project'), root, { recursive: true })
  await mkdir(userData, { recursive: true })
  await writeFile(resolve(userData, 'editor-preferences.json'), JSON.stringify({ locale: 'zh-CN', onboarded: true }))
  let app: ElectronApplication | undefined
  try {
    app = await _electron.launch({
      ...(process.env.ADVJS_DESKTOP_EXECUTABLE ? { executablePath: process.env.ADVJS_DESKTOP_EXECUTABLE } : {}),
      cwd: workspace,
      args: [...(process.env.ADVJS_DESKTOP_EXECUTABLE ? [] : [resolve(repo, 'apps/desktop')]), `--project=${root}`],
      env: { ...process.env, NODE_OPTIONS: '', ADVJS_DESKTOP_TEST_DATA: userData },
    })
    // Keep the user's clipboard inside the test process and restore it at exit.
    await app.evaluate(({ clipboard }) => {
      (globalThis as any).previousDiagnosticClipboard = clipboard.readText()
      clipboard.writeText('')
    })
    const page = await app.firstWindow()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' || /^(?:data|blob):/u.test(route.request().url()) ? route.continue() : route.abort())
    await ready(page)
    await page.route('**/__advjs/api/project', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'diagnostic-project-read-failed' }) }))
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('alert')).toContainText('diagnostic-project-read-failed')
    await page.getByRole('button', { name: '复制错误信息', exact: true }).click()
    await expect(page.getByRole('button', { name: '已复制，可粘贴给 AI', exact: true })).toBeVisible()
    const startupReport = await app.evaluate(({ clipboard }) => clipboard.readText())
    for (const detail of ['Startup: workspace', 'diagnostic-project-read-failed', 'Version:', 'Environment:', 'stack', '排查测试项目'])
      expect(startupReport).toContain(detail)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.screenshot({ path: testInfo.outputPath('copy-error-desktop.png'), animations: 'disabled' })
    await page.setViewportSize({ width: 320, height: 600 })
    await page.screenshot({ path: testInfo.outputPath('copy-error-narrow.png'), animations: 'disabled' })
    expect(await page.locator('.ae-splash-content').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    await page.unroute('**/__advjs/api/project')
    await page.getByRole('button', { name: '重试', exact: true }).click()
    await ready(page)
    await page.setViewportSize({ width: 1440, height: 900 })

    await page.evaluate(() => {
      const pinia = (document.querySelector('#__nuxt') as any).__vue_app__.config.globalProperties.$pinia
      pinia._s.get('@advjs/editor/console').error('diagnostic-console-write-failed', { error: new Error('Disk is full'), path: 'adv/chapters/intro.adv.md', apiKey: 'test-api-secret' })
    })
    await page.getByRole('tab', { name: '控制台', exact: true }).click()
    const notices = page.locator('.ToastRoot').getByRole('button', { name: 'Close', exact: true })
    while (await notices.count())
      await notices.last().click()
    const log = page.locator('.console-log').filter({ hasText: 'diagnostic-console-write-failed' })
    await log.getByRole('button', { name: '复制错误信息', exact: true }).click()
    const consoleReport = await app.evaluate(({ clipboard }) => clipboard.readText())
    for (const detail of ['Editor console', 'diagnostic-console-write-failed', 'Disk is full', 'adv/chapters/intro.adv.md', 'stack'])
      expect(consoleReport).toContain(detail)
    expect(consoleReport).not.toContain('test-api-secret')
    await page.getByRole('button', { name: '复制日志给 AI', exact: true }).click()
    expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toContain('diagnostic-console-write-failed')
    expect((await page.locator('.console-toolbar').boundingBox())!.height).toBeLessThanOrEqual(40)
    await page.screenshot({ path: testInfo.outputPath('copy-console-desktop.png'), animations: 'disabled' })
    await page.setViewportSize({ width: 320, height: 600 })
    await page.locator('.console-toolbar').getByRole('button').last().click()
    await page.screenshot({ path: testInfo.outputPath('copy-console-narrow.png'), animations: 'disabled' })
    expect(await page.locator('.editor-console').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    expect(await page.locator('.console-toolbar').evaluate(element => element.getBoundingClientRect().bottom <= element.parentElement!.getBoundingClientRect().bottom)).toBe(true)
    await page.setViewportSize({ width: 1440, height: 900 })

    await page.evaluate(async () => {
      const session = await window.advDesktop!.session()
      await window.advDesktop!.copyErrorReport(`Session credential: ${session.token}`)
    })
    expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toBe('Session credential: [redacted]')
    await app.evaluate(({ dialog }, missing) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [missing] })
      dialog.showMessageBox = async (_window, options) => {
        (globalThis as any).diagnosticDialogButtons = options.buttons
        return { response: 0, checkboxChecked: false }
      }
    }, resolve(workspace, 'missing-project'))
    expect(await page.evaluate(() => window.advDesktop!.openProject())).toBe(false)
    const notice = page.locator('.ToastRoot').filter({ hasText: '无法打开项目' })
    await expect(notice).toBeVisible()
    await notice.getByRole('button', { name: '复制信息给 AI', exact: true }).click()
    const nativeReport = await app.evaluate(({ clipboard }) => clipboard.readText())
    expect(nativeReport).toContain('无法打开项目')
    expect(nativeReport).toContain('missing-project')
    expect(nativeReport).toContain('Electron')
    expect((await page.evaluate(() => window.advDesktop!.session())).root).toBe(root)
  }
  finally {
    if (app) {
      await app.evaluate(({ clipboard }) => {
        clipboard.writeText((globalThis as any).previousDiagnosticClipboard ?? '')
      }).catch(() => {})
      await app.close()
    }
    await rm(workspace, { recursive: true, force: true })
  }
})
