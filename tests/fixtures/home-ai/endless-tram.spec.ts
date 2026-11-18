import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { pauseStream, test } from './sse-replay'

const locales = [
  {
    home: '/',
    htmlLang: 'zh-CN',
    title: '面向 AI 时代',
    ai: /^AI 模式/,
    dialog: 'AI 模式：无尽列车',
    provider: '服务商',
    address: '服务地址',
    model: '模型',
    key: '密钥',
    depart: '测试并发车',
    next: /^(显示整句|下一句)$/,
    firstChoice: '坐到下一站看看',
    writing: '正在写下一站',
    repairing: '引擎发现问题，正在修正',
    fallback: '这一站没写好，先用备用段',
    tunnel: '隧道',
    tunnelChoice: '继续坐着',
    getOff: '下车',
    ticket: '无尽列车',
    ticketCount: '本次乘车经过 3 站',
    rideAgain: '再坐一趟',
    language: 'Simplified Chinese',
    speaker: '小云',
    memory: '桥边的灯',
    stops: [
      { name: '雨桥', line: '车门打开，你看见桥边亮着一盏灯。', choice: '记下这盏灯', alternate: '继续乘车' },
      { name: '纸船', line: '一只纸船从你脚边漂过。', choice: '跟着纸船走', alternate: '留在车上' },
    ],
  },
  {
    home: '/en/',
    htmlLang: 'en-US',
    title: 'The Markdown visual novel engine',
    ai: /^AI mode/,
    dialog: 'AI mode: The Endless Tram',
    provider: 'Provider',
    address: 'Base URL',
    model: 'Model',
    key: 'API key',
    depart: 'Test and depart',
    next: /^(Show full line|Next line)$/,
    firstChoice: 'Ride on to the next stop',
    writing: 'Writing the next stop',
    repairing: 'The engine found problems; fixing them',
    fallback: 'That stop didn\'t come out right; a stand-in takes its place',
    tunnel: 'Tunnel',
    tunnelChoice: 'Stay in your seat',
    getOff: 'Get off',
    ticket: 'The Endless Tram',
    ticketCount: '3 stops on this ride',
    rideAgain: 'Ride again',
    language: 'English',
    speaker: 'Xiaoyun',
    memory: 'A lamp by the bridge',
    stops: [
      { name: 'Rain Bridge', line: 'The doors open. You see a lamp beside the bridge.', choice: 'Remember the lamp', alternate: 'Ride on' },
      { name: 'Paper Boat', line: 'A paper boat drifts past your feet.', choice: 'Follow the paper boat', alternate: 'Stay on board' },
    ],
  },
] as const

type Locale = typeof locales[number]
type Stop = Locale['stops'][number]

const replayModel = 'endless-tram-replay'
const badReply = { first: '## Invalid stop\n\nA plain paragraph with no choices.\n' }
const aiChunk = /\/assets\/chunks\/(?:run|HomeAiSettings|TramAiLayer|settings|markdown|yaml|json)\.[^/]+\.js$/

function demo(page: Page) {
  return page.locator('#script')
}

function choice(page: Page, title: string) {
  return demo(page).getByRole('tabpanel').getByRole('button', { name: title })
}

function narration(page: Page) {
  return demo(page).locator('.said [aria-hidden="true"]')
}

function stopSource(page: Page, stop: number) {
  return demo(page).locator(`[aria-label$="adv/chapters/s${stop}/01.adv.md"]`)
}

function script(stop: Stop, memory?: string) {
  const actions = memory
    ? ['\n', '  ```yaml', '  actions:', '    - type: variables/push-unique', '      key: memories', `      value: ${memory}`, '  ```'].join('\n')
    : ''
  return {
    title: `---\nplotSummary: ${stop.name}\n---\n\n## ${stop.name}\n\n`,
    body: `> ${stop.line}\n\n- ${stop.choice}${actions}\n\n- ${stop.alternate}\n`,
  }
}

