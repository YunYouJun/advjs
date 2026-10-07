import { Buffer } from 'node:buffer'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { _electron, expect, test } from '@playwright/test'
import { waitForGamePreview } from './preview'

const repo = resolve(import.meta.dirname, '../../..')

test('embedded game settings follow native panel bounds and keep appearance controls in the header', async ({ browserName }, info) => {
  test.skip(browserName !== 'chromium', 'Electron uses Chromium')
  const workspace = await realpath(await mkdtemp(resolve(tmpdir(), 'advjs-settings-native-')))
  const root = resolve(workspace, '自适应游戏')
  const host = resolve(workspace, 'host')
  await mkdir(host, { recursive: true })
  await writeFile(resolve(host, 'editor-preferences.json'), JSON.stringify({ locale: 'zh-CN', onboarded: true }))
  const template = JSON.parse(await readFile(resolve(repo, 'apps/desktop/dist/project-templates.json'), 'utf8')).find((item: any) => item.meta.id === 'starter')
  for (const file of template.files) {
    const path = resolve(root, file.name)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, file.encoding === 'base64' ? Buffer.from(file.content, 'base64') : file.content.replaceAll('{{projectName}}', '自适应游戏'))
  }
  const original = await readFile(resolve(root, 'adv.config.json'), 'utf8')
  const app = await _electron.launch({
    ...(process.env.ADVJS_DESKTOP_EXECUTABLE ? { executablePath: process.env.ADVJS_DESKTOP_EXECUTABLE } : {}),
    cwd: workspace,
    args: [...(process.env.ADVJS_DESKTOP_EXECUTABLE ? [] : [resolve(repo, 'apps/desktop')]), `--project=${root}`],
    env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '', ADVJS_DESKTOP_TEST_DATA: host },
  })
  try {
    const editor = await app.firstWindow()
    await expect(editor.locator('.editor-status-bar')).toBeVisible()
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.setContentSize(1440, 1000))
    await editor.getByRole('button', { name: '启动预览', exact: true }).click()
    const player = await waitForGamePreview(app, editor)
    const settings = player.locator('[role="dialog"]').filter({ has: player.locator('.adv-settings-panel') })
    await expect(player.getByRole('heading', { name: '自适应游戏', exact: true })).toBeVisible()
    await player.getByRole('button', { name: /^(设置|Settings)$/ }).click()
    await expect(settings.getByRole('tab')).toHaveCount(4)
    await expect(settings.getByRole('tab', { name: /^(对白|Text)$/ })).toHaveCSS('font-size', '18px')
    await expect(settings.locator('.adv-menu-item--label').first()).toHaveCSS('font-size', '16px')
    await expect(settings.locator('.modal-container')).toHaveCSS('transform', 'none')
    const utilities = settings.locator('.adv-settings-utilities')
    const initialTab = await settings.getByRole('tab', { name: /^(对白|Text)$/ }).textContent()
    await expect(utilities.locator('button')).toHaveCount(2)
    await expect.poll(async () => {
      const header = await settings.locator('.adv-settings-header').boundingBox()
      const controls = await utilities.boundingBox()
      return controls!.y >= header!.y && controls!.y + controls!.height <= header!.y + header!.height
    }).toBe(true)
    await player.screenshot({ path: info.outputPath('settings-editor-wide.png') })
    await settings.getByRole('tab', { name: /^(音频|Audio)$/ }).click()
    const volume = settings.getByRole('spinbutton', { name: /^(音乐音量大小|Music Volume Level)$/ })
    const slider = settings.getByRole('slider', { name: /^(音乐音量大小|Music Volume Level)$/ })
    await slider.focus()
    await slider.press('ArrowRight')
    await expect(volume).toHaveValue('0.55')
    await slider.press('Home')
    await expect(volume).toHaveValue('0')
    await slider.press('End')
    await expect(volume).toHaveValue('1')
    await volume.fill('0.75')
    await expect(slider).toHaveAttribute('aria-valuenow', '0.75')
    await player.screenshot({ path: info.outputPath('settings-audio-wide.png') })
    const origin = new URL(player.url()).origin
    // This CSS changes the real docked surface, then the finite native API
    // resizes the existing WebContentsView; it does not resize a browser mock.
    await editor.evaluate(() => {
      const panel = document.querySelector<HTMLElement>('.desktop-game-preview')!
      panel.style.width = '320px'
      panel.style.height = '620px'
    })
    await expect.poll(() => player.evaluate(() => window.innerWidth)).toBe(320)
    await expect(settings.getByRole('tab', { name: /^(对白|Text)$/ })).toHaveCSS('font-size', '18px')
    await expect.poll(() => settings.locator('.modal-body').evaluate(el => Math.max(el.scrollWidth - el.clientWidth, el.scrollHeight - el.clientHeight))).toBeLessThanOrEqual(1)
    await expect(utilities.getByRole('button', { name: /切换深色模式|Toggle dark mode/i })).toBeInViewport({ ratio: 1 })
    await expect(utilities.getByRole('button', { name: /切换语言|Change languages/i })).toBeInViewport({ ratio: 1 })
    for (const tab of await settings.getByRole('tab').all()) {
      await expect(tab).toBeInViewport({ ratio: 1 })
      await tab.click()
      await expect(tab).toHaveAttribute('aria-selected', 'true')
      await expect(settings.getByRole('tabpanel')).toHaveCount(1)
      await expect.poll(() => settings.locator('.modal-body').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1)
      if (/^(?:音频|Audio)$/.test(await tab.textContent() ?? '')) {
        await expect(volume).toHaveValue('0.75')
        await player.screenshot({ path: info.outputPath('settings-audio-narrow.png') })
      }
    }
    await settings.getByRole('tab', { name: /^(对白|Text)$/ }).click()
    expect(new URL(player.url()).origin).toBe(origin)
    await player.screenshot({ path: info.outputPath('settings-editor-narrow.png') })
    const hostDark = await editor.locator('html').evaluate(el => el.classList.contains('dark'))
    await utilities.getByRole('button', { name: /切换深色模式|Toggle dark mode/i }).click()
    expect(await editor.locator('html').evaluate(el => el.classList.contains('dark'))).toBe(hostDark)
    await utilities.getByRole('button', { name: /切换语言|Change languages/i }).click()
    await expect(settings.getByRole('tab', { name: initialTab === '对白' ? 'Text' : '对白', exact: true })).toBeVisible()
    for (const tab of await settings.getByRole('tab').all())
      await expect(tab).toBeInViewport({ ratio: 1 })
    await expect.poll(() => settings.locator('.modal-body').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1)
    await player.screenshot({ path: info.outputPath('settings-editor-narrow-en.png') })
    expect(await readFile(resolve(root, 'adv.config.json'), 'utf8')).toBe(original)
  }
  finally {
    await app.evaluate(({ app }) => app.exit())
    await rm(workspace, { recursive: true, force: true })
  }
})
