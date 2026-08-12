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
    await page.getByTitle('快速存档').click()
    await expect(page.getByRole('status')).toHaveText('已快速存档')
    await page.evaluate(async () => (window as any).$adv.runtime.next())
    const quickAdvancedCursor = await page.evaluate(() => ({ ...(window as any).$adv.store.state.cursor }))
    expect(quickAdvancedCursor).not.toEqual(savedCursor)
    await page.getByTitle('快速读档').click()
    await expect.poll(() => page.evaluate(() => ({ ...(window as any).$adv.store.state.cursor }))).toEqual(savedCursor)

    await page.getByTitle('存储存档').click()
    await expect(page.getByText('存储存档', { exact: true })).toBeVisible()
    const firstSaveCard = page.locator('.saved-card').first()
    await firstSaveCard.locator('.preview-image-container').click()
    await expect(firstSaveCard).toContainText('观测者')
    await expect.poll(() => page.evaluate(() => {
      const record = JSON.parse(localStorage.getItem('advjs:records:1') || 'null')
      return record?.metadata?.thumbnail?.startsWith('data:image/png') ?? false
    })).toBe(true)
    await page.keyboard.press('Escape')
    await page.evaluate(async () => (window as any).$adv.runtime.next())
    const advancedCursor = await page.evaluate(() => ({ ...(window as any).$adv.store.state.cursor }))
    expect(advancedCursor).not.toEqual(savedCursor)
    await page.evaluate(() => (window as any).$adv.runtime.back())
    await expect.poll(() => page.evaluate(() => ({ ...(window as any).$adv.store.state.cursor }))).toEqual(savedCursor)
    await page.evaluate(async () => (window as any).$adv.runtime.next())
    await page.getByTitle('加载存档').click()
    await expect(page.getByText('加载存档', { exact: true })).toBeVisible()
    const loadModal = page.locator('.modal-mask')
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
    await firstLoadCard.locator('.preview-image-container').click()
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
    const mobileSettingsButton = page.locator('.menu-setting-button')
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

    await page.getByTitle('加载存档').click()
    const mobileLoadModal = page.locator('.modal-mask')
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
