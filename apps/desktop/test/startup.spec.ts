import type { ElectronApplication, Page } from '@playwright/test'
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import process from 'node:process'
import { _electron, chromium, expect, test } from '@playwright/test'
import { createEditorBridge } from 'advjs'

const repo = resolve(import.meta.dirname, '../../..')
const evidence = resolve(repo, 'apps/desktop/out/evidence')

function gate() {
  let release!: () => void
  let entered!: () => void
  const pending = new Promise<void>((done) => {
    release = done
  })
  const requested = new Promise<void>((done) => {
    entered = done
  })
  return { release, entered, pending, requested }
}

async function ready(page: Page) {
  await expect(page.locator('.ae-editor-splash')).toHaveCount(0)
  await expect(page.locator('.advjs-editor-layout, .project-welcome.is-full-page')).toBeVisible()
}

test('packaged startup waits for project and scene resources, reports errors and retries', async () => {
  const workspace = await mkdtemp(resolve(tmpdir(), 'advjs-startup-'))
  const root = resolve(workspace, 'project')
  const userData = resolve(workspace, 'host')
  await cp(resolve(repo, 'tests/launch/fixtures/golden-project'), root, { recursive: true })
  await mkdir(resolve(root, 'adv/assets'), { recursive: true })
  await writeFile(resolve(root, 'adv/assets/room.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#345"/></svg>')
  await writeFile(resolve(root, 'adv/assets.json'), JSON.stringify({ schemaVersion: 2, id: 'rain', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'adv/assets' } }, assets: [{ id: 'room', kind: 'background', type: 'image', path: 'room.svg' }] }))
  const scene = resolve(root, 'adv/scenes/room.md')
  await writeFile(scene, (await readFile(scene, 'utf8')).replace('id: room', 'id: room\nassetId: room'))
  await mkdir(userData, { recursive: true })
  await writeFile(resolve(userData, 'editor-preferences.json'), JSON.stringify({ locale: 'zh-CN', onboarded: true }))
  await mkdir(evidence, { recursive: true })
  let app: ElectronApplication | undefined
  let projectGate: ReturnType<typeof gate> | undefined
  let assetGate: ReturnType<typeof gate> | undefined
  try {
    app = await _electron.launch({
      ...(process.env.ADVJS_DESKTOP_EXECUTABLE ? { executablePath: process.env.ADVJS_DESKTOP_EXECUTABLE } : {}),
      cwd: workspace,
      args: [...(process.env.ADVJS_DESKTOP_EXECUTABLE ? [] : [resolve(repo, 'apps/desktop')]), `--project=${root}`],
      env: { ...process.env, PATH: process.env.ADVJS_DESKTOP_EXECUTABLE ? '/usr/bin:/bin' : process.env.PATH, NODE_PATH: '', NODE_OPTIONS: '', ADVJS_DESKTOP_TEST_DATA: userData },
    })
    const page = await app.firstWindow()
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
    await ready(page)
    await page.route('**/__advjs/api/project', async (route) => {
      const hold = projectGate
      hold?.entered()
      await hold?.pending
      await route.continue()
    })
    await page.route('**/__advjs/api/asset**', async (route) => {
      const hold = assetGate
      hold?.entered()
      await hold?.pending
      await route.continue()
    })
    const captures = []
    for (const mode of ['dark', 'light']) {
      for (const [name, width, height] of [['desktop', 1440, 900], ['narrow', 320, 600]] as const) {
        await page.evaluate(mode => localStorage.setItem('nuxt-color-mode', mode), mode)
        await page.setViewportSize({ width, height })
        projectGate = gate()
        assetGate = gate()
        await page.reload({ waitUntil: 'domcontentloaded' })
        await projectGate.requested
        const progress = page.getByRole('progressbar')
        await expect(progress).toHaveAttribute('aria-valuenow', '2')
        await expect(progress).toHaveAttribute('aria-valuemax', '3')
        await expect(page.getByRole('status')).toContainText('正在连接并读取项目数据')
        await expect(page.getByRole('menuitem')).toHaveCount(0)
        if (captures.length === 0) {
          // Longer than the former fixed splash; elapsed time cannot mark it ready.
          await page.waitForTimeout(1500)
          await expect(progress).toHaveAttribute('aria-valuenow', '2')
          await expect(page.locator('.ae-editor-splash')).toBeVisible()
        }
        const colors = await page.locator('.ae-editor-splash').evaluate((element) => {
          const bar = element.querySelector('.ae-splash-progress')!
          return { background: getComputedStyle(element).backgroundColor, hostBackground: getComputedStyle(document.body).backgroundColor, overflow: element.scrollWidth > element.clientWidth, progress: (bar as HTMLElement).style.width }
        })
        expect(colors.background).toBe(colors.hostBackground)
        expect(colors.background).toBe(mode === 'dark' ? 'rgb(26, 26, 26)' : 'rgb(241, 241, 241)')
        expect(colors.overflow).toBe(false)
        expect(colors.progress).toBe('67%')
        await page.screenshot({ path: resolve(evidence, `startup-${mode}-${name}.png`) })
        projectGate.release()
        await assetGate.requested
        await expect(progress).toHaveAttribute('aria-valuenow', '2')
        await expect(page.getByRole('menuitem')).toHaveCount(0)
        assetGate.release()
        await ready(page)
        captures.push({ mode, width, height, ...colors })
      }
    }
    projectGate = undefined
    assetGate = undefined
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.route('**/__advjs/api/project', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Project read failed — test retry' }) }))
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('alert')).toContainText('Project read failed')
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')
    await expect(page.locator('.ae-editor-splash')).toHaveAttribute('aria-busy', 'false')
    expect(await page.locator('.ae-splash-progress').evaluate(element => getComputedStyle(element).animationName)).toBe('none')
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: '重试', exact: true })).toBeFocused()
    await page.screenshot({ path: resolve(evidence, 'startup-error-narrow.png') })
    await page.unroute('**/__advjs/api/project')
    await page.keyboard.press('Enter')
    await ready(page)
    expect(await app.evaluate(({ Menu }) => Menu.getApplicationMenu()!.getMenuItemById('desktop.open')!.label)).toBe('打开项目…')
    await expect(page.getByRole('menubar')).toHaveCount(0)
    const runtime = await app.evaluate(({ app }) => ({ packaged: app.isPackaged, platform: process.platform, arch: process.arch, path: process.env.PATH, cwd: process.cwd() }))
    if (process.env.ADVJS_DESKTOP_EXECUTABLE) {
      expect(runtime.packaged).toBe(true)
      expect(runtime.path).toBe('/usr/bin:/bin')
      expect(runtime.cwd).not.toBe(repo)
    }
    await writeFile(resolve(evidence, 'startup.json'), JSON.stringify({ date: '2026-10-07', runtime, captures, heldProjectAndSceneRequests: true, noTimerCompletion: true, failureAndKeyboardRetry: true, reducedMotion: true }, null, 2))
  }
  finally {
    projectGate?.release()
    assetGate?.release()
    if (app) {
      const completion = app.waitForEvent('close')
      await app.evaluate(({ app }) => app.quit())
      await completion
    }
  }
})