async function openSettings(page: Page, t: Locale) {
  await demo(page).getByRole('button', { name: t.ai }).click()
  const dialog = page.getByRole('dialog', { name: t.dialog })
  await expect(dialog).toBeVisible()
  const bounds = (await dialog.boundingBox())!
  const viewport = page.viewportSize()!
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.y).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width)
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height)
  return dialog
}

async function depart(page: Page, t: Locale, baseURL: string, dialog: Locator) {
  await dialog.getByLabel(t.provider).selectOption('custom')
  await dialog.getByLabel(t.address, { exact: true }).fill(baseURL)
  await dialog.getByLabel(t.model, { exact: true }).fill(replayModel)
  const key = dialog.getByLabel(t.key, { exact: true })
  await expect(key).toHaveAttribute('type', 'password')
  await expect(key).toHaveAttribute('autocomplete', 'off')
  await key.fill('fixture-only')
  await dialog.getByRole('button', { name: t.depart }).click()
  await expect(dialog).toBeHidden()
  await expect(demo(page).getByRole('button', { name: t.getOff, exact: true })).toBeVisible()
  expect(await page.evaluate(() => ({
    session: sessionStorage.getItem('advjs:home-ai') !== null,
    local: localStorage.getItem('advjs:home-ai') !== null,
  }))).toEqual({ session: true, local: false })
}

async function choose(page: Page, t: Locale, label: string) {
  const button = choice(page, label)
  const next = demo(page).getByRole('tabpanel').getByRole('button', { name: t.next })
  while (!await button.isVisible()) {
    await expect(next.or(button).first()).toBeVisible()
    if (await button.isVisible())
      break
    await next.click()
  }
  await button.click()
}

for (const t of locales) {
  test(`${t.home} streams three stops, repairs one and plays the localized fallback`, async ({ page, replay }, testInfo) => {
    const narrow = t.home === '/'
    if (narrow)
      await page.setViewportSize({ width: 320, height: 800 })
    const requests: string[] = []
    const pageErrors: string[] = []
    page.on('request', request => requests.push(new URL(request.url()).pathname))
    page.on('pageerror', error => pageErrors.push(error.message))
    page.on('console', (message) => {
      if (/\[home\]|hydration|\[Vue warn\]/i.test(message.text()))
        pageErrors.push(message.text())
    })

    const response = await page.goto(t.home)
    expect(await response!.text()).toContain(`<html lang="${t.htmlLang}"`)
    await expect(page.locator('html')).toHaveAttribute('lang', t.htmlLang)
    await expect(page).toHaveTitle(new RegExp(t.title))
    await expect(page.locator('.adv-home.is-ready')).toBeVisible()
    await expect(demo(page).getByRole('button', { name: t.ai })).toHaveAttribute('aria-pressed', 'false')
    expect(requests.filter(path => aiChunk.test(path))).toEqual([])
    expect(replay.requests).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width)

    const dialog = await openSettings(page, t)
    if (narrow)
      await testInfo.attach('zh-settings-320px', { body: await page.screenshot(), contentType: 'image/png' })
    await depart(page, t, replay.baseURL, dialog)
    expect(requests.some(path => /\/run\.[^/]+\.js$/.test(path))).toBe(true)
    expect(replay.requests).toEqual([expect.objectContaining({ stream: false, model: replayModel, max_tokens: 1 })])
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width)

    const [first, second] = t.stops
    const firstScript = script(first, t.memory)
    const secondScript = script(second)
    const firstReply = pauseStream(firstScript.title, firstScript.body)
    const repair = pauseStream(secondScript.title, secondScript.body)
    replay.enqueue(firstReply.reply, badReply, repair.reply, badReply, badReply)

    await choose(page, t, t.firstChoice)
    await expect(demo(page).getByText(t.writing, { exact: true })).toBeVisible()
    await expect(demo(page).locator('.board-title')).toHaveText(first.name)
    await expect(stopSource(page, 1)).toContainText(first.name)
    await expect(stopSource(page, 1)).not.toContainText(first.line)
    firstReply.release()
    await expect(narration(page)).toHaveText(first.line)

    await choose(page, t, first.choice)
    await expect(demo(page).getByText(t.repairing, { exact: true })).toBeVisible()
    await expect(stopSource(page, 2)).toContainText(second.name)
    repair.release()
    await expect(narration(page)).toHaveText(second.line)

    await choose(page, t, second.choice)
    await expect(demo(page).getByText(t.fallback, { exact: true })).toBeVisible()
    await expect(stopSource(page, 3)).toContainText(`## ${t.tunnel} {#s3}`)
    await expect(choice(page, t.tunnelChoice)).toBeVisible({ timeout: 12_000 })

    await demo(page).getByRole('button', { name: t.getOff, exact: true }).click()
    const ticket = demo(page).getByRole('article', { name: t.ticket })
    await expect(ticket.getByText(t.ticketCount)).toBeVisible()
    await expect(ticket.locator('ol li')).toHaveText([first.name, second.name, t.tunnel])
    await expect(ticket.getByText(t.memory, { exact: true })).toBeVisible()
    await expect(ticket.getByText('150 tokens')).toBeVisible()
    await testInfo.attach(narrow ? 'zh-ticket-320px' : 'en-ticket-desktop', {
      body: await page.screenshot(),
      contentType: 'image/png',
    })
    await ticket.getByRole('button', { name: t.rideAgain }).click()
    await expect(ticket).toBeHidden()
    await expect(demo(page).locator('.stop-name')).toHaveCount(1)

    const generations = replay.requests.slice(1)
    expect(generations).toHaveLength(5)
    for (const { stream, messages } of generations) {
      expect(stream).toBe(true)
      expect(messages[0].content).toContain(`Write every word of the story in ${t.language}.`)
      expect(messages[0].content).toContain(`Only these characters may speak: ${t.speaker}`)
    }
    for (const [index, label] of [t.firstChoice, first.choice, first.choice, second.choice, second.choice].entries())
      expect(generations[index].messages[1].content).toContain(`<player-action>${label}</player-action>`)
    for (const index of [2, 4])
      expect(generations[index].messages.at(-2)).toMatchObject({ role: 'assistant', content: expect.stringContaining('Invalid stop') })
    expect(replay.problems).toEqual([])
    expect(pageErrors).toEqual([])
  })
}

