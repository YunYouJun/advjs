import type { Page } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { _electron, expect, test } from '@playwright/test'
import { waitForGamePreview } from './preview'

const repo = resolve(import.meta.dirname, '../../..')
async function geometry(player: Page) {
  return player.evaluate(() => {
    const header = document.querySelector('.adv-start-game-logo')?.getBoundingClientRect()
    const menu = document.querySelector('.start-menu')?.getBoundingClientRect()
    if (!header || !menu)
      return { gap: -1, buttons: [], overflow: false }
    const buttons = [...document.querySelectorAll('.start-menu-item')].map(button => ({ width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height, font: getComputedStyle(button).fontSize }))
    return { gap: menu.top - header.bottom, buttons, overflow: document.querySelector('.adv-start-shell')!.scrollWidth > innerWidth }
  })
}

test('start menu adapts and project theme overrides can be edited and copied for AI', async ({ browserName }, info) => {
  test.skip(browserName !== 'chromium', 'Electron uses Chromium')
  const workspace = await realpath(await mkdtemp(resolve(tmpdir(), 'advjs-theme-')))
  const root = resolve(workspace, 'theme-game')
  const host = resolve(workspace, 'host')
  await mkdir(host, { recursive: true })
  await writeFile(resolve(host, 'editor-preferences.json'), JSON.stringify({ locale: 'zh-CN', onboarded: true }))
  const template = JSON.parse(await readFile(resolve(repo, 'apps/desktop/dist/project-templates.json'), 'utf8')).find((item: any) => item.meta.id === 'starter')
  for (const file of template.files) {
    const path = resolve(root, file.name)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, file.encoding === 'base64' ? Buffer.from(file.content, 'base64') : file.content.replaceAll('{{projectName}}', '你好，ADV.JS'))
  }
  const app = await _electron.launch({
    ...(process.env.ADVJS_DESKTOP_EXECUTABLE ? { executablePath: process.env.ADVJS_DESKTOP_EXECUTABLE } : {}),
    cwd: workspace,
    args: [...(process.env.ADVJS_DESKTOP_EXECUTABLE ? [] : [resolve(repo, 'apps/desktop')]), `--project=${root}`],
    env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '', ADVJS_DESKTOP_TEST_DATA: host, ...(process.env.ADVJS_DESKTOP_EXECUTABLE ? { PATH: '/usr/bin:/bin' } : {}) },
  })
  let copied = ''
  const previousClipboard = await app.evaluate(({ clipboard }) => clipboard.readText())
  try {
    const editor = await app.firstWindow()
    await expect(editor.locator('.editor-status-bar')).toBeVisible()
    await editor.getByRole('button', { name: '启动预览', exact: true }).click()
    let player = await waitForGamePreview(app, editor)
    await expect(player.getByRole('heading', { name: '你好，ADV.JS', exact: true })).toBeVisible({ timeout: 120000 })
    await expect(player.locator('.adv-game-title')).toHaveCSS('font-size', '30px')
    await expect(player.locator('.adv-ripple')).toHaveCount(0)
    await expect(player.getByRole('button', { name: '旋转画面', exact: true })).toBeVisible()
    const wide = await geometry(player)
    expect(wide.gap).toBeCloseTo(36)
    expect(wide.buttons.every(button => button.width === wide.buttons[0]!.width && button.height >= 44 && button.font === '18px')).toBe(true)
    await player.screenshot({ path: info.outputPath('start-wide.png') })
    const panel = editor.locator('.desktop-game-preview')
    await panel.evaluate(element => element.style.width = '320px')
    await expect.poll(() => player.evaluate(() => innerWidth)).toBe(320)
    const contentWidth = await player.locator('.adv-start-shell').evaluate(element => element.clientWidth - Number.parseFloat(getComputedStyle(element).paddingLeft) - Number.parseFloat(getComputedStyle(element).paddingRight))
    await expect.poll(async () => (await geometry(player)).buttons[0]?.width).toBe(contentWidth)
    const narrow = await geometry(player)
    expect(narrow.overflow).toBe(false)
    expect(narrow.gap).toBeCloseTo(36)
    expect(contentWidth).toBeGreaterThan(260)
    expect(narrow.buttons.every(button => button.width === contentWidth && button.font === '18px')).toBe(true)
    await player.getByRole('button', { name: '帮助', exact: true }).scrollIntoViewIfNeeded()
    const help = await player.getByRole('button', { name: '帮助', exact: true }).boundingBox()
    const rotate = await player.getByRole('button', { name: '旋转画面', exact: true }).boundingBox()
    expect(help!.y + help!.height).toBeLessThan(rotate!.y)
    await player.screenshot({ path: info.outputPath('start-320.png') })
    await player.emulateMedia({ reducedMotion: 'reduce' })
    await expect(player.locator('.adv-start-panel')).toHaveCSS('animation-name', 'none')
    await player.getByRole('button', { name: '开始游戏', exact: true }).focus()
    await expect(player.getByRole('button', { name: '开始游戏', exact: true })).toHaveCSS('outline-style', 'solid')
    await panel.evaluate(element => element.style.removeProperty('width'))
    await expect.poll(() => player.evaluate(() => innerWidth)).toBeGreaterThan(600)
    await editor.getByRole('button', { name: '主题', exact: true }).click()
    const dialog = editor.getByRole('dialog', { name: '编辑游戏主题', exact: true })
    await expect(dialog.locator('code')).toHaveText('pages/start.vue')
    await dialog.getByLabel('给 AI 的修改需求', { exact: true }).fill('菜单移到左侧，保留窄屏布局。')
    await dialog.getByRole('button', { name: '复制主题上下文给 AI', exact: true }).click()
    await expect(dialog.getByRole('button', { name: '已复制', exact: true })).toBeVisible()
    copied = await app.evaluate(({ clipboard }) => clipboard.readText())
    expect(copied).toContain('菜单移到左侧，保留窄屏布局。')
    expect(copied).toContain('## components/start/StartMenu.vue')
    expect(copied).toContain('.adv-start-panel')
    expect(copied).not.toContain('这段旁白直接来自一个')
    await dialog.screenshot({ path: info.outputPath('theme-dialog.png') })
    await dialog.getByRole('button', { name: '创建覆盖并编辑', exact: true }).click()
    await expect(dialog).toHaveCount(0).catch(async () => {
      throw new Error(await dialog.textContent() ?? 'Theme dialog stayed open')
    })
    await expect.poll(() => editor.evaluate(() => (document.querySelector('#__nuxt') as any).__vue_app__.config.globalProperties.$pinia._s.get('file').openedFilePath)).toBe('pages/start.vue')
    expect(await readFile(resolve(root, 'components/start/StartMenu.vue'), 'utf8')).toContain('start-menu-inline')
    await editor.evaluate(() => {
      const pinia = (document.querySelector('#__nuxt') as any).__vue_app__.config.globalProperties.$pinia
      const monaco = pinia._s.get('@advjs/editor:monaco')
      monaco.fileContent = monaco.fileContent.replace('start-title-gap, 36px', 'start-title-gap, 52px')
    })
    await expect(editor.locator('.status-saved')).toHaveText('未保存')
    await editor.locator('.file-source').getByRole('button', { name: '保存', exact: true }).click()
    await expect.poll(() => readFile(resolve(root, 'pages/start.vue'), 'utf8')).toContain('start-title-gap, 52px')
    await editor.getByRole('tab', { name: '游戏', exact: true }).click()
    await expect(player.locator('.adv-start-panel')).toHaveCSS('gap', '52px', { timeout: 30000 })
    // A dirty draft must not be replaced by another theme source.
    await editor.evaluate(() => {
      const pinia = (document.querySelector('#__nuxt') as any).__vue_app__.config.globalProperties.$pinia
      pinia._s.get('@advjs/editor:monaco').fileContent += '\n<!-- unsaved draft -->'
    })
    await editor.getByRole('button', { name: '主题', exact: true }).click()
    await dialog.getByRole('combobox', { name: '主题文件', exact: true }).click()
    await editor.getByRole('option', { name: '菜单按钮', exact: true }).click()
    await dialog.getByRole('button', { name: '编辑代码', exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText('请先保存或放弃')
    await editor.keyboard.press('Escape')
    await editor.getByRole('tab', { name: '文件', exact: true }).click()
    await editor.locator('.file-source').getByRole('button', { name: '放弃修改', exact: true }).click()
    await editor.getByRole('tab', { name: '游戏', exact: true }).click()
    await editor.getByRole('button', { name: '主题', exact: true }).click()
    await dialog.getByRole('button', { name: '编辑代码', exact: true }).click()
    await expect.poll(() => editor.evaluate(() => (document.querySelector('#__nuxt') as any).__vue_app__.config.globalProperties.$pinia._s.get('file').openedFilePath)).toBe('components/start/StartMenu.vue')
    await editor.getByRole('tab', { name: '游戏', exact: true }).click()
    await editor.getByRole('button', { name: '主题', exact: true }).click()
    await dialog.getByRole('combobox', { name: '主题文件', exact: true }).click()
    await editor.getByRole('option', { name: '主题配置', exact: true }).click()
    await dialog.getByRole('button', { name: '创建覆盖并编辑', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect.poll(() => editor.evaluate(() => (document.querySelector('#__nuxt') as any).__vue_app__.config.globalProperties.$pinia._s.get('file').openedFilePath)).toBe('theme.config.json')
    await editor.evaluate(() => {
      const pinia = (document.querySelector('#__nuxt') as any).__vue_app__.config.globalProperties.$pinia
      pinia._s.get('@advjs/editor:monaco').fileContent = JSON.stringify({ ui: { colorScheme: 'light', tokens: { '--adv-theme-start-title-gap': '48px' } } }, null, 2)
    })
    await editor.locator('.file-source').getByRole('button', { name: '保存', exact: true }).click()
    await expect.poll(() => readFile(resolve(root, 'theme.config.json'), 'utf8')).toContain('48px')
    await editor.getByRole('tab', { name: '游戏', exact: true }).click()
    await player.goto(`${new URL(player.url()).origin}/#/start`)
    await expect(player.locator('[data-adv-ui="game"]')).toHaveAttribute('data-adv-color-scheme', 'light', { timeout: 30000 })
    await expect(player.locator('.adv-start-panel')).toHaveCSS('gap', '48px')
    await player.screenshot({ path: info.outputPath('start-custom-wide.png') })
    await panel.evaluate(element => element.style.width = '320px')
    await expect.poll(() => player.evaluate(() => innerWidth)).toBe(320)
    await player.screenshot({ path: info.outputPath('start-custom-320.png') })
    const settingsPath = resolve(root, 'adv/settings/game.json')
    const settings = await readFile(settingsPath, 'utf8')
    const longTitle = '很长的中文游戏名称 · An Adventure Beyond the Clouds'
    await writeFile(settingsPath, JSON.stringify({ ...JSON.parse(settings), title: longTitle }))
    await expect(player.getByRole('heading', { name: longTitle, exact: true })).toBeVisible({ timeout: 30000 })
    expect((await geometry(player)).overflow).toBe(false)
    await player.screenshot({ path: info.outputPath('start-long-title-320.png') })
    await writeFile(settingsPath, settings)
    await expect(player.getByRole('heading', { name: '你好，ADV.JS', exact: true })).toBeVisible()
    await panel.evaluate(element => element.style.removeProperty('width'))
    await expect.poll(async () => (await geometry(player)).buttons[0]?.width).toBe(300)
    const liveGeometry = await geometry(player)
    // The exported build must use the same overrides and responsive rules.
    await editor.getByRole('combobox', { name: '运行方式', exact: true }).click()
    await editor.getByRole('option', { name: '构建预览', exact: true }).click()
    player = await waitForGamePreview(app, editor)
    await expect(player.getByRole('heading', { name: '你好，ADV.JS', exact: true })).toBeVisible()
    expect(await geometry(player)).toEqual(liveGeometry)
    await writeFile(info.outputPath('theme.json'), JSON.stringify({ wide, narrow, clipboard: true, createOverride: true, savedSourceUpdates: true, dirtyDraftProtected: true, customThemeUpdates: true, buildMatchesLive: true }, null, 2))
  }
  finally {
    await (await app.firstWindow()).evaluate(() => window.advDesktop!.stopPreview()).catch(() => {})
    await app.evaluate(({ clipboard }, values) => {
      if (clipboard.readText() === values.copied)
        clipboard.writeText(values.previous)
    }, { copied, previous: previousClipboard })
    const exited = new Promise<void>(resolve => app.process().once('exit', () => resolve()))
    const terminate = setTimeout(() => app.process().kill('SIGKILL'), 5000)
    await app.evaluate(({ app }) => {
      setTimeout(() => app.exit(), 100)
    })
    await exited
    clearTimeout(terminate)
    await rm(workspace, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 })
  }
})
