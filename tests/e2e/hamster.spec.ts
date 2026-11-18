import type { Page, TestInfo } from '@playwright/test'
import { expect, test } from '@playwright/test'

test.use({ locale: 'zh-CN' })

const demoUrl = 'http://127.0.0.1:3334/'

interface RuntimePause {
  chapterId: string
  nodeId: string
  status: string
  activity?: string
  cg?: string
}

async function waitForRuntime(page: Page) {
  await page.waitForFunction(() => {
    const adv = (window as any).$adv
    return adv?.store?.state?.status && adv.store.state.status !== 'idle'
  })
}

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  })
}

async function advanceUntil(page: Page, target: 'activity' | 'cg' | 'ended'): Promise<RuntimePause> {
  return page.evaluate(async (pauseAt) => {
    const adv = (window as any).$adv
    if (!adv?.runtime)
      throw new Error('ADV runtime is unavailable')

    for (let step = 0; step < 900; step++) {
      const state = adv.store.state
      const current = adv.store.current
      const result = {
        chapterId: state.cursor.chapterId,
        nodeId: state.cursor.nodeId,
        status: state.status,
        activity: state.pendingActivity?.type,
        cg: state.stage.cg || undefined,
      }

      if (pauseAt === 'activity' && state.status === 'waiting-activity')
        return result
      if (pauseAt === 'cg' && state.stage.cg)
        return result
      if (state.status === 'ended')
        return result

      if (state.status === 'playing') {
        await adv.runtime.next()
        continue
      }
      if (state.status === 'waiting-choice') {
        const option = current?.data?.options?.[0]
        if (!option?.id)
          throw new Error('No visible choice can advance the route')
        await adv.runtime.choose(option.id)
        continue
      }
      if (state.status === 'waiting-activity')
        throw new Error(`Unexpected activity ${state.pendingActivity?.type}`)
      throw new Error(`Unexpected runtime status ${state.status}`)
    }
    throw new Error(`Runtime did not reach ${pauseAt} within 900 transitions`)
  }, target)
}

