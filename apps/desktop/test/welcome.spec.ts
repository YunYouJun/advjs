import type { Page } from '@playwright/test'
import { access, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import process from 'node:process'
import { _electron, expect, test } from '@playwright/test'
import { waitForGamePreview } from './preview'

const repo = resolve(import.meta.dirname, '../../..')
async function ready(page: Page) {
  await expect(page.locator('.ae-editor-splash')).toHaveCount(0)
  await expect(page.locator('.editor-status-bar')).toBeVisible({ timeout: 20000 })
}

test('central welcome reuses Starter with a local portrait and readable dialogue fallbacks', async ({ browserName, browser }, testInfo) => {
  test.skip(browserName !== 'chromium', 'Electron uses Chromium')
  const workspace = await realpath(await mkdtemp(resolve(tmpdir(), 'advjs-welcome-')))
  const host = resolve(workspace, 'host')
  const gameName = '你好 ADV "我的故事" $&'
  const root = resolve(workspace, 'hello-advjs')
  const documents = resolve(workspace, 'Documents')
  const blank = resolve(workspace, '空白故事')
  await mkdir(host)
  await mkdir(documents)
  await writeFile(resolve(host, 'editor-preferences.json'), JSON.stringify({ locale: 'zh-CN', onboarded: true }))
  const launchOptions = {
    ...(process.env.ADVJS_DESKTOP_EXECUTABLE ? { executablePath: process.env.ADVJS_DESKTOP_EXECUTABLE } : {}),
    cwd: workspace,
    args: process.env.ADVJS_DESKTOP_EXECUTABLE ? [] : [resolve(repo, 'apps/desktop')],
    env: { ...process.env, NODE_OPTIONS: '', ADVJS_DESKTOP_TEST_DATA: host },
  }
  let app = await _electron.launch(launchOptions)
  const errors: string[] = []
  app.on('window', page => page.on('pageerror', error => errors.push(error.message)))
  try {
    const page = await app.firstWindow()
    await app.evaluate(({ app }, directory) => app.setPath('documents', directory), documents)
    page.on('pageerror', error => errors.push(error.message))
    await ready(page)
    const welcome = page.getByRole('region', { name: '欢迎页', exact: true })
    await expect(welcome).toBeVisible()
    await expect(page.locator('.project-start')).toHaveCount(1)
    await expect(page.locator('.advjs-editor-layout')).toHaveCount(0)
    await app.evaluate(({ shell }) => {
      shell.openExternal = async (url) => {
        (globalThis as any).documentationUrl = url
      }
    })
    await welcome.getByRole('link', { name: '使用文档', exact: true }).click()
    await expect.poll(() => app.evaluate(() => (globalThis as any).documentationUrl)).toBe('https://docs.advjs.org/guide/editor/desktop')
    for (const [locale, mode, width] of [['zh-CN', 'dark', 1440], ['en', 'light', 1440], ['zh-CN', 'dark', 320], ['en', 'light', 320]] as const) {
      await page.evaluate(async ({ locale, mode }) => {
        await window.advDesktop!.setPreferences({ locale })
        localStorage.setItem('nuxt-color-mode', mode)
      }, { locale, mode })
      await page.reload()
      await ready(page)
      const surface = page.locator('.project-welcome')
      await page.setViewportSize({ width: 1440, height: 900 })
      await surface.evaluate((element, width) => {
        element.style.width = `${width}px`
      }, width)
      expect(await surface.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
      await page.getByRole('button', { name: locale === 'zh-CN' ? '创建示例项目' : 'Create example project', exact: true }).focus()
      await surface.screenshot({ path: testInfo.outputPath(`welcome-${locale}-${mode}-${width}.png`), animations: 'disabled' })
      await surface.evaluate(element => element.style.removeProperty('width'))
    }
    await page.evaluate(async () => window.advDesktop!.setPreferences({ locale: 'zh-CN' }))
    await page.reload()
    await ready(page)
    const create = page.getByRole('button', { name: '创建示例项目', exact: true })
    await create.click()
    const creation = page.getByRole('dialog', { name: '创建项目', exact: true })
    await expect(creation).toBeVisible()
    await expect(creation.getByRole('textbox', { name: '游戏名称', exact: true })).toHaveValue('你好，ADV.JS')
    await expect(creation.getByRole('textbox', { name: '文件夹名称', exact: true })).toHaveValue('hello-advjs')
    await expect(creation.getByRole('textbox', { name: '存储位置', exact: true })).toHaveValue(resolve(documents, 'advjs-projects'))
    await expect(access(resolve(documents, 'advjs-projects'))).rejects.toThrow()
    await creation.getByRole('button', { name: '取消', exact: true }).click()
    await expect(create).toBeFocused()
    expect((await page.evaluate(() => window.advDesktop!.session())).root).toBeUndefined()
    await expect(page.evaluate(() => window.advDesktop!.createProject('__proto__', { name: 'game', folderName: 'game' }))).rejects.toThrow('Unknown project template')
    await expect(page.evaluate(() => window.advDesktop!.createProject('starter', { name: 'game', folderName: '../outside' }))).rejects.toThrow('Invalid')
    await expect(page.evaluate(() => window.advDesktop!.createProject('starter', { name: 'game', folderName: 'game', directory: '/tmp/arbitrary' } as any))).rejects.toThrow('Invalid')

    for (const [locale, mode, width] of [['zh-CN', 'dark', 1440], ['en', 'light', 1440], ['zh-CN', 'dark', 320], ['en', 'light', 320]] as const) {
      await page.evaluate(async ({ locale, mode }) => {
        await window.advDesktop!.setPreferences({ locale })
        localStorage.setItem('nuxt-color-mode', mode)
      }, { locale, mode })
      await page.reload()
      await ready(page)
      await page.setViewportSize({ width, height: 900 })
      await page.getByRole('button', { name: locale === 'zh-CN' ? '创建示例项目' : 'Create example project', exact: true }).click()
      const form = page.getByRole('dialog', { name: locale === 'zh-CN' ? '创建项目' : 'Create project', exact: true })
      const nameField = form.getByRole('textbox', { name: locale === 'zh-CN' ? '游戏名称' : 'Game name', exact: true })
      await nameField.fill(gameName)
      await expect(nameField).toBeFocused()
      expect(await form.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
      await form.screenshot({ path: testInfo.outputPath(`create-${locale}-${mode}-${width}.png`) })
      await nameField.press('Escape')
      await expect(form).toBeHidden()
    }
    await page.evaluate(async () => window.advDesktop!.setPreferences({ locale: 'zh-CN' }))
    await page.reload()
    await ready(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await create.click()
    const folder = creation.getByRole('textbox', { name: '文件夹名称', exact: true })
    await folder.fill('CON')
    await expect(creation).toContainText('此名称由系统保留')
    await expect(creation.getByRole('button', { name: '创建并打开', exact: true })).toBeDisabled()
    await folder.fill('hello-advjs')
    await app.evaluate(({ dialog }) => {
      dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] })
    })
    await creation.getByRole('button', { name: '更换…', exact: true }).click()
    await expect(creation.getByRole('textbox', { name: '存储位置', exact: true })).toHaveValue(resolve(documents, 'advjs-projects'))

    // Existing folders cannot be replaced, including native preference data.
    await app.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] })
    }, workspace)
    await creation.getByRole('button', { name: '更换…', exact: true }).click()
    await expect(creation.getByRole('textbox', { name: '存储位置', exact: true })).toHaveValue(workspace)
    await folder.fill('host')
    await creation.getByRole('button', { name: '创建并打开', exact: true }).click()
    await expect(page.locator('.ToastRoot').filter({ hasText: '已存在' })).toBeVisible()
    expect(JSON.parse(await readFile(resolve(host, 'editor-preferences.json'), 'utf8')).locale).toBe('zh-CN')
    await expect(creation.getByRole('alert')).toContainText('已存在')

    await folder.fill('hello-advjs')
    await creation.getByRole('textbox', { name: '游戏名称', exact: true }).fill(gameName)
    await expect(creation.locator('output')).toHaveText(root)
    const beforeCreate = page.url()
    await creation.getByRole('button', { name: '创建并打开', exact: true }).click()
    await page.waitForURL(url => url.href !== beforeCreate)
    await ready(page)
    await expect(page.locator('.project-welcome.is-full-page')).toHaveCount(0)
    await expect(page.locator('.advjs-editor-layout')).toBeVisible()
    expect((await page.evaluate(() => window.advDesktop!.session())).root).toBe(root)
    expect(app.windows()).toHaveLength(1)
    expect(JSON.parse(await readFile(resolve(root, 'adv/settings/game.json'), 'utf8')).title).toBe(gameName)
    expect(JSON.parse(await readFile(resolve(host, 'editor-preferences.json'), 'utf8')).projectsDirectory).toBe(workspace)
    expect((await page.evaluate(() => window.advDesktop!.projectCreationDefaults('starter'))).folderName).toBe('hello-advjs-2')
    expect((await page.evaluate(() => window.advDesktop!.recentProjects()))[0]!.path).toBe(root)
    const compilation = await page.evaluate(() => {
      const pinia = (document.querySelector('#__nuxt') as any).__vue_app__.config.globalProperties.$pinia
      return pinia._s.get('@advjs/editor:project').project.compilation
    })
    expect(compilation.diagnostics.filter((item: { severity: string }) => item.severity === 'error')).toEqual([])
    expect(compilation.project.characters).toHaveLength(1)
    expect(compilation.project.scenes).toHaveLength(1)

    await page.getByRole('combobox', { name: '运行方式', exact: true }).click()
    await page.getByRole('option', { name: '构建预览', exact: true }).click()
    await page.getByRole('button', { name: '启动预览', exact: true }).click()
    const preview = await waitForGamePreview(app, page)
    await expect.poll(() => page.evaluate(async () => (await window.advDesktop!.status()).preview?.active), { timeout: 120000 }).toBe(true)
    expect((await page.evaluate(() => window.advDesktop!.status())).preview?.mode).toBe('embedded')
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter(window => window.isVisible()).length)).toBe(1)
    await preview.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' || /^(?:data|blob):/u.test(route.request().url()) ? route.continue() : route.abort())
    expect(await preview.evaluate(() => typeof window.advDesktop)).toBe('undefined')
    await expect(preview.getByRole('heading', { name: gameName, exact: true })).toBeVisible({ timeout: 20000 })
    await expect(preview.locator('.start-menu-item').first()).toBeVisible({ timeout: 20000 })
    await preview.locator('.start-menu-item').first().click()
    for (let i = 0; i < 5 && !await preview.locator('.adv-dialog-box').isVisible(); i++) {
      await expect(preview.locator('.adv-black')).toBeVisible()
      await preview.locator('.adv-black').click()
      await preview.waitForTimeout(100)
    }
    const dialogue = preview.locator('.adv-dialog-box')
    await expect(dialogue).toBeVisible()
    await expect(dialogue).toContainText('欢迎来到 ADV.JS')
    const portrait = dialogue.locator('.dialog-avatar')
    await expect(portrait).toBeVisible()
    await expect.poll(() => portrait.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
    await expect(dialogue.locator('.dialog-name')).toHaveText('向导')
    await expect(dialogue.locator('.dialog-name')).toHaveCSS('font-size', '20px')
    await expect(dialogue.locator('.dialog-content')).toHaveCSS('font-size', '22px')
    await expect(dialogue.locator('.dialog-content')).toHaveCSS('line-height', '33px')
    await expect(portrait).toHaveCSS('width', '88px')
    await expect(dialogue).toHaveCSS('box-shadow', 'none')
    await expect(dialogue).toHaveCSS('background-repeat', 'no-repeat')
    await writeFile(testInfo.outputPath('dialogue-edge.json'), JSON.stringify(await dialogue.evaluate((element) => {
      const style = getComputedStyle(element)
      return { classes: element.className, rect: element.getBoundingClientRect().toJSON(), shadow: style.boxShadow, outline: style.outline, border: style.border, borderTop: style.borderTop, background: style.background, rules: [...document.styleSheets].flatMap(sheet => [...sheet.cssRules].map(rule => rule.cssText)).filter(rule => rule.includes('shadow-xl') || rule.includes('adv-dialog-box') || rule.includes('border')) }
    }), null, 2))
    expect(await preview.evaluate(() => {
      const adv = (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$adv
      return adv.compileDiagnostics.value
    })).toEqual([])
    await expect(dialogue.locator('.invisible')).toHaveCount(0)
    const controls = preview.locator('.dialog-controls')
    await expect(controls.getByRole('button', { name: /^(回看|History)$/ })).toBeVisible()
    await expect(controls.getByRole('button', { name: /^(自动|Auto)$/ })).toBeVisible()
    await expect(controls.getByRole('button', { name: /^(快速存档|Quick save)$/ })).toBeVisible()
    await expect(preview.locator('.game-toolbar').getByRole('button', { name: /^(快速存档|Quick save|回看|History|自动|Auto)$/ })).toHaveCount(0)
    const settingsButton = preview.locator('.game-toolbar').getByRole('button', { name: /^(设置|Settings)$/ })
    await expect(settingsButton).toBeVisible()
    expect(await settingsButton.locator('.game-icon > span').evaluate(element => getComputedStyle(element).maskImage)).not.toBe('none')
    const controlHintSamples: unknown[] = []
    async function inspectControlHint(player: Page, label: string) {
      const before = await player.evaluate(() => (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$adv.runtime.snapshot().cursor)
      const quick = player.getByRole('button', { name: /^(快速存档|Quick save)$/, exact: true })
      await quick.evaluate((element) => {
        const timing = { enteredAt: 0, openedAfterMs: null as number | null }
        ;(window as any).__advControlHintTiming = timing
        const observer = new MutationObserver(() => {
          if (timing.enteredAt && document.querySelector('.game-control-tooltip')) {
            timing.openedAfterMs = performance.now() - timing.enteredAt
            observer.disconnect()
          }
        })
        element.addEventListener('pointermove', () => timing.enteredAt = performance.now(), { once: true })
        observer.observe(element.closest('.adv-screen')!, { childList: true, subtree: true })
      })
      await quick.hover()
      const hint = player.locator('.game-control-tooltip')
      await expect(hint).toBeVisible()
      const hoverLatencyMs = await player.evaluate(() => (window as any).__advControlHintTiming.openedAfterMs as number | null)
      expect(hoverLatencyMs).not.toBeNull()
      expect(hoverLatencyMs).toBeLessThan(200)
      await expect(hint).toContainText(/手动存档|Manual saves/)
      await expect(hint).toHaveCSS('opacity', '1')
      await expect(hint.locator('.game-control-tooltip-title')).toHaveCSS('font-size', '13px')
      await expect(hint.locator('.game-control-tooltip-description')).toHaveCSS('font-size', '12px')
      await expect(quick).toHaveCSS('outline-style', 'none')
      const sample = await hint.evaluate((element) => {
        const screen = element.closest<HTMLElement>('[data-adv-ui="game"]')!
        const rect = element.getBoundingClientRect()
        const area = screen.getBoundingClientRect()
        const style = getComputedStyle(element)
        return { width: rect.width, insideGame: !!screen, inBounds: rect.left >= area.left && rect.right <= area.right && rect.top >= area.top && rect.bottom <= area.bottom, background: style.backgroundColor, border: style.borderColor, radius: style.borderRadius, animation: style.animationName, duration: style.animationDuration, motion: element.getAttribute('data-motion'), state: element.getAttribute('data-state'), transform: style.transform }
      })
      expect(sample).toMatchObject({ insideGame: true, inBounds: true, radius: '4px', transform: 'none' })
      expect(sample.width).toBeLessThanOrEqual(240)
      const feedback = await quick.evaluate(element => ({ background: getComputedStyle(element).backgroundColor, transition: getComputedStyle(element).transitionDuration, border: getComputedStyle(element).borderColor }))
      controlHintSamples.push({ label, hoverLatencyMs, tooltip: sample, button: feedback })
      if (label === 'motion-none' || label === 'motion-system') {
        expect(sample).toMatchObject({ animation: 'none', motion: 'none' })
        expect(feedback.transition).toBe('0s')
      }
      else if (label === 'motion-reduced') {
        expect(sample.duration).toBe('0.08s')
        expect(feedback.transition).toBe('0.08s')
      }
      else {
        expect(sample.duration).toBe('0.1s')
      }
      if (label === 'embedded-dark')
        await expect(hint).toHaveCSS('background-color', 'rgb(22, 22, 24)')
      if (label === 'custom-theme') {
        await expect(hint).toHaveCSS('background-color', 'rgb(243, 237, 223)')
        await expect(hint).toHaveCSS('border-color', 'rgb(112, 82, 38)')
        await expect(quick).toHaveCSS('background-color', 'rgb(241, 234, 219)')
        await expect(quick).toHaveCSS('color', 'rgb(41, 36, 29)')
      }
      await player.screenshot({ path: testInfo.outputPath(`control-hint-${label}.png`) })
      if (label === 'embedded-dark') {
        const rect = await hint.boundingBox()
        const size = await player.evaluate(() => ({ width: innerWidth, height: innerHeight }))
        const x = Math.max(0, rect!.x - 50)
        const y = Math.max(0, rect!.y - 8)
        await player.screenshot({ path: testInfo.outputPath('control-hint-detail.png'), clip: { x, y, width: Math.min(size.width - x, rect!.width + 100), height: Math.min(size.height - y, rect!.height + 76) } })
      }
      await player.keyboard.press('Escape')
      await expect(hint).toHaveCount(0)
      await player.mouse.move(8, 8)
      expect(await player.evaluate(() => (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$adv.runtime.snapshot().cursor)).toEqual(before)
    }
    // Load the production build in an ordinary browser, with no desktop host.
    // Match the game area even when the surrounding browser is much wider.
    const standalone = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await standalone.goto(new URL(preview.url()).origin)
    await standalone.locator('.start-menu-item').first().click()
    for (let i = 0; i < 5 && !await standalone.locator('.adv-dialog-box').isVisible(); i++) {
      await expect(standalone.locator('.adv-black')).toBeVisible()
      await standalone.locator('.adv-black').click()
      await standalone.waitForTimeout(100)
    }
    await expect(standalone.locator('.adv-dialog-box .invisible')).toHaveCount(0)
    const readingMetrics = (game: Page) => game.locator('.adv-screen').evaluate((element) => {
      const dialog = element.querySelector<HTMLElement>('.adv-dialog-box')!
      const text = dialog.querySelector<HTMLElement>('.dialog-content')!
      const name = dialog.querySelector<HTMLElement>('.dialog-name')!
      const portrait = dialog.querySelector<HTMLElement>('.dialog-avatar')!
      const style = getComputedStyle(dialog)
      const textStyle = getComputedStyle(text)
      const nameStyle = getComputedStyle(name)
      return {
        text: textStyle.fontSize,
        name: nameStyle.fontSize,
        lineHeight: textStyle.lineHeight,
        padding: style.padding,
        columns: style.gridTemplateColumns,
        gap: style.columnGap,
        avatar: getComputedStyle(portrait).width,
        textWidth: Math.round(text.getBoundingClientRect().width * 100) / 100,
        textHeight: Math.round(text.getBoundingClientRect().height * 100) / 100,
        footerClear: text.getBoundingClientRect().bottom <= element.querySelector('.dialog-controls')!.getBoundingClientRect().top,
      }
    })
    async function compareStandalone(label: string) {
      const size = await preview.evaluate(() => ({ width: innerWidth, height: innerHeight }))
      await standalone.locator('.adv-screen').evaluate((element, size) => {
        element.style.width = `${size.width}px`
        element.style.height = `${size.height}px`
      }, size)
      await expect.poll(() => standalone.locator('#adv-content').evaluate(element => Math.round(element.getBoundingClientRect().width))).toBe(size.width)
      const expected = await readingMetrics(preview)
      const { columns, textWidth, textHeight, ...styles } = expected
      await expect.poll(() => readingMetrics(standalone)).toMatchObject(styles)
      const actual = await readingMetrics(standalone)
      // Electron and browser Chromium can round layout to different subpixels.
      expect(actual.textWidth).toBeCloseTo(textWidth, 1)
      expect(actual.textHeight).toBeCloseTo(textHeight, 1)
      const columnWidths = columns.split(' ').map(Number.parseFloat)
      const actualColumns = actual.columns.split(' ').map(Number.parseFloat)
      expect(actualColumns).toHaveLength(columnWidths.length)
      columnWidths.forEach((width, index) => expect(actualColumns[index]).toBeCloseTo(width, 1))
      expect(actual.footerClear).toBe(true)
      await writeFile(testInfo.outputPath(`reading-parity-${label}.json`), JSON.stringify({ gameSize: size, preview: expected, standalone: actual, desktopBridge: await standalone.evaluate(() => typeof window.advDesktop) }, null, 2))
      await standalone.locator('.adv-screen').screenshot({ path: testInfo.outputPath(`standalone-reading-${label}.png`) })
    }
    await compareStandalone('wide')
    await inspectControlHint(preview, 'embedded-wide')
    await inspectControlHint(standalone, 'standalone-wide')
    const gameSurface = preview.locator('[data-adv-ui="game"]')
    const colorScheme = await gameSurface.getAttribute('data-adv-color-scheme')
    await gameSurface.evaluate(element => element.setAttribute('data-adv-color-scheme', 'dark'))
    await inspectControlHint(preview, 'embedded-dark')
    await gameSurface.evaluate((element, value) => {
      if (value)
        element.setAttribute('data-adv-color-scheme', value)
      else
        element.removeAttribute('data-adv-color-scheme')
    }, colorScheme)
    await controls.getByRole('button', { name: /^(快进|Skip)$/, exact: true }).focus()
    await preview.keyboard.press('Tab')
    const quickSave = controls.getByRole('button', { name: /^(快速存档|Quick save)$/, exact: true })
    await expect(quickSave).toBeFocused()
    await expect(preview.locator('.game-control-tooltip')).toBeVisible()
    await expect(preview.locator('.game-control-tooltip')).toHaveCSS('opacity', '1')
    await expect(quickSave).toHaveCSS('outline-style', 'solid')
    await expect(quickSave).toHaveCSS('outline-width', '2px')
    await preview.screenshot({ path: testInfo.outputPath('control-keyboard-focus.png') })
    await preview.keyboard.press('Escape')
    await expect(preview.locator('.game-control-tooltip')).toHaveCount(0)
    await quickSave.evaluate(element => element.blur())
    const music = preview.getByRole('button', { name: /^(关闭音乐|Mute music)$/, exact: true })
    await music.hover()
    await expect(music).toHaveCSS('background-color', 'rgba(16, 19, 23, 0.48)')
    await preview.screenshot({ path: testInfo.outputPath('control-icon-hover.png') })
    await music.click()
    await expect(preview.getByRole('button', { name: /^(开启音乐|Unmute music)$/, exact: true })).toHaveAttribute('aria-pressed', 'true')
    expect(await preview.getByRole('button', { name: /^(开启音乐|Unmute music)$/, exact: true }).evaluate(element => getComputedStyle(element, '::after').height)).toBe('2px')
    await preview.screenshot({ path: testInfo.outputPath('control-active-state.png') })
    await preview.getByRole('button', { name: /^(开启音乐|Unmute music)$/, exact: true }).click()
    await music.evaluate(element => element.blur())
    await preview.mouse.move(8, 8)
    for (const mode of ['none', 'reduced', 'system'] as const) {
      await preview.emulateMedia({ reducedMotion: mode === 'system' ? 'reduce' : 'no-preference' })
      await preview.evaluate(mode => (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$pinia._s.get('@advjs/client/settings').storage.animation.motion = mode === 'system' ? 'full' : mode, mode)
      await inspectControlHint(preview, `motion-${mode}`)
    }
    await preview.emulateMedia({ reducedMotion: 'no-preference' })
    await preview.evaluate(() => (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$pinia._s.get('@advjs/client/settings').storage.animation.motion = 'full')
    const playerIdentity = await preview.evaluate(() => ({ url: location.href, cursor: (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$adv.runtime.snapshot().cursor }))
    // Native game surfaces yield to editor dialogs and hidden tabs, then resume.
    const editorWindow = await app.browserWindow(page)
    const attachedPlayerCount = () => editorWindow.evaluate(window => window.contentView.children.filter(view => 'webContents' in view).length)
    await expect.poll(attachedPlayerCount).toBe(1)
    await app.evaluate(({ Menu }) => {
      const item = Menu.getApplicationMenu()!.getMenuItemById('desktop.preferences')!
      item.click(item, undefined, {} as never)
    })
    await expect(page.getByRole('dialog', { name: '偏好设置', exact: true })).toBeVisible()
    await expect.poll(attachedPlayerCount).toBe(0)
    expect(await app.evaluate(({ webContents }, url) => webContents.getAllWebContents().find(contents => contents.getURL() === url)!.isAudioMuted(), preview.url())).toBe(true)
    expect(await preview.evaluate(() => typeof window.advDesktop)).toBe('undefined')
    await page.keyboard.press('Escape')
    await expect.poll(attachedPlayerCount).toBe(1)
    await page.getByRole('tab', { name: '文件', exact: true }).click()
    await expect.poll(attachedPlayerCount).toBe(0)
    await page.getByRole('tab', { name: '游戏', exact: true }).click()
    await expect.poll(attachedPlayerCount).toBe(1)
    expect(await app.evaluate(({ webContents }, url) => webContents.getAllWebContents().find(contents => contents.getURL() === url)!.isAudioMuted(), preview.url())).toBe(false)
    await editorWindow.dispose()
    expect(await preview.evaluate(() => ({ url: location.href, cursor: (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$adv.runtime.snapshot().cursor }))).toEqual(playerIdentity)
    await page.reload()
    await ready(page)
    const reloadedWindow = await app.browserWindow(page)
    await expect.poll(() => reloadedWindow.evaluate(window => window.contentView.children.filter(view => 'webContents' in view).length)).toBe(1)
    await reloadedWindow.dispose()
    expect(await preview.evaluate(() => ({ url: location.href, cursor: (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$adv.runtime.snapshot().cursor }))).toEqual(playerIdentity)
    await page.getByRole('combobox', { name: '预览位置', exact: true }).click()
    await page.getByRole('option', { name: '独立窗口', exact: true }).click()
    await expect.poll(() => page.evaluate(async () => (await window.advDesktop!.status()).preview?.mode)).toBe('window')
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter(window => window.isVisible()).length)).toBe(2)
    expect(await preview.evaluate(() => ({ url: location.href, cursor: (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$adv.runtime.snapshot().cursor }))).toEqual(playerIdentity)
    await page.getByRole('button', { name: '移回编辑器', exact: true }).click()
    await expect.poll(() => page.evaluate(async () => (await window.advDesktop!.status()).preview?.mode)).toBe('embedded')
    expect(await preview.evaluate(() => ({ url: location.href, cursor: (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$adv.runtime.snapshot().cursor }))).toEqual(playerIdentity)
    const panel = page.locator('.desktop-game-preview')
    await panel.evaluate(element => element.style.width = '320px')
    await expect.poll(() => preview.evaluate(() => innerWidth)).toBe(320)
    await expect(dialogue.locator('.dialog-content')).toHaveCSS('font-size', '20px')
    await expect(dialogue.locator('.dialog-content')).toHaveCSS('line-height', '30px')
    await compareStandalone('320')
    await inspectControlHint(preview, 'embedded-320')
    await inspectControlHint(standalone, 'standalone-320')
    await writeFile(testInfo.outputPath('narrow-preview-geometry.json'), JSON.stringify(await preview.evaluate(() => {
      const dialogue = document.querySelector('.adv-dialog-box')!
      const style = getComputedStyle(dialogue)
      const toolbar = document.querySelector('.game-toolbar')!
      const icon = toolbar.querySelector('.game-icon > span')!
      return { innerWidth, media: matchMedia('(max-width: 800px)').matches, grid: style.gridTemplateColumns, padding: style.padding, paddingInline: style.getPropertyValue('--adv-dialog-padding-inline'), footer: style.getPropertyValue('--adv-dialog-footer-space'), controls: style.getPropertyValue('--adv-dialog-controls-height'), toolbar: toolbar.getBoundingClientRect().toJSON(), toolbarDisplay: getComputedStyle(toolbar).display, icon: icon.outerHTML, mask: getComputedStyle(icon).maskImage, dialogue: dialogue.getBoundingClientRect().toJSON(), body: document.querySelector('.dialog-content')!.getBoundingClientRect().toJSON(), stage: document.querySelector('#adv-content')!.getBoundingClientRect().toJSON(), viewport: document.querySelector('.adv-screen')!.getBoundingClientRect().toJSON(), css: [...document.styleSheets].flatMap(sheet => [...sheet.cssRules].map(rule => rule.cssText)).filter(rule => rule.includes('dialog-box') || rule.includes('game-toolbar') || rule.includes('game-icon')) }
    }), null, 2))
    await expect(controls.getByRole('button', { name: /^(读档|Load)$/ })).toBeVisible()
    expect(await controls.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    expect(await dialogue.locator('.dialog-content').evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThan(250)
    expect(await preview.evaluate(() => document.querySelector('.dialog-content')!.getBoundingClientRect().bottom <= document.querySelector('.dialog-controls')!.getBoundingClientRect().top)).toBe(true)
    expect(await preview.locator('.typed-cursor').evaluate(element => element.getBoundingClientRect().bottom <= document.querySelector('.dialog-controls')!.getBoundingClientRect().top)).toBe(true)
    await preview.screenshot({ path: testInfo.outputPath('embedded-game-320.png') })
    await panel.screenshot({ path: testInfo.outputPath('preview-controls-320.png') })
    await standalone.close()
    await panel.evaluate(element => element.style.removeProperty('width'))
    await page.evaluate(() => window.advDesktop!.setPreviewPresentation('window'))
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.contentView.children.some(view => 'webContents' in view))?.close())
    await expect.poll(() => page.evaluate(async () => (await window.advDesktop!.status()).preview?.mode)).toBe('embedded')
    expect((await page.evaluate(() => window.advDesktop!.status())).preview?.active).toBe(true)
    // Keep the following standalone dialogue and theme checks at their original dimensions.
    await page.evaluate(() => window.advDesktop!.setPreviewPresentation('window'))
    await preview.screenshot({ path: testInfo.outputPath('starter-portrait-wide.png') })

    // Runtime config is static shallow data. Returning to the opening narration
    // unmounts the dialogue before each configuration scenario.
    async function restartDialogue() {
      await preview.evaluate(async () => {
        const adv = (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$adv
        await adv.runtime.go(adv.store.program.entry)
      })
      await expect(dialogue).toHaveCount(0)
      await expect(preview.locator('.adv-black')).toContainText('这段旁白直接来自一个')
      for (let i = 0; i < 5 && !await dialogue.isVisible(); i++) {
        await expect(preview.locator('.adv-black')).toBeVisible()
        await preview.locator('.adv-black').click()
        await preview.waitForTimeout(100)
      }
      await expect(dialogue).toContainText('欢迎来到 ADV.JS')
      await expect(dialogue.locator('.invisible')).toHaveCount(0)
    }

    await preview.evaluate(() => {
      const app = (document.querySelector('#app') as any).__vue_app__
      const adv = app.config.globalProperties.$adv
      ;(window as any).starterPortrait = adv.gameConfig.value.characters[0].avatar
      adv.config.value.showCharacterAvatar = false
    })
    await restartDialogue()
    await expect(portrait).toHaveCount(0)
    const reading = async () => dialogue.evaluate((element) => {
      const name = element.querySelector<HTMLElement>('.dialog-name')!
      const content = element.querySelector<HTMLElement>('.dialog-content')!
      return { nameSize: Number.parseFloat(getComputedStyle(name).fontSize), textSize: Number.parseFloat(getComputedStyle(content).fontSize), gap: content.getBoundingClientRect().top - name.getBoundingClientRect().bottom, above: name.getBoundingClientRect().bottom <= content.getBoundingClientRect().top, sameLeft: Math.abs(name.getBoundingClientRect().left - content.getBoundingClientRect().left) < 1, overflow: element.scrollWidth > element.clientWidth }
    })
    expect(await reading()).toMatchObject({ nameSize: 20, textSize: 22, above: true, sameLeft: true, overflow: false })
    expect((await reading()).gap).toBeLessThanOrEqual(12.5)
    await preview.screenshot({ path: testInfo.outputPath('starter-no-portrait-wide.png') })
    await settingsButton.click()
    const fontOptions = preview.locator('.adv-menu-item--label').filter({ hasText: /字体大小|Font Size/ }).locator('xpath=following-sibling::div[1]')
    for (const [label, size] of [[/^(小|Small)$/, 20], [/^(中|Normal)$/, 22], [/^(大|Big)$/, 30], [/^(超大|Extra Large)$/, 36]] as const) {
      await fontOptions.getByRole('button', { name: label }).click()
      await expect(dialogue.locator('.dialog-content')).toHaveCSS('font-size', `${size}px`)
      await expect(preview.locator('.menu-panel .adv-dialog-reading')).toHaveCSS('font-size', `${size}px`)
    }
    await preview.keyboard.press('Escape')
    await expect(dialogue.locator('.dialog-name')).toHaveCSS('font-size', '32.7273px')
    await expect(dialogue.locator('.dialog-content')).toHaveCSS('font-size', '36px')

    // Configured-but-missing and failed portraits must use the same readable layout.
    await preview.evaluate(() => {
      const adv = (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$adv
      adv.config.value.showCharacterAvatar = true
      adv.gameConfig.value.characters[0].avatar = undefined
    })
    await restartDialogue()
    await expect(portrait).toHaveCount(0)
    const missingPortrait = preview.waitForResponse(response => response.url().endsWith('/missing-portrait.webp'))
    await preview.evaluate(() => {
      const adv = (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$adv
      adv.gameConfig.value.characters[0].avatar = '/missing-portrait.webp'
    })
    await restartDialogue()
    await missingPortrait
    await expect(portrait).toHaveCount(0)
    expect(await reading()).toMatchObject({ above: true, sameLeft: true, overflow: false })
    await preview.evaluate(() => {
      const adv = (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$adv
      const character = adv.gameConfig.value.characters[0]
      character.aliases.push('向导')
      character.name = '一个有着很长中文名称的入门向导 Xiaoyun'
    })
    await preview.setViewportSize({ width: 390, height: 844 })
    await restartDialogue()
    // Project themes supply these public CSS tokens on the game surface.
    const themedSurface = preview.locator('[data-adv-ui="game"]')
    await themedSurface.evaluate((element) => {
      for (const [name, value] of Object.entries({ '--adv-dialog-bg': '#f3eddf', '--adv-dialog-color': '#29241d', '--adv-dialog-name-color': '#705226', '--adv-dialog-text-shadow': 'none', '--adv-c-text': '#29241d', '--adv-c-text-2': '#705226', '--adv-tooltip-bg': '#f3eddf', '--adv-tooltip-border': '#705226', '--adv-control-color': '#29241d', '--adv-control-hover-bg': '#f1eadb', '--adv-control-hover-border': '#705226' }))
        (element as HTMLElement).style.setProperty(name, value)
    })
    await expect(dialogue).toHaveCSS('background-color', 'rgb(243, 237, 223)')
    await expect(controls.getByRole('button', { name: /^(回看|History)$/ })).toHaveCSS('text-shadow', 'none')
    await expect(dialogue.locator('.dialog-name')).toContainText('Xiaoyun')
    expect(await reading()).toMatchObject({ above: true, sameLeft: true, overflow: false })
    await inspectControlHint(preview, 'custom-theme')
    await writeFile(testInfo.outputPath('control-hints.json'), JSON.stringify(controlHintSamples, null, 2))
    await preview.screenshot({ path: testInfo.outputPath('starter-no-portrait-narrow-tokens.png') })
    await preview.evaluate(() => {
      const app = (document.querySelector('#app') as any).__vue_app__
      const adv = app.config.globalProperties.$adv
      const character = adv.gameConfig.value.characters[0]
      character.name = '向导'
      character.avatar = (window as any).starterPortrait
      app.config.globalProperties.$pinia._s.get('@advjs/client/settings').storage.text.curFontSize = '2xl'
    })
    await themedSurface.evaluate((element) => {
      for (const name of ['--adv-dialog-bg', '--adv-dialog-color', '--adv-dialog-name-color', '--adv-dialog-text-shadow', '--adv-c-text', '--adv-c-text-2', '--adv-tooltip-bg', '--adv-tooltip-border', '--adv-control-color', '--adv-control-hover-bg', '--adv-control-hover-border'])
        (element as HTMLElement).style.removeProperty(name)
    })
    await restartDialogue()
    await expect(portrait).toBeVisible()
    await expect.poll(() => portrait.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
    expect(await reading()).toMatchObject({ above: true, overflow: false })
    await preview.screenshot({ path: testInfo.outputPath('starter-portrait-narrow.png') })
    await preview.setViewportSize({ width: 1440, height: 900 })

    const choiceMotionSamples = []
    for (const mode of ['full', 'reduced', 'none', 'system'] as const) {
      await preview.emulateMedia({ reducedMotion: mode === 'system' ? 'reduce' : 'no-preference' })
      await preview.evaluate(async (mode) => {
        const app = (document.querySelector('#app') as any).__vue_app__
        app.config.globalProperties.$pinia._s.get('@advjs/client/settings').storage.animation.motion = mode === 'system' ? 'full' : mode
        const adv = app.config.globalProperties.$adv
        await adv.runtime.go(adv.store.program.entry)
      }, mode)
      await expect(preview.locator('.adv-black')).toBeVisible()
      await preview.evaluate(async (mode) => {
        const adv = (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$adv
        const chapter = Object.values(adv.store.program.chapters).find((chapter: any) => Object.values(chapter.nodes).some((node: any) => node.kind === 'choices' && node.data.options.some((option: any) => option.label === '看看语法'))) as any
        const choice = Object.values(chapter.nodes).find((node: any) => node.kind === 'choices' && node.data.options.some((option: any) => option.label === '看看语法')) as any
        ;(window as any).choiceEntrySample = null
        ;(window as any).clickedDuringChoiceFade = false
        const observer = new MutationObserver(() => {
          const root = document.querySelector<HTMLElement>('.adv-choice')
          if (!root)
            return
          // A newly mounted media-query composable updates after the first render.
          if (root.dataset.motion !== (mode === 'system' ? 'none' : mode))
            return
          const entering = root.classList.contains('adv-choice-enter-active')
          if (!entering && (mode === 'full' || mode === 'reduced'))
            return
          const style = getComputedStyle(root)
          const options = [...root.querySelectorAll<HTMLButtonElement>('button')]
          ;(window as any).choiceEntrySample = { mode: root.dataset.motion, duration: style.transitionDuration, delay: style.transitionDelay, property: style.transitionProperty, transform: style.transform, animation: style.animationName, entering, buttonCount: options.length, clickable: options.every(button => !button.disabled && getComputedStyle(button).pointerEvents !== 'none') }
          observer.disconnect()
          if (mode === 'full') {
            ;(window as any).clickedDuringChoiceFade = entering
            options.find(button => button.textContent?.trim() === '看看语法')!.click()
          }
        })
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-motion'] })
        await adv.runtime.go({ chapterId: chapter.id, nodeId: choice.id })
      }, mode)
      await expect.poll(() => preview.evaluate(() => (window as any).choiceEntrySample)).not.toBeNull()
      const sample = await preview.evaluate(() => (window as any).choiceEntrySample)
      expect(sample).toMatchObject({ mode: mode === 'system' ? 'none' : mode, duration: mode === 'full' ? '0.16s' : mode === 'reduced' ? '0.08s' : '0s', delay: '0s', transform: 'none', animation: 'none', buttonCount: 2, clickable: true })
      if (mode === 'full') {
        expect(sample.property).toBe('opacity')
        expect(await preview.evaluate(() => (window as any).clickedDuringChoiceFade)).toBe(true)
        await expect(preview.locator('.adv-black')).toContainText('标题可以作为稳定锚点')
      }
      if (mode === 'none') {
        await preview.getByRole('button', { name: '看看语法', exact: true }).focus()
        await preview.keyboard.press('Enter')
        await expect(preview.locator('.adv-black')).toContainText('标题可以作为稳定锚点')
      }
      if (mode === 'reduced') {
        await expect(preview.locator('.adv-choice')).toHaveCSS('opacity', '1')
        await expect(dialogue).toHaveCount(0)
        await preview.screenshot({ path: testInfo.outputPath('starter-choices-wide.png') })
      }
      if (mode === 'system') {
        await preview.setViewportSize({ width: 320, height: 720 })
        await expect(preview.getByRole('button', { name: '看看语法', exact: true })).toBeInViewport()
        await preview.screenshot({ path: testInfo.outputPath('starter-choices-narrow.png') })
        await preview.setViewportSize({ width: 1440, height: 900 })
      }
      choiceMotionSamples.push({ preference: mode, ...sample })
    }
    await writeFile(testInfo.outputPath('choice-motion.json'), JSON.stringify(choiceMotionSamples, null, 2))
    await preview.emulateMedia({ reducedMotion: 'no-preference' })
    await preview.evaluate(() => (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$pinia._s.get('@advjs/client/settings').storage.animation.motion = 'full')
    await restartDialogue()

    // Reuse Starter's real branch, variable action and conditional continuation.
    const syntax = preview.getByRole('button', { name: '看看语法', exact: true })
    for (let i = 0; i < 4 && !await syntax.isVisible(); i++) {
      await dialogue.click()
      await preview.waitForTimeout(150)
    }
    await syntax.click()
    await expect(preview.locator('.adv-black')).toContainText('标题可以作为稳定锚点')
    const continueChoice = preview.getByRole('button', { name: '继续', exact: true })
    for (let i = 0; i < 4 && !await continueChoice.isVisible(); i++) {
      await preview.locator('.adv-black').click()
      await preview.waitForTimeout(150)
    }
    await continueChoice.click()
    await expect(dialogue).toContainText('最小项目已经跑通')
    expect(await preview.evaluate(() => (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$adv.store.state.variables.greeted)).toBe(true)
    await preview.screenshot({ path: testInfo.outputPath('starter-complete.png') })
    await page.evaluate(() => window.advDesktop!.stopPreview())
    await expect.poll(() => app.context().pages().includes(preview)).toBe(false)

    // Creating while a project is open leaves its writable session intact.
    await app.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu()!
      const item = menu.getMenuItemById('desktop.create.blank')!
      item.click!(item, undefined, {} as any)
    })
    await expect(creation).toBeVisible()
    await expect(creation.getByRole('textbox', { name: '存储位置', exact: true })).toHaveValue(workspace)
    await creation.getByRole('textbox', { name: '游戏名称', exact: true }).fill('空白故事的中文名')
    await creation.getByRole('textbox', { name: '文件夹名称', exact: true }).fill('空白故事')
    const secondOpened = app.waitForEvent('window')
    await creation.getByRole('button', { name: '创建并打开', exact: true }).click()
    const second = await secondOpened
    await ready(second)
    expect((await page.evaluate(() => window.advDesktop!.session())).root).toBe(root)
    expect((await second.evaluate(() => window.advDesktop!.session())).root).toBe(blank)
    expect(app.windows()).toHaveLength(2)
    expect((await second.evaluate(() => window.advDesktop!.projectCreationDefaults('starter'))).directory).toBe(workspace)
    expect(JSON.parse(await readFile(resolve(blank, 'adv/settings/game.json'), 'utf8')).title).toBe('空白故事的中文名')

    const beforeClose = page.url()
    await page.evaluate(() => {
      void window.advDesktop!.closeProject()
    })
    await page.waitForURL(url => url.href !== beforeClose)
    await ready(page)
    await expect(welcome).toBeVisible()
    const recents = welcome.getByRole('region', { name: '最近打开的项目', exact: true })
    await expect(recents.getByTitle(blank, { exact: true })).toContainText('已打开')
    await recents.getByRole('textbox', { name: '搜索最近项目', exact: true }).fill('没有这样的项目')
    await expect(recents).toContainText('没有匹配的项目')
    await recents.getByRole('textbox', { name: '搜索最近项目', exact: true }).fill('空白')
    await recents.getByTitle(blank, { exact: true }).click()
    expect(app.windows()).toHaveLength(2)
    await expect(welcome).toBeVisible()
    expect(errors).toEqual([])

    // A fresh main process reloads the remembered storage location from disk.
    await app.close()
    app = await _electron.launch(launchOptions)
    const reopened = await app.firstWindow()
    await ready(reopened)
    expect((await reopened.evaluate(() => window.advDesktop!.projectCreationDefaults('starter'))).directory).toBe(workspace)
    expect((await reopened.evaluate(() => window.advDesktop!.projectCreationDefaults('starter'))).folderName).toBe('hello-advjs-2')
  }
  finally {
    await app.close()
    await rm(workspace, { recursive: true, force: true })
  }
})