test('Web startup handles empty sessions, direct routes and project read failure', async () => {
  const workspace = await mkdtemp(resolve(tmpdir(), 'advjs-web-startup-'))
  await cp(resolve(repo, 'tests/launch/fixtures/golden-project'), workspace, { recursive: true })
  const bridge = await createEditorBridge({ projectRoot: workspace, publicRoot: resolve(repo, 'editor/core/dist'), port: 0 })
  const { url } = await bridge.start()
  const browser = await chromium.launch({ channel: process.env.ADVJS_WEB_CHANNEL ?? 'chrome' })
  try {
    const page = await browser.newPage()
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
    // No launch credentials means there is no project to preload.
    await page.goto(new URL(url).origin)
    await expect(page.locator('.ae-editor-splash')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Skip|跳过/ })).toBeVisible()
    await page.getByRole('button', { name: /Skip|跳过/ }).click()
    await ready(page)
    await page.route('**/__advjs/api/project', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Web project unavailable' }) }))
    // A direct character route uses the same root startup gate.
    const target = new URL(url)
    target.pathname = '/characters/xiaoyu'
    await page.goto(target.href)
    await expect(page.getByRole('alert')).toContainText('Web project unavailable')
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0)
    await page.unroute('**/__advjs/api/project')
    await page.getByRole('button', { name: 'Retry', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Edit', exact: true }).first()).toBeVisible()
    await expect(page.locator('.ae-editor-splash')).toHaveCount(0)
    await writeFile(resolve(evidence, 'startup-web.json'), JSON.stringify({ emptySession: true, directRoute: true, failureAndRetry: true, desktopApi: await page.evaluate(() => typeof window.advDesktop) }, null, 2))
  }
  finally {
    await browser.close()
    await bridge.stop()
  }
})