test('retries a dropped connection and aborts a pending stop on skin change', async ({ page, replay }) => {
  const t = locales[0]
  await page.goto(t.home)
  await expect(page.locator('.adv-home.is-ready')).toBeVisible()
  const dialog = await openSettings(page, t)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  expect(replay.requests).toEqual([])
  await depart(page, t, replay.baseURL, await openSettings(page, t))

  const [first, second] = t.stops
  const firstScript = script(first)
  const secondScript = script(second)
  const pending = pauseStream(secondScript.title)
  replay.failNext(2)
  replay.enqueue({ first: firstScript.title + firstScript.body }, pending.reply)
  await choose(page, t, t.firstChoice)

  const alert = demo(page).getByRole('alert')
  await expect(alert).toContainText('连不上服务商')
  expect(replay.requests.filter(request => request.stream)).toHaveLength(2)
  await expect(demo(page).getByText(t.fallback, { exact: true })).toBeHidden()
  await alert.getByRole('button', { name: '重试', exact: true }).click()
  await expect(narration(page)).toHaveText(first.line)
  expect(replay.requests[3].messages).toEqual(replay.requests[1].messages)

  await choose(page, t, first.choice)
  await expect(stopSource(page, 2)).toContainText(second.name)
  await demo(page).getByRole('radio', { name: '星海观测站' }).click()
  await expect(page.locator('.adv-home')).toHaveAttribute('data-skin', 'scifi')
  await expect.poll(() => replay.interrupted).toBe(1)
  await expect(demo(page).locator('.crumbs')).toContainText('observatory/')
  await demo(page).getByRole('radio', { name: '末班电车' }).click()
  await expect(demo(page).getByRole('button', { name: t.ai })).toHaveAttribute('aria-pressed', 'false')
  await expect(demo(page).locator('.crumbs')).toContainText('last-tram/')
  await expect(stopSource(page, 2)).toHaveCount(0)
  expect(replay.requests.filter(request => request.stream)).toHaveLength(4)
  expect(replay.problems).toEqual([])
})
