import type { Locator } from '@playwright/test'
import type { AdvContext } from '../../packages/client/types/context'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { expect, test } from '@playwright/test'

const gameUrl = process.env.ADV_TEST_GAME_URL || 'http://localhost:3333'

test.use({ locale: 'zh-CN' })

// Match the player surface in desktop sandboxes and exported games.
// The dev server's separate floating author toolbar can cover mobile controls.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style')
      style.textContent = '#__advjs-devtools-container__ { display: none; }'
      document.head.append(style)
    }, { once: true })
  })
})

test('persists local game mode and keeps modal keyboard focus inside the game', async ({ page }) => {
  await page.goto(`${gameUrl}/#/start`)
  const game = page.locator('[data-adv-ui="game"]')
  const settings = page.getByRole('button', { name: '设置', exact: true })
  await expect(settings).toBeVisible()
  const hostDark = await page.locator('html').evaluate(element => element.classList.contains('dark'))
  await settings.focus()
  await settings.press('Enter')
  const dialog = game.getByRole('dialog', { name: '设置', exact: true })
  await expect(dialog).toBeVisible()
  const close = dialog.getByRole('button', { name: '关闭', exact: true }).first()
  await expect(close).toBeFocused()
  const toggle = dialog.getByRole('button', { name: '切换深色模式' })
  const target = await toggle.getAttribute('aria-pressed') === 'true' ? 'light' : 'dark'
  await toggle.click()
  await expect(game).toHaveAttribute('data-adv-color-scheme', target)
  expect(await page.locator('html').evaluate(element => element.classList.contains('dark'))).toBe(hostDark)
  await close.focus()
  await page.keyboard.press('Shift+Tab')
  await expect(dialog.locator(':focus')).toHaveCount(1)
  await page.keyboard.press('Tab')
  await expect(close).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(settings).toBeFocused()
  await page.reload()
  await expect(game).toHaveAttribute('data-adv-color-scheme', target)
  await page.getByRole('button', { name: '开始游戏', exact: true }).click()
  await expect(page).toHaveURL(/#\/game/)
  await expect(game).toHaveAttribute('data-adv-color-scheme', target)
  await page.getByRole('button', { name: '回看', exact: true }).click()
  const history = game.getByRole('dialog', { name: '历史记录' })
  await expect(history).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(history).toBeHidden()
  await page.getByRole('button', { name: '设置', exact: true }).click()
  const inGameSettings = game.getByRole('dialog', { name: '设置', exact: true })
  await expect(inGameSettings.getByRole('tab', { name: '对白', exact: true })).toHaveCSS('font-size', '18px')
  const save = inGameSettings.locator('.adv-settings-tools').getByRole('button', { name: '存储存档', exact: true })
  await expect(save).toHaveCSS('font-size', '16px')
  await save.click()
  await expect(inGameSettings).toBeHidden()
  await expect(game.getByRole('dialog', { name: '存储存档', exact: true })).toBeVisible()
})

test('shows every manual slot without vertical scrolling in desktop game canvases', async ({ page }) => {
  await page.goto(`${gameUrl}/#/start`)
  const trigger = page.getByRole('button', { name: '加载存档', exact: true })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: '加载存档', exact: true })
  await dialog.getByRole('button', { name: '手动存档第 2 页' }).click()
  const cards = dialog.locator('.swiper-slide-active .saved-card')
  await expect(cards).toHaveCount(6)
  await expect(cards.first()).toHaveAttribute('data-save-index', '7')
  await expect(cards.last()).toHaveAttribute('data-save-index', '12')

  for (const viewport of [{ width: 1200, height: 720 }, { width: 800, height: 450 }]) {
    await page.setViewportSize(viewport)
    await expect.poll(() => dialog.evaluate((element) => {
      const body = element.querySelector('.modal-body')!
      const scroll = element.querySelector('.swiper-slide-active .save-slots-scroll')!
      return Math.max(body.scrollHeight - body.clientHeight, scroll.scrollHeight - scroll.clientHeight)
    })).toBeLessThanOrEqual(1)
    await expect(cards.last()).toBeInViewport({ ratio: 1 })
  }

  await page.setViewportSize({ width: 390, height: 844 })
  const scroll = dialog.locator('.swiper-slide-active .save-slots-scroll')
  await expect.poll(() => scroll.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true)
  await scroll.evaluate(element => element.scrollTop = element.scrollHeight)
  await expect(cards.last()).toBeInViewport({ ratio: 1 })
  await dialog.getByRole('button', { name: '手动存档第 10 页' }).click()
  await expect(dialog.locator('.swiper-slide-active .saved-card').last()).toHaveAttribute('data-save-index', '60')
  await dialog.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
})

