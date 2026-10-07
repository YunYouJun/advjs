import type { ElectronApplication, Page } from '@playwright/test'
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import process from 'node:process'
import { _electron, expect, test } from '@playwright/test'

const repo = resolve(import.meta.dirname, '../../..')

async function ready(page: Page) {
  await expect(page.locator('.ae-editor-splash')).toHaveCount(0)
  await expect(page.locator('.advjs-editor-layout, .project-welcome.is-full-page')).toBeVisible()
}

test('shows desktop history, reopens by identity, and persists removals without deleting files', async ({ browserName }, testInfo) => {
  test.skip(browserName !== 'chromium', 'Electron uses Chromium')
  const workspace = await realpath(await mkdtemp(resolve(tmpdir(), 'advjs-recent-projects-')))
  const projectName = '创作-project-with-a-long-name'
  const root = resolve(workspace, projectName)
  const other = resolve(workspace, 'other', projectName)
  const legacy = resolve(workspace, '旧项目')
  const userData = resolve(workspace, 'host')
  const fixture = resolve(repo, 'tests/launch/fixtures/golden-project')
  for (const path of [root, other, legacy])
    await cp(fixture, path, { recursive: true })
  await mkdir(userData, { recursive: true })
  await writeFile(resolve(userData, 'editor-preferences.json'), JSON.stringify({ locale: 'zh-CN', onboarded: true }))
  await writeFile(resolve(userData, 'recent-projects.json'), JSON.stringify([
    { id: 'other', name: projectName, path: other, lastOpenedAt: Date.now() - 86_400_000 },
    { id: 'legacy', name: '旧项目', path: legacy },
  ]))
  let app: ElectronApplication | undefined
  const errors: string[] = []
  async function launch(project?: string) {
    app = await _electron.launch({
      ...(process.env.ADVJS_DESKTOP_EXECUTABLE ? { executablePath: process.env.ADVJS_DESKTOP_EXECUTABLE } : {}),
      cwd: workspace,
      args: [...(process.env.ADVJS_DESKTOP_EXECUTABLE ? [] : [resolve(repo, 'apps/desktop')]), ...(project ? [`--project=${project}`] : [])],
      env: { ...process.env, NODE_OPTIONS: '', ADVJS_DESKTOP_TEST_DATA: userData },
    })
    const page = await app.firstWindow()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' || /^(?:data|blob):/u.test(route.request().url()) ? route.continue() : route.abort())
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({ response: 0, checkboxChecked: false })
    })
    await ready(page)
    expect(new URL(page.url()).hostname).toBe('127.0.0.1')
    await expect(page).toHaveTitle(/ADV.JS/)
    await expect(page.locator('vite-error-overlay')).toHaveCount(0)
    return page
  }
  async function closeProject(page: Page) {
    const previous = page.url()
    await page.evaluate(() => {
      void window.advDesktop!.closeProject()
    })
    await page.waitForURL(url => url.href !== previous)
    await ready(page)
  }
  try {
    let page = await launch(root)
    const history = await page.evaluate(() => window.advDesktop!.recentProjects())
    expect(history.map(item => item.path)).toEqual([root, other, legacy])
    expect(history[0].lastOpenedAt).toBeGreaterThan(0)
    if (process.platform === 'darwin') {
      const labels = await app!.evaluate(({ Menu }) => Menu.getApplicationMenu()!.getMenuItemById('desktop.recent')!.submenu!.items.map(item => item.label))
      expect(labels.filter(label => label === projectName)).toHaveLength(2)
      await expect(page.getByRole('button', { name: '最近项目', exact: true })).toHaveCount(0)
    }
    else {
      await page.getByRole('button', { name: '最近项目', exact: true }).click()
      await expect(page.getByRole('menuitem', { name: projectName, exact: true })).toHaveCount(2)
      await page.keyboard.press('Escape')
    }
    await closeProject(page)
    const game = page.getByRole('tabpanel', { name: '游戏', exact: true })
    const welcome = page.getByRole('region', { name: '欢迎页', exact: true })
    await expect(page.locator('.project-start')).toHaveCount(1)
    await expect(welcome).toBeVisible()
    await expect(game).toHaveCount(0)
    await expect(page.getByRole('button', { name: '创建示例项目', exact: true })).toBeVisible()
    for (const mode of ['dark', 'light']) {
      await page.evaluate(mode => localStorage.setItem('nuxt-color-mode', mode), mode)
      await page.reload()
      await ready(page)
      await page.screenshot({ path: testInfo.outputPath(`welcome-${mode}.png`), animations: 'disabled' })
      await welcome.evaluate((element) => {
        element.style.width = '320px'
      })
      expect(await welcome.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
      await welcome.screenshot({ path: testInfo.outputPath(`welcome-narrow-${mode}.png`), animations: 'disabled' })
      await welcome.evaluate((element) => {
        element.style.removeProperty('width')
      })
    }
    const list = page.getByRole('region', { name: '最近打开的项目' })
    await expect(list.getByRole('listitem')).toHaveCount(3)
    await expect(list.getByRole('listitem').first()).toContainText(root)
    await expect(list.getByTitle(legacy)).not.toContainText('1970')
    await page.screenshot({ path: testInfo.outputPath('recent-desktop.png'), animations: 'disabled' })
    await welcome.evaluate((element) => {
      element.style.maxWidth = '320px'
    })
    await list.getByTitle(root, { exact: true }).focus()
    await page.screenshot({ path: testInfo.outputPath('recent-narrow.png'), animations: 'disabled' })
    expect(await list.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    await list.getByRole('button', { name: '移除 旧项目', exact: true }).click()
    await expect(list.getByRole('listitem')).toHaveCount(2)
    expect(await readFile(resolve(legacy, 'adv.config.json'), 'utf8')).toBeTruthy()
    const saved = JSON.parse(await readFile(resolve(userData, 'recent-projects.json'), 'utf8'))
    expect(saved.map((item: { path: string }) => item.path)).toEqual([root, other])
    await expect(page.evaluate(() => window.advDesktop!.removeRecent('../escape'))).rejects.toThrow('Unknown recent project')
    await welcome.evaluate(element => element.style.removeProperty('width'))
    const previous = page.url()
    await list.getByTitle(other, { exact: true }).click()
    await page.waitForURL(url => url.href !== previous)
    await ready(page)
    expect((await page.evaluate(() => window.advDesktop!.session())).root).toBe(other)
    await expect(game.locator('.preview-empty')).toHaveCount(0)
    await expect(game.getByRole('button', { name: '从已保存项目启动游戏预览', exact: true })).toBeVisible()
    expect((await page.evaluate(() => window.advDesktop!.recentProjects())).map(item => item.path)).toEqual([other, root])
    await app!.close()
    app = undefined
    page = await launch()
    expect((await page.evaluate(() => window.advDesktop!.session())).root).toBe(other)
    await closeProject(page)
    const reloaded = page.getByRole('region', { name: '最近打开的项目' }).last()
    await expect(reloaded.getByRole('listitem')).toHaveCount(2)
    await reloaded.getByRole('button', { name: `移除 ${projectName}`, exact: true }).first().click()
    await expect(reloaded.getByRole('listitem')).toHaveCount(1)
    await reloaded.getByRole('button', { name: `移除 ${projectName}`, exact: true }).click()
    await expect(reloaded).toContainText('暂无最近项目')
    expect(await readFile(resolve(root, 'adv.config.json'), 'utf8')).toBeTruthy()
    expect(await readFile(resolve(other, 'adv.config.json'), 'utf8')).toBeTruthy()
    expect(errors).toEqual([])
  }
  finally {
    await app?.close()
    await rm(workspace, { recursive: true, force: true })
  }
})
