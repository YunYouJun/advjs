import type { Locator, Page } from '@playwright/test'
import type { AdvContext } from '../../packages/client/types/context'
import { expect, test } from '@playwright/test'

const starterUrl = 'http://localhost:3333/#/start'

test.use({ locale: 'zh-CN' })

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style')
      style.textContent = '#__advjs-devtools-container__ { display: none; }'
      document.head.append(style)
    }, { once: true })
  })
})

async function session(page: Page) {
  return page.evaluate(() => {
    const adv = (window as Window & { $adv: AdvContext }).$adv
    const snapshot = adv.runtime.snapshot()
    return {
      state: snapshot.state,
      checkpoints: snapshot.checkpoints.length,
      auto: adv.$auto.enabled.value,
      skip: adv.$auto.skipEnabled.value,
      voice: adv.$audio.voicePlaying.value,
      tracks: adv.$audio.inspect().tracks,
    }
  })
}

async function advanceTo(current: Locator, next: Locator) {
  await current.click()
  try {
    await next.waitFor({ state: 'visible', timeout: 500 })
    return
  }
  catch {}
  await current.click()
  await expect(next).toBeVisible()
}

async function start(page: Page) {
  await page.getByRole('button', { name: '开始游戏', exact: true }).click()
  await expect(page).toHaveURL(/#\/game$/)
  await expect(page.locator('.adv-black')).toContainText('这段旁白直接来自一个')
  await expect.poll(async () => (await session(page)).state.status).toBe('playing')
}

async function advanceStory(page: Page) {
  const dialog = page.locator('.adv-dialog-box')
  await advanceTo(page.locator('.adv-black'), dialog.filter({ hasText: '欢迎来到 ADV.JS' }))
  await advanceTo(dialog, page.getByRole('button', { name: '直接开始', exact: true }))
  await page.getByRole('button', { name: '直接开始', exact: true }).click()
  await expect(dialog).toContainText('最小项目已经跑通')
  await expect.poll(async () => (await session(page)).state.variables.greeted).toBe(true)
}

async function returnHome(page: Page) {
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await page.getByRole('dialog', { name: '设置', exact: true }).getByRole('button', { name: '回主菜单', exact: true }).click()
  await expect(page).toHaveURL(/#\/start$/)
  await expect(page.getByRole('heading', { name: 'ADV.JS Starter' })).toBeVisible()
}

test('new game repeatedly resets the advanced story and history while preserving appearance', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(starterUrl)
  await page.getByRole('button', { name: '设置', exact: true }).click()
  const settings = page.getByRole('dialog', { name: '设置', exact: true })
  await settings.getByRole('button', { name: '切换深色模式' }).click()
  const game = page.locator('[data-adv-ui="game"]')
  const appearance = await game.getAttribute('data-adv-color-scheme')
  await page.keyboard.press('Escape')
  await start(page)
  const opening = await session(page)
  for (let iteration = 0; iteration < 2; iteration++) {
    await advanceStory(page)
    expect((await session(page)).checkpoints).toBeGreaterThan(0)
    await returnHome(page)
    // Dismissing Load must not queue a restore or change the next New Game.
    await page.getByRole('button', { name: '加载存档', exact: true }).click()
    await expect(page.getByRole('dialog', { name: '加载存档', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: '加载存档', exact: true })).toBeHidden()
    await start(page)
    expect(await session(page)).toEqual(opening)
    await expect(game).toHaveAttribute('data-adv-color-scheme', appearance!)
    await page.getByRole('button', { name: '回看', exact: true }).click()
    const history = page.getByRole('dialog', { name: '历史记录' })
    await expect(history).toContainText('这段旁白直接来自一个')
    await expect(history).not.toContainText('最小项目已经跑通')
    await expect(history).not.toContainText('欢迎来到 ADV.JS')
    await page.keyboard.press('Escape')
  }
  await test.info().attach('new-game-opening-after-two-restarts', { body: await page.screenshot(), contentType: 'image/png' })
  expect(errors).toEqual([])
})

test('loading a saved game then starting new preserves the save and discards its session', async ({ page }) => {
  await page.goto(starterUrl)
  await start(page)
  const opening = await session(page)
  await advanceStory(page)
  const saved = await session(page)
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await page.getByRole('dialog', { name: '设置', exact: true }).getByRole('button', { name: '存储存档', exact: true }).click()
  const saveDialog = page.getByRole('dialog', { name: '存储存档', exact: true })
  await saveDialog.getByRole('button', { name: '保存到存档 #1', exact: true }).click()
  await expect(saveDialog.locator('[data-save-kind="manual"][data-save-index="1"]')).toHaveAttribute('data-save-filled', 'true')
  await page.keyboard.press('Escape')
  await returnHome(page)

  async function loadSaved() {
    await page.getByRole('button', { name: '加载存档', exact: true }).click()
    const loadDialog = page.getByRole('dialog', { name: '加载存档', exact: true })
    await loadDialog.getByRole('button', { name: '手动存档第 1 页', exact: true }).click()
    await loadDialog.getByRole('button', { name: '读取存档 #1', exact: true }).click()
    await expect(page).toHaveURL(/#\/game$/)
    await expect(page.locator('.adv-dialog-box')).toContainText('最小项目已经跑通')
    expect((await session(page)).state).toEqual(saved.state)
  }
  await loadSaved()
  await returnHome(page)
  await start(page)
  expect(await session(page)).toEqual(opening)
  await returnHome(page)
  await loadSaved()
  await test.info().attach('saved-game-preserved-after-new-game', { body: await page.screenshot(), contentType: 'image/png' })
})