test('fits an embedded canvas independently of host typography and follows its local save theme', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${gameUrl}/#/start`)
  await page.getByRole('button', { name: '加载存档', exact: true }).click()
  const game = page.locator('[data-adv-ui="game"]')
  const dialog = game.getByRole('dialog', { name: '加载存档', exact: true })
  await dialog.getByRole('button', { name: '手动存档第 1 页' }).click()
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '32px'
    document.documentElement.classList.add('dark')
    const app = document.querySelector<HTMLElement>('#app')!
    app.style.width = '800px'
    app.style.height = '450px'
    const game = document.querySelector<HTMLElement>('[data-adv-ui="game"]')!
    game.dataset.advColorScheme = 'dark'
    game.style.setProperty('--adv-c-primary', '#b58748')
    game.style.setProperty('--adv-save-card-radius', '0px')
    game.style.setProperty('--adv-save-control-radius', '0px')
  })
  await expect(game).toHaveCSS('width', '800px')
  await expect(dialog.locator('.adv-modal-heading')).toHaveCSS('font-size', '20px')
  await expect(dialog.locator('.modal-close-button .adv-icon')).toHaveCSS('font-size', '22px')
  const card = dialog.locator('.swiper-slide-active .saved-card').last()
  await expect(card).toHaveCSS('font-size', '14px')
  await expect(card).toHaveCSS('border-radius', '0px')
  await expect(card).toBeInViewport({ ratio: 1 })
  await expect.poll(() => dialog.locator('.swiper-slide-active .save-slots-scroll').evaluate(element => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1)
  await card.hover()
  await expect(card).toHaveCSS('border-top-color', 'rgb(181, 135, 72)')
  await expect(dialog.locator('[data-save-page="1"]')).toHaveCSS('border-radius', '0px')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.locator('html')).toHaveCSS('font-size', '32px')
})

