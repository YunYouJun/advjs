import type { BrowserContext, Page } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

const checking = '正在核对已保存的项目来源，暂缓选定、采用与生成。'
const failed = '来源核对未完成。草稿与历史保留，请重试后再继续。'
const path = 'adv/chapters/station.adv.md'

const consoles = new WeakMap<BrowserContext, { errors: string[], warnings: string[] }>()
test.beforeEach(({ context }) => {
  const evidence = { errors: [] as string[], warnings: [] as string[] }
  consoles.set(context, evidence)
  const observe = (page: Page) => {
    page.on('pageerror', error => evidence.errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error')
        evidence.errors.push(message.text())
      if (message.type() === 'warning')
        evidence.warnings.push(message.text())
    })
  }
  for (const page of context.pages())
    observe(page)
  context.on('page', observe)
})
test.afterEach(async ({ context }, info) => {
  const evidence = consoles.get(context)!
  await writeFile(info.outputPath('browser-console.json'), JSON.stringify(evidence, null, 2))
  expect(evidence.errors).toEqual([])
  expect(evidence.warnings).toEqual([])
})

async function openTeam(page: Page) {
  await page.goto('/tests/fixtures/creative-team/authoring.html?case=source-sync')
  await expect.poll(() => page.evaluate(() => Boolean((window as any).creativeAuthorFixture))).toBe(true)
  await expect(page.getByText(checking, { exact: true })).toHaveCount(0)
}
async function openPeer(page: Page, projectId: string) {
  await page.goto('/tests/fixtures/creative-team/memory-fs.html')
  await page.waitForFunction(() => Boolean((window as any).memoryFsFixture))
  await page.evaluate(id => (window as any).memoryFsFixture.open(id), projectId)
}
async function savePeer(page: Page, content: string) {
  await page.evaluate(async ({ path, content }) => {
    await (window as any).memoryFsFixture.write({ [path]: content })
    await (window as any).memoryFsFixture.flush()
  }, { path, content })
}
const calls = (page: Page): Promise<string[]> => page.evaluate(() => (window as any).creativeAuthorFixture.calls())
const postFacts = (calls: string[]) => calls.filter(call => call.startsWith('POST') && call.endsWith('/facts'))

// All filesystem/delivery/controller/UI behavior is real; auth and service transport are explicit fixtures.
test('a durable save from an independent page pauses old actions, stales downstream and retains an unsaved candidate draft', async ({ page, context }, info) => {
  await openTeam(page)
  const peer = await context.newPage()
  const projectId = await page.evaluate(() => (window as any).creativeAuthorFixture.run().plan.projectId)
  await page.locator('.team-artifact').filter({ hasText: '本地 fixture 人物初稿' }).getByRole('button', { name: '选定候选并继续', exact: true }).click()
  const chapter = page.locator('.team-artifact').filter({ hasText: '本地 fixture 章节初稿' })
  await chapter.getByRole('button', { name: '编辑候选', exact: true }).click()
  const form = page.getByTestId('creative-candidate-editor')
  const script = form.getByLabel('AdvScript', { exact: true })
  const draft = `${await script.inputValue()}\n\n> 本窗未保存的候选草稿。\n`
  await script.fill(draft)
  await form.getByLabel('本次修改的原因').fill('保留跨窗口检查期间的本地草稿')
  await expect(form.getByRole('button', { name: '保存候选修订', exact: true })).toBeEnabled()
  const before = await page.evaluate(() => (window as any).creativeAuthorFixture.files())
  const oldCalls = await calls(page)
  await openPeer(peer, projectId)
  await page.evaluate(() => (window as any).creativeAuthorFixture.holdNextSourceState())
  try {
    const content = `${before[path]}\n\n> 另一窗口已保存的新约束。\n`
    await savePeer(peer, content)
    await expect(page.getByText(checking, { exact: true })).toBeVisible()
    await expect(form.getByRole('button', { name: '保存候选修订', exact: true })).toBeDisabled()
    await expect(chapter.getByRole('button', { name: '选定候选并继续', exact: true })).toBeDisabled()
    await expect(script).toHaveValue(draft)
    await page.evaluate(() => (window as any).creativeAuthorFixture.releaseSourceState())
    await expect.poll(() => page.evaluate(() => (window as any).creativeAuthorFixture.run().artifacts.every((item: any) => item.status === 'stale'))).toBe(true)
    await expect(page.getByText(checking, { exact: true })).toHaveCount(0)
    await expect(script).toHaveValue(draft)
    await expect(form.getByRole('button', { name: '保存候选修订', exact: true })).toBeDisabled()
    const after = await page.evaluate(() => (window as any).creativeAuthorFixture.files())
    expect(after).toEqual({ ...before, [path]: content })
    const delta = (await calls(page)).slice(oldCalls.length)
    expect(delta.filter(call => call.startsWith('POST'))).toEqual(postFacts(delta))
    expect(postFacts(delta)).toHaveLength(1)
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 })
      await form.scrollIntoViewIfNeeded()
      await page.screenshot({ path: info.outputPath(`foreign-save-draft-${width}.png`), animations: 'disabled' })
    }
    await writeFile(info.outputPath('cross-window-source.json'), JSON.stringify({ scope: 'Two actual pages, independent adapters and real IndexedDB/BroadcastChannel; actual source controller and draft UI; explicit auth/service fixture, no models', before, after, delta, draft }, null, 2))
  }
  finally { await page.evaluate(() => (window as any).creativeAuthorFixture.releaseSourceState()) }
})

