import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const scriptRoot = dirname(fileURLToPath(import.meta.url))
const outputRoot = resolve(scriptRoot, '../../../temp/hamster-art/qa-playtest')
const baseUrl = process.env.ADV_HAMSTER_PLAYTEST_URL || 'http://127.0.0.1:3334/'

async function waitForRuntime(page) {
  await page.waitForFunction(() => {
    const adv = window.$adv
    return adv?.store?.state?.status && adv.store.state.status !== 'idle'
  })
}

async function advanceUntil(page, target) {
  return page.evaluate(async (pauseAt) => {
    const adv = window.$adv
    if (!adv?.runtime)
      throw new Error('ADV runtime is unavailable')

    for (let step = 0; step < 900; step++) {
      const state = adv.store.state
      const current = adv.store.current
      if (pauseAt === 'activity' && state.status === 'waiting-activity')
        return state.pendingActivity?.type
      if (pauseAt === 'cg' && state.stage.cg)
        return state.stage.cg
      if (state.status === 'ended')
        return state.cursor.chapterId

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

async function capture(page, name) {
  await page.screenshot({
    animations: 'disabled',
    path: resolve(outputRoot, `${name}.png`),
  })
}

async function startMainRoute(page) {
  await page.getByRole('button', { name: /开始观测/ }).click()
  await page.waitForURL(/#\/game(?:\?|$)/)
  await waitForRuntime(page)
}

async function completeStarMap(page) {
  await page.getByTestId('rotation').fill('0')
  await page.getByTestId('scale').fill('1')
  await page.getByRole('button', { name: '确认轨迹' }).click()
}

async function captureRoute(page, suffix) {
  await page.goto(baseUrl)
  await page.waitForTimeout(1800)
  await capture(page, `title-${suffix}`)

  await page.getByRole('button', { name: '设置' }).click()
  await page.locator('.hamster-settings').waitFor({ state: 'visible' })
  await page.waitForTimeout(350)
  await capture(page, `settings-${suffix}`)
  await page.keyboard.press('Escape')

  await startMainRoute(page)
  await page.waitForTimeout(2200)
  await capture(page, `opening-narration-${suffix}`)
  await page.evaluate(async () => window.$adv.runtime.next())
  await page.waitForTimeout(500)
  await capture(page, `three-character-dialogue-${suffix}`)

  await advanceUntil(page, 'activity')
  await capture(page, `star-map-${suffix}`)
  await completeStarMap(page)

  await advanceUntil(page, 'cg')
  await page.locator('.adv-cg').waitFor()
  await page.waitForTimeout(1800)
  await capture(page, `cg-${suffix}`)

  await advanceUntil(page, 'activity')
  await page.getByRole('textbox', { name: '文明名称' }).fill(`${suffix} 文明档案`)
  await page.getByRole('button', { name: /记忆/ }).click()
  await page.getByRole('spinbutton', { name: '初始演化等级' }).fill('2')
  await capture(page, `civilization-${suffix}`)
  await page.getByRole('button', { name: '执行初始化' }).click()

  await advanceUntil(page, 'ended')
  await page.getByRole('heading', { name: '观测归档完成' }).waitFor()
  await page.waitForTimeout(500)
  await capture(page, `finale-${suffix}`)
  await page.goto(`${baseUrl}#/gallery`)
  await page.getByText('8 / 8').waitFor()
  await capture(page, `gallery-complete-${suffix}`)
}

await mkdir(outputRoot, { recursive: true })
const browser = await chromium.launch({ headless: true })
try {
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await captureRoute(await desktopContext.newPage(), 'desktop')
  await desktopContext.close()

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await captureRoute(await mobileContext.newPage(), 'mobile')
  await mobileContext.close()
}
finally {
  await browser.close()
}

process.stdout.write(`Captured desktop and mobile playtest evidence in ${outputRoot}\n`)