test('keeps settings and menu controls compact in embedded and narrow previews', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 720 })
  await page.goto(`${gameUrl}/#/start`)
  await page.getByRole('button', { name: '设置', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '设置', exact: true })
  const content = dialog.getByRole('tabpanel', { name: '对白', exact: true })
  const audio = dialog.getByRole('tabpanel', { name: '音频', exact: true })
  const menu = dialog.locator('.adv-settings-tools')
  await expect(dialog.getByRole('tab')).toHaveText(['对白', '画面', '音频', '语音'])
  await expect(dialog.getByRole('tab', { name: '对白', exact: true })).toHaveCSS('font-size', '18px')
  await expect(menu.getByRole('button', { name: '加载存档', exact: true })).toHaveCSS('font-size', '16px')
  await expect(content.locator('.adv-menu-item--label').first()).toHaveCSS('font-size', '16px')
  await expect.poll(() => content.evaluate(el => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1)

  // A large host font and a small pane must not enlarge game controls.
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '32px'
    const app = document.querySelector<HTMLElement>('#app')!
    app.style.width = '800px'
    app.style.height = '450px'
    const game = document.querySelector<HTMLElement>('[data-adv-ui="game"]')!
    game.style.setProperty('--adv-c-primary', '#b58748')
    game.style.setProperty('--adv-control-radius', '0px')
  })
  await expect(dialog.getByRole('tab', { name: '对白', exact: true })).toHaveCSS('font-size', '18px')
  await expect(menu.getByRole('button', { name: '加载存档', exact: true })).toHaveCSS('font-size', '16px')
  await expect(content.getByRole('button', { name: '中', exact: true }).first()).toHaveCSS('border-radius', '0px')
  await expect(dialog.locator('.modal-close-button')).toHaveCSS('right', '12px')
  await expect.poll(() => dialog.locator('.modal-body').evaluate(el => Math.max(el.scrollWidth - el.clientWidth, el.scrollHeight - el.clientHeight))).toBeLessThanOrEqual(1)
  await expect.poll(() => content.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1)
  await expect(menu.getByRole('button', { name: '关闭', exact: true })).toBeInViewport({ ratio: 1 })

  // Native keyboard controls still write the existing settings.
  await dialog.getByRole('tab', { name: '对白', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(dialog.getByRole('tabpanel', { name: '画面', exact: true })).toBeVisible()
  await expect(content).toBeHidden()
  await expect(dialog.getByRole('checkbox', { name: '是否全屏', exact: true })).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await expect(audio).toBeVisible()
  const sound = audio.getByRole('checkbox', { name: '音效音量', exact: true })
  const checked = await sound.getAttribute('aria-checked')
  await sound.focus()
  await sound.press('Space')
  await expect(sound).toHaveAttribute('aria-checked', checked === 'true' ? 'false' : 'true')
  const volume = audio.getByRole('spinbutton', { name: '音乐音量大小', exact: true })
  await volume.fill('0.75')
  const slider = audio.getByRole('slider', { name: '音乐音量大小', exact: true })
  await expect(slider).toHaveAttribute('aria-valuenow', '0.75')
  await slider.focus()
  await slider.press('ArrowRight')
  await expect(volume).toHaveValue('0.8')
  await slider.press('Home')
  await expect(volume).toHaveValue('0')
  await slider.press('End')
  await expect(volume).toHaveValue('1')
  await volume.fill('0.75')
  await dialog.getByRole('tab', { name: '语音', exact: true }).click()
  await expect(dialog.getByRole('checkbox', { name: '语音合成', exact: true })).toBeVisible()
  await dialog.getByRole('tab', { name: '对白', exact: true }).click()
  await content.getByRole('group', { name: '字体大小', exact: true }).getByRole('button', { name: '超大', exact: true }).click()
  await expect(content.locator('.adv-dialog-reading')).toHaveCSS('font-size', '36px')
  await expect(menu.getByRole('button', { name: '加载存档', exact: true })).toHaveCSS('font-size', '16px')
  await dialog.getByRole('tab', { name: '音频', exact: true }).click()
  await expect(volume).toHaveValue('0.75')
  await expect(sound).toHaveAttribute('aria-checked', checked === 'true' ? 'false' : 'true')
  await dialog.getByRole('tab', { name: '对白', exact: true }).click()
  await expect(content.locator('.adv-dialog-reading')).toHaveCSS('font-size', '36px')

  // Layout queries use the pane, even while the outer browser is wide.
  await page.evaluate(() => {
    const app = document.querySelector<HTMLElement>('#app')!
    app.style.width = '390px'
    app.style.height = '700px'
  })
  await expect.poll(async () => {
    const nav = await menu.boundingBox()
    const tabs = await dialog.locator('.adv-settings-tabs').boundingBox()
    return nav!.y >= tabs!.y + tabs!.height
  }).toBe(true)
  await expect.poll(() => dialog.locator('.modal-body').evaluate(el => Math.max(el.scrollWidth - el.clientWidth, el.scrollHeight - el.clientHeight))).toBeLessThanOrEqual(1)
  await expect(menu.getByRole('button', { name: '加载存档', exact: true })).toBeInViewport({ ratio: 1 })
  await menu.getByRole('button', { name: '加载存档', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('dialog', { name: '加载存档', exact: true })).toBeVisible()
})

test('preserves physical settings control sizes on a scaled game stage', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 450 })
  await page.goto(`${gameUrl}/#/start`)
  await page.getByRole('button', { name: '设置', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '设置', exact: true })
  // Reproduce the 1920×1080 contain stage used by fixed-canvas projects.
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '32px'
    const stage = document.querySelector<HTMLElement>('#adv-content')!
    stage.style.setProperty('--adv-screen-scale', String(800 / 1920))
    stage.style.setProperty('--adv-screen-width', '1920px')
    stage.style.setProperty('--adv-screen-height', '1080px')
    stage.style.transform = `translate(-50%, -50%) scale(${800 / 1920})`
  })
  await expect.poll(() => dialog.locator('.adv-settings-panel').evaluate((el) => {
    const scale = Number(getComputedStyle(el).getPropertyValue('--adv-screen-scale'))
    return Number.parseFloat(getComputedStyle(el).fontSize) * scale
  })).toBeCloseTo(16, 1)
  const load = dialog.locator('.adv-settings-tools').getByRole('button', { name: '加载存档', exact: true })
  await expect.poll(async () => (await load.boundingBox())!.height).toBeCloseTo(44, 0)
  // Transformed edges can differ by less than one physical pixel.
  await expect(load).toBeInViewport({ ratio: 0.999 })
  await expect(dialog.locator('.modal-close-button')).toBeInViewport({ ratio: 0.999 })
  await expect.poll(() => dialog.locator('.modal-body').evaluate(el => Math.max(el.scrollWidth - el.clientWidth, el.scrollHeight - el.clientHeight))).toBeLessThanOrEqual(1)
  await dialog.locator('.adv-settings-tools').getByRole('button', { name: '关闭', exact: true }).click()
  await expect(dialog).toBeHidden()
})

