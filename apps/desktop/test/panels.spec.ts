import type { ElectronApplication } from '@playwright/test'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import process from 'node:process'
import { _electron, expect, test } from '@playwright/test'

const repo = resolve(import.meta.dirname, '../../..')

test('desktop character avatars load local public assets with consistent compact dimensions', async ({ browserName }, testInfo) => {
  test.skip(browserName !== 'chromium', 'Electron uses Chromium')
  const workspace = await mkdtemp(resolve(tmpdir(), 'advjs-character-avatars-'))
  const root = resolve(workspace, '中文 项目')
  const userData = resolve(workspace, 'host')
  let app: ElectronApplication | undefined
  try {
    await cp(resolve(repo, 'tests/launch/fixtures/golden-project'), root, { recursive: true })
    await mkdir(resolve(root, 'public/img/characters'), { recursive: true })
    const portrait = await readFile(resolve(repo, 'demo/starter/public/img/characters/xiaoyun.webp'))
    await writeFile(resolve(root, 'public/img/characters/xiaoyun.webp'), portrait)
    await writeFile(resolve(root, 'adv/assets.json'), JSON.stringify({ schemaVersion: 2, id: 'characters', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public/img/characters' } }, assets: [{ id: 'xiaoyun', kind: 'tachie', type: 'image', path: 'xiaoyun.webp' }] }))
    const source = '---\nid: xiaoyu\nname: 向导\navatar: /img/characters/xiaoyun.webp\naliases: [小云, 小雨]\n---\n'
    await writeFile(resolve(root, 'adv/characters/xiaoyu.character.md'), source)
    await mkdir(userData)
    await writeFile(resolve(userData, 'editor-preferences.json'), JSON.stringify({ locale: 'zh-CN', onboarded: true }))
    app = await _electron.launch({
      ...(process.env.ADVJS_DESKTOP_EXECUTABLE ? { executablePath: process.env.ADVJS_DESKTOP_EXECUTABLE } : {}),
      cwd: workspace,
      args: [...(process.env.ADVJS_DESKTOP_EXECUTABLE ? [] : [resolve(repo, 'apps/desktop')]), `--project=${root}`],
      env: { ...process.env, NODE_PATH: '', NODE_OPTIONS: '', ADVJS_DESKTOP_TEST_DATA: userData },
    })
    const page = await app.firstWindow()
    const errors: string[] = []
    const consoleErrors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error')
        consoleErrors.push(message.text())
    })
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' || /^(?:data|blob):/u.test(route.request().url()) ? route.continue() : route.abort())
    await expect(page.locator('.ae-editor-splash')).toHaveCount(0)
    await expect(page.locator('.advjs-editor-layout')).toBeVisible()
    expect(new URL(page.url()).hostname).toBe('127.0.0.1')
    await expect(page).toHaveTitle(/ADV\.JS/u)
    await expect(page.locator('vite-error-overlay')).toHaveCount(0)
    await page.setViewportSize({ width: 1440, height: 900 })
    const navigation = page.locator('[data-editor-region="navigation"]')
    const inspector = page.locator('[data-editor-region="inspector"]')
    await navigation.getByRole('tab', { name: '人物', exact: true }).click()
    const card = navigation.getByRole('button', { name: /向导/ })
    await card.focus()
    await card.press('Enter')
    await expect(card).toHaveAttribute('aria-pressed', 'true')
    const avatars = page.locator('.ae-character-avatar img')
    await expect(avatars).toHaveCount(2)
    await expect.poll(() => avatars.evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true)
    for (const avatar of await avatars.all()) {
      await expect(avatar).toHaveAttribute('src', /^blob:/u)
      expect(await avatar.evaluate(image => ({ width: image.clientWidth, height: image.clientHeight, fit: getComputedStyle(image).objectFit }))).toEqual({ width: 28, height: 28, fit: 'contain' })
    }
    await expect(page.locator('.ToastRoot').filter({ hasText: 'Project compilation failed' })).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath('avatars-dark-desktop.png') })
    await page.screenshot({ path: testInfo.outputPath('avatars-summary.png'), clip: { x: 0, y: 0, width: 1440, height: 180 } })

    // Resize both actual docked panels to 320px without changing their controls.
    for (const region of [navigation, inspector]) {
      const pane = region.locator('xpath=ancestor::div[contains(@class, "splitpanes__pane")][1]')
      await pane.evaluate((element) => {
        element.style.width = '320px'
        element.style.flex = '0 0 320px'
      })
      expect(Math.round((await region.boundingBox())!.width)).toBe(320)
      expect(await region.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    }
    await writeFile(resolve(root, 'adv/characters/xiaoyu.character.md'), source.replace('name: 向导', 'name: 向导小云与带有较长中文名称的人物'))
    await expect(card).toContainText('向导小云与带有较长中文名称的人物')
    await page.screenshot({ path: testInfo.outputPath('avatars-dark-narrow.png') })
    await page.screenshot({ path: testInfo.outputPath('avatars-narrow-summary.png'), clip: { x: 0, y: 0, width: 1440, height: 180 } })
    await navigation.getByRole('button', { name: '缩略图', exact: true }).click()
    await expect(navigation.locator('.ae-character-avatar.grid')).toBeVisible()
    expect(await navigation.locator('.ae-character-avatar img').evaluate(image => ({ height: image.clientHeight, fit: getComputedStyle(image).objectFit }))).toEqual({ height: 80, fit: 'contain' })
    await navigation.getByRole('button', { name: '列表', exact: true }).click()

    await page.evaluate(() => localStorage.setItem('nuxt-color-mode', 'light'))
    await page.reload()
    await expect(page.locator('.ae-editor-splash')).toHaveCount(0)
    await navigation.getByRole('tab', { name: '人物', exact: true }).click()
    await card.click()
    await expect.poll(() => avatars.evaluateAll(images => images.length === 2 && images.every(image => (image as HTMLImageElement).naturalWidth > 0))).toBe(true)
    await expect(page.locator('html')).toHaveClass(/editor-light/u)
    await page.screenshot({ path: testInfo.outputPath('avatars-light-desktop.png') })
    await writeFile(resolve(root, 'adv/characters/xiaoyu.character.md'), source.replace('name: 向导', 'name: Guide with a very long English character name'))
    await expect(navigation.getByRole('button', { name: /Guide with a very long/ })).toBeVisible()
    for (const region of [navigation, inspector]) {
      const pane = region.locator('xpath=ancestor::div[contains(@class, "splitpanes__pane")][1]')
      await pane.evaluate((element) => {
        element.style.width = '320px'
        element.style.flex = '0 0 320px'
      })
      expect(await region.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    }
    await page.screenshot({ path: testInfo.outputPath('avatars-light-narrow.png') })
    expect(consoleErrors).toEqual([])
    await writeFile(resolve(root, 'adv/characters/xiaoyu.character.md'), source.replace('/img/characters/xiaoyun.webp', '/img/missing.webp'))
    await expect(navigation.locator('.ae-character-avatar .i-ri-image-line')).toBeVisible()
    await expect(inspector.locator('.ae-character-avatar .i-ri-image-line')).toBeVisible()
    await expect(avatars).toHaveCount(0)
    await writeFile(resolve(root, 'adv/characters/xiaoyu.character.md'), source)
    await expect.poll(() => avatars.evaluateAll(images => images.length === 2 && images.every(image => (image as HTMLImageElement).naturalWidth > 0))).toBe(true)
    expect(errors).toEqual([])
  }
  finally {
    await app?.close()
    await rm(workspace, { recursive: true, force: true })
  }
})

test('desktop inspector renders with no online URL and switches between local files and context', async () => {
  const workspace = await mkdtemp(resolve(tmpdir(), 'advjs-desktop-panels-'))
  const root = resolve(workspace, '中文 项目')
  const userData = resolve(workspace, 'host')
  const evidence = resolve(repo, 'apps/desktop/out/evidence')
  let app: ElectronApplication | undefined
  try {
    await cp(resolve(repo, 'tests/launch/fixtures/golden-project'), root, { recursive: true })
    await mkdir(resolve(root, 'adv/assets'), { recursive: true })
    await writeFile(resolve(root, 'adv/assets/room.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#345"/></svg>')
    await writeFile(resolve(root, 'adv/assets.json'), JSON.stringify({ schemaVersion: 2, id: 'rain', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'adv/assets' } }, assets: [{ id: 'room', kind: 'background', type: 'image', path: 'room.svg' }] }))
    await mkdir(userData, { recursive: true })
    await writeFile(resolve(userData, 'editor-preferences.json'), JSON.stringify({ locale: 'zh-CN', onboarded: true }))
    await mkdir(evidence, { recursive: true })
    app = await _electron.launch({
      ...(process.env.ADVJS_DESKTOP_EXECUTABLE ? { executablePath: process.env.ADVJS_DESKTOP_EXECUTABLE } : {}),
      cwd: workspace,
      args: [...(process.env.ADVJS_DESKTOP_EXECUTABLE ? [] : [resolve(repo, 'apps/desktop')]), `--project=${root}`],
      env: { ...process.env, NODE_PATH: '', NODE_OPTIONS: '', ADVJS_DESKTOP_TEST_DATA: userData },
    })
    const page = await app.firstWindow()
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' || /^(?:data|blob):/u.test(route.request().url()) ? route.continue() : route.abort())
    await expect(page.locator('.ae-editor-splash')).toHaveCount(0)
    await expect(page.locator('.advjs-editor-layout')).toBeVisible()
    await page.setViewportSize({ width: 1440, height: 900 })
    const inspector = page.locator('[data-editor-region="inspector"]')

    for (const url of ['', 'invalid URL']) {
      // A file inspector can be activated before an online file is available.
      await page.evaluate((url) => {
        const pinia = (document.querySelector('#__nuxt') as any).__vue_app__.config.globalProperties.$pinia
        pinia._s.get('editor:online').onlineAdvConfigFileUrl = url
        pinia._s.get('@advjs/editor:app').activeInspector = 'file'
      }, url)
      await expect(inspector.getByRole('alert')).toHaveCount(0)
      await expect(inspector.locator('.inspector-empty')).toBeVisible()
    }

    const navigation = page.locator('[data-editor-region="navigation"]')
    await navigation.getByRole('textbox', { name: '搜索项目文件' }).fill('chapter_01')
    await navigation.getByRole('treeitem', { name: 'chapter_01.adv.md', exact: true }).click()
    await expect(inspector.getByText('文件信息', { exact: true })).toBeVisible()
    await expect(inspector.getByText('adv/chapters/chapter_01.adv.md', { exact: true })).toBeVisible()
    await expect(inspector.getByRole('alert')).toHaveCount(0)
    await page.screenshot({ path: resolve(evidence, 'panels-inspector-desktop.png') })

    await inspector.getByRole('tab', { name: '创作上下文', exact: true }).click()
    await expect(inspector.locator('[data-view="advjs.context/context"] .editor-view-content')).toBeVisible()
    await expect(inspector.getByRole('alert')).toHaveCount(0)
    await inspector.getByRole('tab', { name: '属性', exact: true }).click()
    await page.setViewportSize({ width: 1280, height: 800 })
    const pane = inspector.locator('xpath=ancestor::div[contains(@class, "splitpanes__pane")][1]')
    const splitter = pane.locator('xpath=preceding-sibling::div[contains(@class, "splitpanes__splitter")]').last()
    const boundary = await splitter.boundingBox()
    const bounds = await inspector.boundingBox()
    await page.mouse.move(boundary!.x + boundary!.width / 2, boundary!.y + 20)
    await page.mouse.down()
    await page.mouse.move(boundary!.x + bounds!.width - 320, boundary!.y + 20)
    await page.mouse.up()
    await expect.poll(async () => Math.round((await inspector.boundingBox())!.width)).toBeGreaterThanOrEqual(315)
    await expect.poll(async () => Math.round((await inspector.boundingBox())!.width)).toBeLessThanOrEqual(325)
    await expect(inspector.getByText('文件信息', { exact: true })).toBeVisible()
    await expect(inspector.getByRole('alert')).toHaveCount(0)
    await page.screenshot({ path: resolve(evidence, 'panels-inspector-narrow.png') })
    expect(errors).toEqual([])
  }
  finally {
    await app?.close()
    await rm(workspace, { recursive: true, force: true })
  }
})