test.describe('Hamster flagship demo', () => {
  test.describe.configure({ mode: 'serial' })

  test('uses the orbital archive title, settings, gallery, and minimal credits', async ({ page }, testInfo) => {
    await page.goto(demoUrl)

    await expect(page.getByRole('heading', { name: /仓鼠/ })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('星海回声', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /开始观测/ })).toBeVisible()
    await expect(page.getByRole('button', { name: '回声演算' })).toHaveCount(0)
    await attachScreenshot(page, testInfo, 'title-desktop')

    const titleText = await page.locator('body').textContent()
    for (const forbidden of ['第一篇', '续作', '原作主线', '正史模式', 'A+'])
      expect(titleText).not.toContain(forbidden)

    await page.getByRole('button', { name: '设置' }).click()
    await expect(page.getByRole('heading', { name: '观测参数' })).toBeVisible()
    await expect(page.getByText('场景动态效果')).toBeVisible()
    await page.getByRole('button', { name: /克制/ }).click()
    await expect(page.getByRole('button', { name: /克制/ })).toHaveClass(/active/)
    await attachScreenshot(page, testInfo, 'settings-desktop')
    await page.keyboard.press('Escape')
    await expect(page.locator('.hamster-settings')).toBeHidden()

    await page.getByRole('link', { name: 'CG 回廊' }).click()
    await expect(page).toHaveURL(/#\/gallery$/)
    await expect(page.getByRole('heading', { name: 'CG 回廊' })).toBeVisible()
    await expect(page.getByText('0 / 8')).toBeVisible()
    await expect(page.getByRole('button', { name: '尚未解锁的 CG' })).toHaveCount(8)
    await attachScreenshot(page, testInfo, 'gallery-locked-desktop')

    await page.getByRole('link', { name: '返回标题' }).click()
    await page.getByRole('link', { name: '关于' }).click()
    await expect(page).toHaveURL(/#\/credits$/)
    await expect(page.getByRole('heading', { name: '关于' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'YunYouJun《仓鼠》' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'YunYouJun《仓生》' })).toBeVisible()
    await expect(page.getByText('CC BY-NC-SA 4.0')).toBeVisible()
  })

  test('plays the seamless 16-chapter route, unlocks eight CGs, then starts the echo simulation', async ({ page }, testInfo) => {
    test.setTimeout(60_000)
    const failedResponses: string[] = []
    page.on('response', (response) => {
      if (response.status() >= 400)
        failedResponses.push(`${response.status()} ${response.url()}`)
    })

    await page.goto(demoUrl)
    await page.getByRole('button', { name: /开始观测/ }).click()
    await page.waitForURL(/#\/game(?:\?|$)/)
    await waitForRuntime(page)
    await expect.poll(() => page.evaluate(() => Object.keys(localStorage).filter(key => key.includes('record')))).toContain('advjs:records:auto%3A1')

    await expect(page.locator('.adv-background')).toHaveAttribute('data-transition', 'crossfade')
    await expect(page.locator('.tachie-character')).toHaveCount(2)
    await expect(page.locator('.adv-black')).toContainText('冷气把盛夏挡在玻璃幕墙之外')
    await expect(page.locator('.tachie-sprite')).toBeVisible()
    await attachScreenshot(page, testInfo, 'opening-narration-desktop')

    await page.evaluate(async () => (window as any).$adv.runtime.next())
    await expect(page.locator('.adv-dialog-box')).toBeVisible()
    await expect(page.locator('.tachie-character')).toHaveCount(3)
    const spriteBounds = await page.locator('.tachie-sprite').boundingBox()
    const dialogBounds = await page.locator('.adv-dialog-box').boundingBox()
    expect(spriteBounds).not.toBeNull()
    expect(dialogBounds).not.toBeNull()
    expect(spriteBounds!.y + spriteBounds!.height).toBeLessThanOrEqual(dialogBounds!.y + 4)
    await attachScreenshot(page, testInfo, 'three-character-dialogue-desktop')

    const savedCursor = await page.evaluate(() => ({ ...(window as any).$adv.store.state.cursor }))
    await page.getByRole('button', { name: '快速存档', exact: true }).click()
    await expect(page.getByRole('status')).toHaveText('已快速存档')
    await page.evaluate(async () => (window as any).$adv.runtime.next())
    const quickAdvancedCursor = await page.evaluate(() => ({ ...(window as any).$adv.store.state.cursor }))
    expect(quickAdvancedCursor).not.toEqual(savedCursor)
    await page.getByRole('button', { name: '快速读档', exact: true }).click()
    await expect(page.getByRole('status')).toHaveText('已加载快速存档')
    await expect.poll(() => page.evaluate(() => ({ ...(window as any).$adv.store.state.cursor }))).toEqual(savedCursor)

    await page.getByRole('button', { name: '存档', exact: true }).click()
    const saveModal = page.getByRole('dialog', { name: '存储存档', exact: true })
    await expect(saveModal).toBeVisible()
    await expect(saveModal.getByRole('heading', { name: '存储存档', level: 1, exact: true })).toBeVisible()
    const firstSaveCard = saveModal.locator('.saved-card[data-save-kind="manual"][data-save-index="1"]')
    await firstSaveCard.getByRole('button', { name: '保存到存档 #1', exact: true }).click()
    await expect(firstSaveCard).toContainText('观测者')
    await expect.poll(() => page.evaluate(() => {
      const record = JSON.parse(localStorage.getItem('advjs:records:1') || 'null')
      return record?.metadata?.thumbnail?.startsWith('data:image/png') ?? false
    })).toBe(true)
    await page.keyboard.press('Escape')
    await expect(saveModal).toBeHidden()
    await page.evaluate(async () => (window as any).$adv.runtime.next())
    const advancedCursor = await page.evaluate(() => ({ ...(window as any).$adv.store.state.cursor }))
    expect(advancedCursor).not.toEqual(savedCursor)
    await page.evaluate(() => (window as any).$adv.runtime.back())
    await expect.poll(() => page.evaluate(() => ({ ...(window as any).$adv.store.state.cursor }))).toEqual(savedCursor)
    await page.evaluate(async () => (window as any).$adv.runtime.next())
    await page.getByRole('button', { name: '读档', exact: true }).click()
    const loadModal = page.getByRole('dialog', { name: '加载存档', exact: true })
    await expect(loadModal).toBeVisible()
    await expect(loadModal.getByRole('heading', { name: '加载存档', level: 1, exact: true })).toBeVisible()
    const systemPageButton = loadModal.locator('[data-save-page="system"]')
    const saveMenuShell = loadModal.locator('.save-menu-shell')
    const swiperWrapper = loadModal.locator('.swiper-wrapper')
    await expect(systemPageButton).toContainText('自动')
    await expect(systemPageButton).toHaveCSS('white-space', 'nowrap')
    await expect(loadModal).toHaveAttribute('data-motion', 'full')
    await expect(saveMenuShell).toHaveAttribute('data-motion', 'full')
    await expect(loadModal.locator('.swiper-creative')).toHaveCount(0)
    expect(await systemPageButton.evaluate(button => button.scrollWidth <= button.clientWidth)).toBe(true)
    await attachScreenshot(page, testInfo, 'save-load-menu-desktop')
    await loadModal.locator('[data-save-page="1"]').click()
    await expect.poll(() => swiperWrapper.evaluate(element => (element as HTMLElement).style.transitionDuration)).toBe('200ms')
    const firstLoadCard = loadModal.locator('.saved-card[data-save-kind="manual"][data-save-index="1"]')
    await expect(firstLoadCard).toContainText('观测者')

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(loadModal).toHaveAttribute('data-motion', 'none')
    await expect(saveMenuShell).toHaveAttribute('data-motion', 'none')
    await systemPageButton.click()
    await expect.poll(() => swiperWrapper.evaluate(element => (element as HTMLElement).style.transitionDuration)).toBe('0ms')

    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await loadModal.locator('[data-save-page="1"]').click()
    await expect(firstLoadCard).toContainText('观测者')
    await firstLoadCard.getByRole('button', { name: '读取存档 #1', exact: true }).click()
    await expect(loadModal).toBeHidden()
    await expect.poll(() => page.evaluate(() => ({ ...(window as any).$adv.store.state.cursor }))).toEqual(savedCursor)

    const firstActivity = await advanceUntil(page, 'activity')
    expect(firstActivity.activity).toBe('star-map/compare')
    await expect(page.getByRole('heading', { name: '星图比对' })).toBeVisible()
    const starMap = page.getByRole('application', { name: '可旋转和缩放的星图' })
    await starMap.focus()
    await starMap.press('ArrowRight')
    await page.getByTestId('rotation').fill('0')
    await page.getByTestId('scale').fill('1')
    await expect(page.getByRole('button', { name: '确认轨迹' })).toBeEnabled()
    await attachScreenshot(page, testInfo, 'star-map-desktop')
    await page.getByRole('button', { name: '确认轨迹' }).click()

    const firstCgAfterComparison = await advanceUntil(page, 'cg')
    expect(firstCgAfterComparison.cg).toBe('old-world-collapse')
    await expect(page.locator('.adv-cg[data-cg-id="old-world-collapse"]')).toBeVisible()
    await expect(page.locator('.adv-cg img')).toHaveAttribute('alt', /数据碎片/)
    await attachScreenshot(page, testInfo, 'cg-desktop')

    const secondActivity = await advanceUntil(page, 'activity')
    expect(secondActivity.activity).toBe('civilization/initialize')
    await expect(page.getByRole('heading', { name: '文明播种协议' })).toBeVisible()
    await page.getByRole('textbox', { name: '文明名称' }).fill('仓人文明档案')
    await page.getByRole('button', { name: /记忆/ }).click()
    await page.getByRole('spinbutton', { name: '初始演化等级' }).fill('2')
    await attachScreenshot(page, testInfo, 'civilization-desktop')
    await page.getByRole('button', { name: '执行初始化' }).click()

    const ending = await advanceUntil(page, 'ended')
    expect(ending.status).toBe('ended')
    expect(ending.chapterId).toBe('dim-stars')
    await expect(page.getByRole('heading', { name: '观测归档完成' })).toBeVisible()
    await page.waitForTimeout(500)
    await attachScreenshot(page, testInfo, 'finale-desktop')
    const completedState = await page.evaluate(() => {
      const state = (window as any).$adv.store.state
      return {
        variables: state.variables,
        chapters: [...new Set(state.visited.map((address: string) => address.split('#')[0]))],
      }
    })
    expect(completedState.chapters).toHaveLength(16)
    expect(completedState.variables).toMatchObject({
      canonicalCompleted: true,
      storyMode: 'main',
      ending: 'starlight-echo',
      starMatched: true,
      civilizationLevel: 2,
    })

    await page.goto(`${demoUrl}#/gallery`)
    await expect(page.getByText('8 / 8')).toBeVisible()
    await expect(page.locator('.adv-gallery__item:not(.is-locked)')).toHaveCount(8)
    await page.getByRole('button', { name: '恒星在手' }).click()
    await expect(page.getByRole('dialog', { name: '恒星在手' })).toBeVisible()
    await expect(page.getByRole('button', { name: '下载原图' })).toBeVisible()
    await attachScreenshot(page, testInfo, 'gallery-complete-desktop')
    await page.getByRole('button', { name: '关闭' }).click()

    await page.goto(demoUrl)
    await expect(page.getByRole('button', { name: '回声演算' })).toBeVisible()
    await page.getByRole('button', { name: '回声演算' }).click()
    await page.waitForURL(/#\/game(?:\?|$)/)
    await waitForRuntime(page)
    const echoActivity = await advanceUntil(page, 'activity')
    expect(echoActivity.activity).toBe('star-map/compare')
    expect(echoActivity.chapterId).toBe('hamster-cage')
    const echoState = await page.evaluate(() => (window as any).$adv.store.state.variables)
    expect(echoState).toMatchObject({ canonicalCompleted: true, storyMode: 'echo' })

    expect(failedResponses).toEqual([])
  })

  test('keeps the title, dialogue, and custom settings usable on mobile', async ({ page }, testInfo) => {
    test.setTimeout(60_000)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(demoUrl)

    await expect(page.getByRole('button', { name: /开始观测/ })).toBeVisible()
    await attachScreenshot(page, testInfo, 'title-mobile')
    await page.getByRole('button', { name: '设置' }).click()
    const settings = page.locator('.hamster-settings')
    await expect(settings).toBeVisible()
    await expect(settings).toHaveCSS('overflow-y', 'auto')
    await attachScreenshot(page, testInfo, 'settings-mobile')
    await page.keyboard.press('Escape')
    await expect(settings).toBeHidden()

    await page.getByRole('button', { name: /开始观测/ }).click()
    await page.waitForURL(/#\/game(?:\?|$)/)
    await waitForRuntime(page)
    await expect(page.locator('#adv-content')).toHaveCSS('width', '390px')
    await expect(page.locator('#adv-content')).toHaveCSS('height', '844px')
    const mobileSettingsButton = page.getByRole('button', { name: '设置', exact: true })
    await expect(mobileSettingsButton).toBeVisible()
    const mobileSettingsBounds = await mobileSettingsButton.boundingBox()
    expect(mobileSettingsBounds).not.toBeNull()
    expect(mobileSettingsBounds!.x + mobileSettingsBounds!.width).toBeLessThanOrEqual(390)
    await page.evaluate(async () => (window as any).$adv.runtime.next())
    await expect(page.locator('.adv-dialog-box')).toBeVisible()
    await expect(page.locator('.dialog-name')).toHaveText('观测者')
    await expect(page.locator('.tachie-sprite')).toBeVisible()
    const mobileSprite = await page.locator('.tachie-sprite').boundingBox()
    expect(mobileSprite).not.toBeNull()
    expect(Math.abs(mobileSprite!.width / mobileSprite!.height - 1)).toBeLessThan(0.05)
    await attachScreenshot(page, testInfo, 'dialogue-mobile')

    const devtools = page.locator('#__advjs-devtools-container__')
    const launcher = devtools.getByRole('button', { name: 'ADV.JS DevTools', exact: true })
    await expect(launcher).toBeVisible()
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 })
      await expect(launcher).toBeInViewport({ ratio: 1 })
      await expect.poll(() => launcher.evaluate((button) => {
        const launcher = button.getBoundingClientRect()
        const controls = Array.from(document.querySelectorAll('.game-toolbar-actions, .dialog-controls-shell'))
        return {
          count: controls.length,
          unobstructed: controls.every((element) => {
            const bounds = element.getBoundingClientRect()
            return launcher.right <= bounds.left || launcher.left >= bounds.right
              || launcher.bottom <= bounds.top || launcher.top >= bounds.bottom
          }),
        }
      })).toEqual({ count: 2, unobstructed: true })
    }
    await launcher.click()
    await expect(launcher).toHaveAttribute('aria-expanded', 'true')
    await expect(devtools.getByRole('region', { name: 'ADV.JS 调试面板', exact: true })).toBeVisible()
    await expect(devtools.locator('iframe')).toBeVisible()
    await attachScreenshot(page, testInfo, 'devtools-mobile-open')
    await devtools.getByRole('button', { name: '关闭调试面板', exact: true }).click()
    await expect(launcher).toHaveAttribute('aria-expanded', 'false')
    await expect(launcher).toBeFocused()

    await page.getByRole('button', { name: '读档', exact: true }).click()
    const mobileLoadModal = page.getByRole('dialog', { name: '加载存档', exact: true })
    const mobileSystemPageButton = mobileLoadModal.locator('[data-save-page="system"]')
    await expect(mobileLoadModal).toBeVisible()
    await expect(mobileSystemPageButton).toHaveCSS('white-space', 'nowrap')
    expect(await mobileSystemPageButton.evaluate(button => button.scrollWidth <= button.clientWidth)).toBe(true)
    await attachScreenshot(page, testInfo, 'save-load-menu-mobile')
    await page.keyboard.press('Escape')
    await expect(mobileLoadModal).toBeHidden()

    const bounds = await page.locator('.adv-dialog-box').boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390)

    const starMapPause = await advanceUntil(page, 'activity')
    expect(starMapPause.activity).toBe('star-map/compare')
    await expect(page.getByRole('heading', { name: '星图比对' })).toBeVisible()
    await page.getByTestId('rotation').fill('0')
    await page.getByTestId('scale').fill('1')
    await attachScreenshot(page, testInfo, 'star-map-mobile')
    await page.getByRole('button', { name: '确认轨迹' }).click()

    const cgPause = await advanceUntil(page, 'cg')
    expect(cgPause.cg).toBe('old-world-collapse')
    await expect(page.locator('.adv-cg[data-cg-id="old-world-collapse"]')).toBeVisible()
    await attachScreenshot(page, testInfo, 'cg-mobile')

    const civilizationPause = await advanceUntil(page, 'activity')
    expect(civilizationPause.activity).toBe('civilization/initialize')
    await page.getByRole('textbox', { name: '文明名称' }).fill('移动端文明档案')
    await page.getByRole('button', { name: /记忆/ }).click()
    await page.getByRole('spinbutton', { name: '初始演化等级' }).fill('2')
    await attachScreenshot(page, testInfo, 'civilization-mobile')
    await page.getByRole('button', { name: '执行初始化' }).click()

    const ending = await advanceUntil(page, 'ended')
    expect(ending.chapterId).toBe('dim-stars')
    await expect(page.getByRole('heading', { name: '观测归档完成' })).toBeVisible()
    await page.waitForTimeout(500)
    await attachScreenshot(page, testInfo, 'finale-mobile')

    await page.goto(`${demoUrl}#/gallery`)
    await expect(page.getByText('8 / 8')).toBeVisible()
    await attachScreenshot(page, testInfo, 'gallery-complete-mobile')
  })
})