test('keeps dialogue reading sizes and multiline text clear of controls on a scaled game stage', async ({ page }, info) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto(`${gameUrl}/#/start`)
  await page.getByRole('button', { name: '开始游戏', exact: true }).click()
  await expect(page).toHaveURL(/#\/game/)
  await expect(page.locator('.adv-black, .adv-dialog-box')).toBeVisible()
  const fixedCanvas = await page.evaluate(async () => {
    const app = (document.querySelector('#app') as unknown as { __vue_app__: { _context: { provides: Record<string, AdvContext> } } }).__vue_app__
    const adv = app._context.provides['$advjs-context']
    if (adv.store.current?.kind === 'narration')
      await adv.runtime.next()
    return adv.config.value.viewportFit !== 'responsive'
  })
  await expect(page.locator('.adv-dialog-box')).toBeVisible()

  const box = page.locator('.adv-dialog-box')
  const body = box.locator('.dialog-content')
  const name = box.locator('.dialog-name')
  const proof: unknown[] = []
  const artifacts = join(tmpdir(), 'advjs-game-reading-artifacts')
  await mkdir(artifacts, { recursive: true })
  const screenFont = (element: Locator) => element.evaluate((el) => {
    const stage = el.closest<HTMLElement>('#adv-content')!
    return Number.parseFloat(getComputedStyle(el).fontSize) * stage.getBoundingClientRect().width / stage.offsetWidth
  })
  const setPresentation = async (text: string, kind: 'dialog' | 'narration' = 'dialog') => {
    await page.evaluate(({ words, kind }) => {
      const app = (document.querySelector('#app') as unknown as { __vue_app__: { _context: { provides: Record<string, AdvContext> } } }).__vue_app__
      const adv = app._context.provides['$advjs-context']
      // Exercise the real dialogue component and shared host layout through its
      // existing presentation store, without replacing styles or templates.
      adv.store.$syncRuntime(adv.store.state, {
        id: `reading-${kind}-${words.length}`,
        kind,
        data: { text: words, character: '向导' },
      }, adv.store.program!)
    }, { words: text, kind })
    const words = kind === 'dialog' ? body.locator('.print-words') : page.locator('.adv-black .print-words')
    await expect(words).toHaveText(text)
    await expect(words.locator('.invisible')).toHaveCount(0)
    if (kind === 'dialog')
      await expect(name).toHaveText('向导')
  }
  const chooseSize = async (label: string) => {
    await page.getByRole('button', { name: '设置', exact: true }).click()
    const settings = page.getByRole('dialog', { name: '设置', exact: true })
    await settings.getByRole('tab', { name: '对白', exact: true }).click()
    const choice = settings.getByRole('group', { name: '字体大小', exact: true }).getByRole('button', { name: label, exact: true })
    await choice.click()
    await expect(choice).toHaveAttribute('aria-pressed', 'true')
    return settings
  }
  const closeSettings = async (settings: Locator) => {
    await settings.getByRole('button', { name: '关闭', exact: true }).first().click()
    await expect(settings).toBeHidden()
  }
  const tiers = [
    { label: '小', logical: 20, floor: 16 },
    { label: '中', logical: 22, floor: 18 },
    { label: '大', logical: 30, floor: 26 },
    { label: '超大', logical: 36, floor: 32 },
  ]

  await setPresentation('清晨的光照进房间。')
  for (const tier of tiers) {
    const settings = await chooseSize(tier.label)
    await expect(settings.locator('.adv-dialog-reading')).toHaveCSS('font-size', `${tier.logical}px`)
    await closeSettings(settings)
    await expect(body).toHaveCSS('font-size', `${tier.logical}px`)
    await expect.poll(() => screenFont(name)).toBeCloseTo(tier.logical * 10 / 11, 1)
  }
  await page.screenshot({ path: join(artifacts, `dialogue-normal-${info.project.name}.png`) })

  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(() => page.locator('#adv-content').evaluate(el => el.clientWidth)).toBe(fixedCanvas ? 1920 : 390)
  for (const tier of tiers) {
    const settings = await chooseSize(tier.label)
    await expect(settings.locator('.adv-dialog-reading')).toHaveCSS('--adv-reading-size', `${tier.logical}px`)
    await closeSettings(settings)
    const expected = fixedCanvas ? tier.floor : tier.logical - 2
    await expect.poll(() => screenFont(body)).toBeCloseTo(expected, 1)
    await expect.poll(() => screenFont(name)).toBeCloseTo(expected * 10 / 11, 1)
    proof.push({ tier: tier.label, body: await screenFont(body), name: await screenFont(name) })
  }
  const settings = await chooseSize('中')
  await closeSettings(settings)
  for (const [key, text] of [
    ['short', '清晨的光照进房间。'],
    ['multiline', '窗边的来信带着清晨的光。我们沿着房间里的线索寻找答案。'],
  ]) {
    await setPresentation(text)
    await expect.poll(() => screenFont(body)).toBeGreaterThanOrEqual(17.9)
    const geometry = await body.evaluate((el) => {
      const stage = el.closest('#adv-content')!.getBoundingClientRect()
      const body = el.getBoundingClientRect()
      const words = el.querySelector('.print-words')!.getBoundingClientRect()
      const name = document.querySelector('.dialog-name')!.getBoundingClientRect()
      const controls = document.querySelector('.dialog-controls-shell')!.getBoundingClientRect()
      const scale = Number(getComputedStyle(el).getPropertyValue('--adv-screen-scale'))
      return { stage: stage.toJSON(), body: body.toJSON(), name: name.toJSON(), controls: controls.toJSON(), lines: words.height / (Number.parseFloat(getComputedStyle(el).lineHeight) * scale) }
    })
    expect(geometry.body.y).toBeGreaterThanOrEqual(geometry.stage.y - 1)
    expect(geometry.name.y).toBeGreaterThanOrEqual(geometry.stage.y - 1)
    expect(geometry.body.y + geometry.body.height).toBeLessThanOrEqual(geometry.controls.y - 1)
    expect(geometry.name.y + geometry.name.height).toBeLessThanOrEqual(geometry.controls.y - 1)
    if (key === 'multiline')
      expect(geometry.lines).toBeGreaterThanOrEqual(1.9)
    proof.push({ key, ...geometry })
    await page.screenshot({ path: join(artifacts, `dialogue-${key}-390-${info.project.name}.png`) })
  }

  const narration = page.locator('.adv-black .words-wrapper')
  for (const viewport of [{ width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    await setPresentation('窗边的来信带着清晨的光。我们沿着房间里的线索寻找答案。', 'narration')
    for (const tier of tiers) {
      const settings = await chooseSize(tier.label)
      await closeSettings(settings)
      const expected = viewport.width === 1920 ? tier.logical : fixedCanvas ? tier.floor : tier.logical - 2
      await expect.poll(() => screenFont(narration)).toBeCloseTo(expected, 1)
      proof.push({ surface: 'narration', width: viewport.width, tier: tier.label, font: await screenFont(narration) })
    }
    const settings = await chooseSize('中')
    await closeSettings(settings)
    const bounds = await narration.boundingBox()
    const controls = await page.locator('.dialog-controls-shell').boundingBox()
    const stage = await page.locator('#adv-content').boundingBox()
    expect(bounds!.y).toBeGreaterThanOrEqual(stage!.y - 1)
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(controls!.y - 1)
    proof.push({ surface: 'narration', width: viewport.width, bounds, controls })
    await page.screenshot({ path: join(artifacts, `narration-${viewport.width}-${info.project.name}.png`) })
    if (viewport.width === 390) {
      await setPresentation('清晨的光照进房间。', 'narration')
      const short = await narration.boundingBox()
      expect(short!.y).toBeGreaterThanOrEqual(stage!.y - 1)
      expect(short!.y + short!.height).toBeLessThanOrEqual(controls!.y - 1)
      proof.push({ surface: 'narration', width: 390, key: 'short', bounds: short, controls })
      await page.screenshot({ path: join(artifacts, `narration-short-390-${info.project.name}.png`) })
    }
  }
  await writeFile(join(artifacts, `reading-proof-${info.project.name}.json`), JSON.stringify(proof, null, 2))
})
