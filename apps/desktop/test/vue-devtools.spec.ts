import { Buffer } from 'node:buffer'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { _electron, expect, test } from '@playwright/test'
import { waitForGamePreview } from './preview'

const repo = resolve(import.meta.dirname, '../../..')

test('editor toggles Vue DevTools in live preview and remembers the preference', async ({ browserName }, info) => {
  test.skip(browserName !== 'chromium', 'Electron uses Chromium')
  const workspace = await realpath(await mkdtemp(resolve(tmpdir(), 'advjs-editor-tools-')))
  const root = resolve(workspace, '游戏项目')
  const host = resolve(workspace, 'host')
  await mkdir(host, { recursive: true })
  await writeFile(resolve(host, 'editor-preferences.json'), JSON.stringify({ locale: 'zh-CN', onboarded: true }))
  const template = JSON.parse(await readFile(resolve(repo, 'apps/desktop/dist/project-templates.json'), 'utf8')).find((item: any) => item.meta.id === 'starter')
  for (const file of template.files) {
    const path = resolve(root, file.name)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, file.encoding === 'base64' ? Buffer.from(file.content, 'base64') : file.content.replaceAll('{{projectName}}', '调试故事'))
  }
  const originalConfig = await readFile(resolve(root, 'adv.config.json'), 'utf8')
  const launch = () => _electron.launch({
    ...(process.env.ADVJS_DESKTOP_EXECUTABLE ? { executablePath: process.env.ADVJS_DESKTOP_EXECUTABLE } : {}),
    cwd: workspace,
    args: [...(process.env.ADVJS_DESKTOP_EXECUTABLE ? [] : [resolve(repo, 'apps/desktop')]), `--project=${root}`],
    env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '', ADVJS_DESKTOP_TEST_DATA: host },
  })
  let app = await launch()
  try {
    let editor = await app.firstWindow()
    await expect(editor.locator('.editor-status-bar')).toBeVisible()
    const toggle = () => editor.getByRole('switch', { name: 'Vue DevTools', exact: true })
    await expect(toggle()).not.toBeChecked()
    await expect(editor.evaluate(() => window.advDesktop!.setPreferences({ previewVueDevtools: 'true' as never }))).rejects.toThrow('Invalid editor preferences')
    await editor.getByRole('button', { name: '启动预览', exact: true }).click()
    let player = await waitForGamePreview(app, editor)
    await expect(player.getByRole('heading', { name: '调试故事', exact: true })).toBeVisible()
    await expect(player.locator('#__vue-devtools-container__')).toHaveCount(0)
    const firstOrigin = new URL(player.url()).origin

    await toggle().click()
    await expect(toggle()).toBeChecked()
    player = await waitForGamePreview(app, editor)
    await expect(player.getByRole('heading', { name: '调试故事', exact: true })).toBeVisible()
    await expect(player.locator('#__vue-devtools-container__')).toHaveCount(1)
    await player.screenshot({ path: info.outputPath('vue-devtools-player.png') })
    await expect(player.locator('[aria-label="Toggle devtools panel"]')).toBeVisible({ timeout: 20000 })
    await player.locator('[aria-label="Toggle devtools panel"]').click()
    await expect(player.locator('iframe')).toBeVisible()
    await expect(player.frameLocator('iframe').locator('body')).not.toBeEmpty()
    await player.locator('[aria-label="Toggle devtools panel"]').click()
    await expect(player.getByRole('button', { name: 'ADV.JS DevTools', exact: true })).toHaveCount(0)
    expect(await fetch(firstOrigin).then(() => true).catch(() => false)).toBe(false)
    expect(JSON.parse(await readFile(resolve(host, 'editor-preferences.json'), 'utf8')).previewVueDevtools).toBe(true)
    await editor.locator('.desktop-game-preview').screenshot({ path: info.outputPath('vue-devtools-wide.png') })
    // Narrow the actual docked game panel while retaining the surrounding workspace.
    await editor.evaluate(() => {
      const panel = document.querySelector<HTMLElement>('.desktop-game-preview')!
      panel.style.width = '320px'
    })
    await editor.locator('.desktop-game-preview').screenshot({ path: info.outputPath('vue-devtools-narrow.png') })
    await expect(toggle()).toBeVisible()
    expect(await editor.locator('.desktop-game-preview').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    await editor.evaluate(() => document.querySelector<HTMLElement>('.desktop-game-preview')!.style.removeProperty('width'))

    // Restart the app to exercise reading the persisted host preference.
    await Promise.all([app.waitForEvent('close'), app.evaluate(({ app }) => app.quit())])
    app = await launch()
    editor = await app.firstWindow()
    await expect(editor.locator('.editor-status-bar')).toBeVisible()
    await expect(toggle()).toBeChecked()
    await editor.getByRole('button', { name: '启动预览', exact: true }).click()
    player = await waitForGamePreview(app, editor)
    await expect(player.locator('[aria-label="Toggle devtools panel"]')).toBeVisible({ timeout: 20000 })
    await toggle().focus()
    await editor.keyboard.press('Space')
    await expect(toggle()).not.toBeChecked()
    player = await waitForGamePreview(app, editor)
    await expect(player.getByRole('heading', { name: '调试故事', exact: true })).toBeVisible()
    await expect(player.locator('#__vue-devtools-container__')).toHaveCount(0)
    expect(JSON.parse(await readFile(resolve(host, 'editor-preferences.json'), 'utf8')).previewVueDevtools).toBe(false)
    await editor.getByRole('button', { name: '停止', exact: true }).click()
    await editor.getByRole('combobox', { name: '运行方式', exact: true }).click()
    await editor.getByRole('option', { name: '构建预览', exact: true }).click()
    await expect(toggle()).toBeDisabled()
    expect(await readFile(resolve(root, 'adv.config.json'), 'utf8')).toBe(originalConfig)
  }
  finally {
    await app.evaluate(({ app }) => app.exit())
    await rm(workspace, { recursive: true, force: true })
  }
})