test('keeps Extras progress across older saves and isolates scene replay', async ({ page }, testInfo) => {
  test.setTimeout(60_000)
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.goto(demoUrl)
  await page.getByRole('button', { name: /开始观测/ }).click()
  await waitForRuntime(page)
  const savedCursor = await page.evaluate(() => ({ ...(window as any).$adv.store.state.cursor }))
  await page.locator('[data-adv-key-controls]').focus()
  await page.keyboard.press('F5')
  await expect.poll(() => page.evaluate(() => localStorage.getItem('advjs:records:quick'))).not.toBeNull()
  await page.getByRole('button', { name: '存档', exact: true }).click()
  const save = page.getByRole('dialog', { name: '存储存档', exact: true })
  await save.getByRole('button', { name: '保存到存档 #1', exact: true }).click()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('advjs:records:1'))).not.toBeNull()
  await page.keyboard.press('Escape')
  await expect(save).toBeHidden()

  expect((await advanceUntil(page, 'activity')).activity).toBe('star-map/compare')
  await page.evaluate(() => (window as any).$adv.runtime.completeActivity({ matched: true, score: 0.91 }))
  expect((await advanceUntil(page, 'activity')).activity).toBe('civilization/initialize')
  await page.evaluate(() => (window as any).$adv.runtime.completeActivity({ name: '仓人文明档案', level: 2, principle: 'memory' }))
  expect((await advanceUntil(page, 'ended')).chapterId).toBe('dim-stars')

  const progressionBeforeLoad = await page.evaluate(() => localStorage.getItem('advjs:progression:hamster:v1'))
  await page.getByRole('button', { name: '返回标题', exact: true }).click()
  await page.getByRole('button', { name: '读取记录', exact: true }).click()
  const titleLoad = page.getByRole('dialog', { name: '加载存档', exact: true })
  await titleLoad.locator('[data-save-page="1"]').click()
  await titleLoad.getByRole('button', { name: '读取存档 #1', exact: true }).click()
  await expect.poll(() => page.evaluate(() => ({ ...(window as any).$adv.store.state.cursor }))).toEqual(savedCursor)
  expect(await page.evaluate(() => (window as any).$adv.store.state.variables.canonicalCompleted)).toBe(false)
  await page.evaluate(async () => (window as any).$adv.runtime.next())
  expect(await page.evaluate(() => localStorage.getItem('advjs:progression:hamster:v1'))).toBe(progressionBeforeLoad)

  await page.goto(`${demoUrl}#/extras`)
  await expect(page.getByRole('tab', { name: /结局/ })).toContainText('1 / 4')
  await expect(page.getByRole('heading', { name: '星光回响' })).toBeVisible()
  await attachScreenshot(page, testInfo, 'extras-endings-desktop')
  await page.getByRole('tab', { name: /结局/ }).press('ArrowRight')
  await expect(page.getByRole('tab', { name: /成就/ })).toBeFocused()
  await expect(page.getByRole('tab', { name: /成就/ })).toContainText('4 / 4')
  await expect(page.getByRole('heading', { name: '观测归档' })).toBeVisible()
  await page.getByRole('tab', { name: /音乐鉴赏/ }).click()
  const firstTrack = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: '盛夏日常' }) })
  await firstTrack.getByRole('button', { name: '播放', exact: true }).click()
  await expect(firstTrack).toContainText('正在播放')
  await expect.poll(() => page.evaluate(() => {
    const tracks = (window as any).$adv.$audio.inspect().tracks
    return tracks.some((track: { bus: string, status: string }) => track.bus === 'music' && track.status === 'playing')
  })).toBe(true)
  await firstTrack.getByRole('button', { name: '停止', exact: true }).click()
  await expect(firstTrack.getByRole('button', { name: '播放', exact: true })).toBeVisible()
  await page.getByRole('link', { name: /路线图/ }).click()
  await expect(page).toHaveURL(/#\/flow-chart$/)
  await expect(page.locator('.vue-flow__node').filter({ hasText: '夏日午后' })).toBeInViewport({ ratio: 1 })
  await expect(page.locator('.vue-flow__node').filter({ hasText: '仍在仰望' })).toHaveCount(0)
  await attachScreenshot(page, testInfo, 'extras-route-desktop')
  await page.goBack()
  await page.getByRole('tab', { name: /回想/ }).click()
  await attachScreenshot(page, testInfo, 'extras-complete-desktop')
  const recordsBeforeReplay = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(key => key.startsWith('advjs:')).map(key => [key, localStorage.getItem(key)])))
  await page.getByRole('button', { name: '回想', exact: true }).first().click()
  await page.waitForURL(/#\/replay\?id=summer-afternoon/)
  await waitForRuntime(page)
  await expect(page.getByRole('button', { name: /结束回想/ })).toBeVisible()
  await page.locator('[data-adv-key-controls]').focus()
  await page.keyboard.press('F9')
  await expect(page.getByRole('status').filter({ hasText: '暂无快速存档' })).toBeVisible()
  const replayCursor = await page.evaluate(() => ({ ...(window as any).$adv.store.state.cursor }))
  await page.keyboard.press('F5')
  await expect(page.getByRole('status').filter({ hasText: '已快速存档' })).toBeVisible()
  await page.evaluate(async () => (window as any).$adv.runtime.next())
  await page.keyboard.press('F9')
  await expect(page.getByRole('status').filter({ hasText: '已加载快速存档' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => ({ ...(window as any).$adv.store.state.cursor }))).toEqual(replayCursor)
  await page.evaluate(async () => {
    const adv = (window as any).$adv
    for (let step = 0; step < 30 && adv.store.state.status === 'playing'; step++)
      await adv.runtime.next()
  })
  await page.getByRole('button', { name: '调低音量，先照顾仓鼠' }).click()
  const replayFinished = page.getByRole('dialog', { name: '回想结束' })
  await expect(replayFinished).toBeVisible()
  await attachScreenshot(page, testInfo, 'extras-replay-finished-desktop')
  await replayFinished.getByRole('button', { name: '返回附录' }).click()
  await page.waitForURL(/#\/extras$/)
  expect(await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(key => key.startsWith('advjs:')).map(key => [key, localStorage.getItem(key)])))).toEqual(recordsBeforeReplay)

  await page.getByRole('link', { name: /返回标题/ }).click()
  await expect(page.getByRole('button', { name: '回声演算' })).toBeVisible()
  expect(pageErrors).toEqual([])
})

test('renders locked Extras on a narrow screen', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(demoUrl)
  await page.getByRole('link', { name: '观测附录' }).click()
  await expect(page.getByRole('tab', { name: /结局/ })).toContainText('0 / 4')
  await expect(page.getByRole('tab', { name: /音乐鉴赏/ })).toBeInViewport()
  await attachScreenshot(page, testInfo, 'extras-locked-mobile')
})