test('external and foreground hints do not retry a lost facts response until the author explicitly retries', async ({ page, context }, info) => {
  await openTeam(page)
  const peer = await context.newPage()
  const projectId = await page.evaluate(() => (window as any).creativeAuthorFixture.run().plan.projectId)
  const before = await page.evaluate(() => (window as any).creativeAuthorFixture.files())
  await openPeer(peer, projectId)
  await page.evaluate(() => (window as any).creativeAuthorFixture.loseFactsResponse())
  const content = `${before[path]}\n\n> 已保存但回执丢失。\n`
  await savePeer(peer, content)
  await expect(page.getByText(failed, { exact: true })).toBeVisible()
  const failedCalls = await calls(page)
  expect(postFacts(failedCalls)).toHaveLength(1)
  await savePeer(peer, content)
  await page.bringToFront()
  await page.evaluate(() => {
    window.dispatchEvent(new Event('focus'))
    window.dispatchEvent(new Event('pageshow'))
  })
  // Give the 150ms debounce a chance to run; this must remain explicitly blocked.
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 350)))
  expect(await calls(page)).toEqual(failedCalls)
  await expect(page.getByText(failed, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '重新核对来源', exact: true }).click()
  await expect(page.getByText(failed, { exact: true })).toHaveCount(0)
  await expect(page.getByText(checking, { exact: true })).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => (window as any).creativeAuthorFixture.run().artifacts[0].status)).toBe('stale')
  const recovered = await calls(page)
  expect(postFacts(recovered)).toEqual(postFacts(failedCalls))
  await writeFile(info.outputPath('foreign-unknown-response.json'), JSON.stringify({ scope: 'Actual second-page save and transport failure after facts persistence; foreground events are hints; explicit retry reads existing service state', failedCalls, recovered }, null, 2))
})

test('a foreground event refreshes persisted sources when broadcast delivery is unavailable', async ({ page, context }, info) => {
  await context.addInitScript(() => Object.defineProperty(window, 'BroadcastChannel', { value: undefined, configurable: true }))
  await openTeam(page)
  const peer = await context.newPage()
  const projectId = await page.evaluate(() => (window as any).creativeAuthorFixture.run().plan.projectId)
  const before = await page.evaluate(() => (window as any).creativeAuthorFixture.files())
  await openPeer(peer, projectId)
  const oldCalls = await calls(page)
  const content = `${before[path]}\n\n> 无广播时保存的修改。\n`
  await savePeer(peer, content)
  await page.bringToFront()
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect.poll(() => page.evaluate(() => (window as any).creativeAuthorFixture.run().artifacts[0].status)).toBe('stale')
  await expect(page.getByText(checking, { exact: true })).toHaveCount(0)
  const delta = (await calls(page)).slice(oldCalls.length)
  expect(postFacts(delta)).toHaveLength(1)
  expect(await page.evaluate(() => (window as any).creativeAuthorFixture.files())).toEqual({ ...before, [path]: content })
  await writeFile(info.outputPath('resume-without-broadcast.json'), JSON.stringify({ scope: 'Actual persisted second-page edit with BroadcastChannel disabled; browser foreground plus explicit focus event drives source re-read, not polling or generated data', delta, content }, null, 2))
})
