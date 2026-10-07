import { Buffer } from 'node:buffer'
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { _electron, expect, test } from '@playwright/test'
import { waitForGamePreview } from './preview'

const repo = resolve(import.meta.dirname, '../../..')
test('live preview follows saved content, recovers errors, moves one player and stops its service', async ({ browserName }, info) => {
  test.skip(browserName !== 'chromium', 'Electron uses Chromium')
  const workspace = await realpath(await mkdtemp(resolve(tmpdir(), 'advjs-live-')))
  const root = resolve(workspace, '实时预览')
  const host = resolve(workspace, 'host')
  await mkdir(host, { recursive: true })
  await writeFile(resolve(host, 'editor-preferences.json'), JSON.stringify({ locale: 'zh-CN', onboarded: true }))
  const template = JSON.parse(await readFile(resolve(repo, 'apps/desktop/dist/project-templates.json'), 'utf8')).find((item: any) => item.meta.id === 'starter')
  for (const file of template.files) {
    const path = resolve(root, file.name)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, file.encoding === 'base64' ? Buffer.from(file.content, 'base64') : file.content.replaceAll('{{projectName}}', '实时故事'))
  }
  await writeFile(resolve(root, 'index.html'), '<!-- author index stays intact -->')
  await writeFile(resolve(root, '.env'), 'PRIVATE_PREVIEW_TEST=hidden')
  const app = await _electron.launch({
    ...(process.env.ADVJS_DESKTOP_EXECUTABLE ? { executablePath: process.env.ADVJS_DESKTOP_EXECUTABLE } : {}),
    cwd: workspace,
    args: [...(process.env.ADVJS_DESKTOP_EXECUTABLE ? [] : [resolve(repo, 'apps/desktop')]), `--project=${root}`],
    env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '', ADVJS_DESKTOP_TEST_DATA: host, ...(process.env.ADVJS_DESKTOP_EXECUTABLE ? { PATH: '/usr/bin:/bin' } : {}) },
  })
  try {
    const editor = await app.firstWindow()
    await expect(editor.locator('.editor-status-bar')).toBeVisible()
    await expect(editor.getByRole('combobox', { name: '运行方式', exact: true })).toContainText('实时预览')
    await expect(editor.evaluate(() => window.advDesktop!.preview('url' as never))).rejects.toThrow('Invalid preview run mode')
    await editor.getByRole('button', { name: '启动预览', exact: true }).click()
    const player = await waitForGamePreview(app, editor)
    const errors: string[] = []
    player.on('pageerror', error => errors.push(error.message))
    await expect(player.getByRole('heading', { name: '实时故事', exact: true })).toBeVisible({ timeout: 120000 })
    const origin = new URL(player.url()).origin
    expect((await editor.evaluate(() => window.advDesktop!.status())).preview?.runMode).toBe('live')
    expect(await player.evaluate(() => [typeof window.advDesktop, typeof (window as any).require])).toEqual(['undefined', 'undefined'])
    const responses = await player.evaluate(async () => Promise.all(['/__advjs/editor/project', '/.env'].map(async path => (await fetch(path)).status)))
    expect(responses.every(status => status >= 400)).toBe(true)
    await player.locator('.start-menu-item').first().click()
    await expect(player.locator('.adv-black')).toContainText('这段旁白直接来自一个')
    await expect(player.getByRole('button', { name: 'Open runtime inspector', exact: true })).toHaveCount(0)
    const source = resolve(root, 'adv/chapters/hello.adv.md')
    const original = await readFile(source, 'utf8')
    // Unsaved text remains a draft. Save through the editor's real file protocol.
    await editor.getByRole('textbox', { name: '搜索项目文件', exact: true }).fill('hello.adv.md')
    await editor.getByRole('treeitem', { name: 'hello.adv.md', exact: true }).dblclick()
    await expect.poll(() => editor.evaluate(() => (document.querySelector('#__nuxt') as any).__vue_app__.config.globalProperties.$pinia._s.get('file').openedFilePath)).toBe('adv/chapters/hello.adv.md')
    await editor.evaluate(() => {
      const pinia = (document.querySelector('#__nuxt') as any).__vue_app__.config.globalProperties.$pinia
      const monaco = pinia._s.get('@advjs/editor:monaco')
      monaco.fileContent = monaco.fileContent.replace('这段旁白直接来自一个', '保存后实时更新')
    })
    await expect(editor.locator('.status-saved')).toHaveText('未保存')
    await expect(player.locator('.adv-black')).toContainText('这段旁白直接来自一个')
    await app.evaluate(({ Menu, BrowserWindow }) => {
      const item = Menu.getApplicationMenu()!.getMenuItemById('desktop.save')!
      item.click(item, BrowserWindow.getFocusedWindow()!, {} as never)
    })
    await expect.poll(() => readFile(source, 'utf8')).toContain('保存后实时更新')
    await expect(player.locator('.adv-black')).toContainText('保存后实时更新', { timeout: 30000 })
    expect(new URL(player.url()).origin).toBe(origin)
    await editor.getByRole('tab', { name: '游戏', exact: true }).click()
    const panel = editor.locator('.desktop-game-preview')
    await panel.screenshot({ path: info.outputPath('live-preview-wide.png') })
    await player.screenshot({ path: info.outputPath('live-player-wide.png') })
    const identity = await player.evaluate(() => ({ url: location.href, cursor: (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$adv.runtime.snapshot().cursor }))
    await editor.getByRole('combobox', { name: '预览位置', exact: true }).click()
    await editor.getByRole('option', { name: '独立窗口', exact: true }).click()
    await expect.poll(() => editor.evaluate(async () => (await window.advDesktop!.status()).preview?.mode)).toBe('window')
    expect(await player.evaluate(() => ({ url: location.href, cursor: (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$adv.runtime.snapshot().cursor }))).toEqual(identity)
    await writeFile(source, original.replace('这段旁白直接来自一个', '独立窗口自动更新'))
    await expect(player.locator('.adv-black')).toContainText('独立窗口自动更新', { timeout: 30000 })
    await editor.evaluate(() => window.advDesktop!.setPreviewPresentation('embedded'))
    await expect(editor.getByRole('combobox', { name: '预览位置', exact: true })).toContainText('编辑器内')
    await panel.evaluate(element => element.style.width = '320px')
    await expect.poll(() => player.evaluate(() => innerWidth)).toBe(320)
    expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    await panel.screenshot({ path: info.outputPath('live-preview-320.png') })
    await player.screenshot({ path: info.outputPath('live-player-320.png') })
    for (let i = 0; i < 5 && !await player.locator('.adv-dialog-box').isVisible(); i++) {
      await player.locator('.adv-black').click()
      await player.waitForTimeout(100)
    }
    await expect(player.locator('.dialog-content')).toHaveCSS('font-size', '20px')
    await expect(player.locator('.dialog-content')).toHaveCSS('line-height', '30px')
    await player.screenshot({ path: info.outputPath('live-dialogue-320.png') })
    await panel.evaluate(element => element.style.removeProperty('width'))
    await expect(player.locator('.dialog-content')).toHaveCSS('font-size', '22px')
    await expect(player.locator('.dialog-name')).toHaveCSS('font-size', '20px')
    await expect(player.locator('.dialog-content')).toHaveCSS('line-height', '33px')
    await player.screenshot({ path: info.outputPath('live-dialogue-wide.png') })
    const avatar = resolve(root, 'public/img/characters/xiaoyun.webp')
    const bytes = await readFile(avatar)
    await rm(avatar)
    await expect.poll(() => editor.evaluate(async () => (await window.advDesktop!.status()).preview?.error)).toContain('Missing project resource')
    await expect(editor.locator('.ToastRoot').filter({ hasText: '实时预览失败' })).toBeVisible()
    await writeFile(avatar, bytes)
    await expect.poll(() => editor.evaluate(async () => (await window.advDesktop!.status()).preview?.error)).toBeUndefined()
    // Executable entry configs cannot gain trust through automatic mirroring.
    await writeFile(resolve(root, 'vite.config.ts'), 'export default {}')
    await expect.poll(() => editor.evaluate(async () => (await window.advDesktop!.status()).preview?.active)).toBe(false)
    await expect(editor.evaluate(() => window.advDesktop!.preview('live'))).rejects.toThrow('可执行配置已变更')
    await rm(resolve(root, 'vite.config.ts'))
    // Restore the trusted baseline, then check switching to the static build.
    await editor.getByRole('combobox', { name: '运行方式', exact: true }).click()
    await editor.getByRole('option', { name: '构建预览', exact: true }).click()
    await editor.getByRole('button', { name: '启动预览', exact: true }).click()
    const built = await waitForGamePreview(app, editor)
    expect((await editor.evaluate(() => window.advDesktop!.status())).preview?.runMode).toBe('build')
    expect(await fetch(origin).then(() => true).catch(() => false)).toBe(false)
    const stop = editor.getByRole('button', { name: '停止', exact: true })
    await stop.click()
    await expect.poll(() => app.context().pages().includes(player)).toBe(false)
    await expect.poll(() => readdir(host).then(names => names.filter(name => name.startsWith('build-')))).toEqual([])
    expect(await fetch(origin).then(() => true).catch(() => false)).toBe(false)
    expect(await readFile(resolve(root, 'index.html'), 'utf8')).toBe('<!-- author index stays intact -->')
    expect(await readFile(resolve(root, '.env'), 'utf8')).toBe('PRIVATE_PREVIEW_TEST=hidden')
    expect(errors).toEqual([])
    await editor.evaluate(() => window.advDesktop!.preview('live'))
    await editor.evaluate(() => window.advDesktop!.cancelTask())
    await expect.poll(() => editor.evaluate(async () => (await window.advDesktop!.taskStatus())?.state)).toBe('cancelled')
    await expect.poll(() => readdir(host).then(names => names.filter(name => name.startsWith('build-')))).toEqual([])
    expect(app.context().pages().includes(built)).toBe(false)
    await writeFile(info.outputPath('live-preview.json'), JSON.stringify({ defaultLive: true, editorSaveAndExternalChanges: true, independentWindowUpdates: true, sandbox: true, sourceUnchanged: true, errorRecovery: true, serviceStopped: true }, null, 2))
  }
  finally {
    await app.evaluate(({ app }) => app.exit())
  }
})
