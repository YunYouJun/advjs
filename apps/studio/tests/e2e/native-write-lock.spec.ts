import type { BrowserContext, Page, TestInfo } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

const fixture = (page: Page, method: string, ...args: unknown[]) => page.evaluate(({ method, args }) => (window as any).nativeWriteLockFixture[method](...args), { method, args })
const state = (page: Page) => fixture(page, 'state')
const original = 'Original author source\n'

async function usingNativeWorkspace(page: Page, context: BrowserContext, info: TestInfo, operation: (peer: Page) => Promise<void>) {
  const peer = await context.newPage()
  const url = `/tests/fixtures/creative-team/native-write-lock.html?id=${randomUUID()}`
  const errors: string[] = []
  try {
    for (const target of [page, peer]) {
      target.on('pageerror', error => errors.push(error.message))
      target.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning')
          errors.push(`${message.type()}: ${message.text()}`)
      })
      await target.goto(`${url}${target === peer ? '&alias=1' : ''}`)
      await expect(target).toHaveTitle('Native workspace write coordination fixture')
      await target.waitForFunction(() => Boolean((window as any).nativeWriteLockFixture))
      await expect(target.locator('vite-error-overlay')).toHaveCount(0)
    }
    await operation(peer)
  }
  finally {
    for (const target of [page, peer].filter(target => !target.isClosed())) {
      await fixture(target, 'release')
    }
    const survivor = peer.isClosed() ? page : peer
    for (const target of [page, peer].filter(target => !target.isClosed())) {
      await expect.poll(() => state(target)).not.toMatchObject({ phase: 'paused' })
      await expect.poll(() => state(target)).not.toMatchObject({ phase: 'queued' })
    }
    await writeFile(info.outputPath('native-final-state.json'), JSON.stringify({ source: await fixture(survivor, 'read'), journals: (await fixture(survivor, 'records')).length, errors }))
    // A failed assertion still retains evidence before removing this test's owned OPFS data.
    if ((await fixture(survivor, 'records')).length)
      await fixture(survivor, 'restore')
    await fixture(survivor, 'cleanup')
    if (!peer.isClosed())
      await peer.close()
  }
  expect(errors).toEqual([])
}
const queuedPeer = (page: Page) => expect.poll(() => page.evaluate(async () => (await navigator.locks.query()).pending.length), { timeout: 3000 }).toBe(1)

test('independent native writers cannot both commit the same author baseline', async ({ page, context }, info) => {
  await usingNativeWorkspace(page, context, info, async (peer) => {
    await fixture(page, 'startSave', 'First author commit\n', 'before')
    await expect.poll(() => state(page)).toMatchObject({ phase: 'paused' })
    await fixture(peer, 'startSave', 'Second stale author commit\n')
    await queuedPeer(peer)
    expect(await state(peer)).toMatchObject({ phase: 'queued', writes: 0 })
    expect(await fixture(peer, 'read')).toBe(original)
    await fixture(page, 'release')
    await expect.poll(() => state(page)).toMatchObject({ phase: 'saved' })
    await expect.poll(() => state(peer)).toMatchObject({ phase: 'failed', error: 'ADV_STUDIO_SOURCE_CONFLICT', writes: 0 })
    expect(await fixture(peer, 'read')).toBe('First author commit\n')
    await writeFile(info.outputPath('native-winner.json'), JSON.stringify({ first: await state(page), second: await state(peer), source: await fixture(peer, 'read') }))
  })
})

test('the next native writer waits through actual failure compensation', async ({ page, context }, info) => {
  await usingNativeWorkspace(page, context, info, async (peer) => {
    await fixture(page, 'startSave', 'Native close before failure\n', 'after-fail')
    await expect.poll(() => state(page)).toMatchObject({ phase: 'paused' })
    expect(await fixture(peer, 'read')).toBe('Native close before failure\n')
    await fixture(peer, 'startSave', 'Author after restored baseline\n')
    await queuedPeer(peer)
    expect(await state(peer)).toMatchObject({ phase: 'queued', writes: 0 })
    await fixture(page, 'release')
    await expect.poll(() => state(page)).toMatchObject({ phase: 'failed', error: 'Explicit native failure after close', writes: 2 })
    await expect.poll(() => state(peer)).toMatchObject({ phase: 'saved', writes: 1 })
    expect(await fixture(peer, 'read')).toBe('Author after restored baseline\n')
  })
})

test('a saved-source readiness read waits for a native peer operation', async ({ page, context }, info) => {
  await usingNativeWorkspace(page, context, info, async (peer) => {
    await fixture(page, 'startSave', 'Complete saved source\n', 'before')
    await expect.poll(() => state(page)).toMatchObject({ phase: 'paused' })
    await fixture(peer, 'wait')
    await queuedPeer(peer)
    expect(await state(peer)).toMatchObject({ phase: 'queued', writes: 0 })
    await fixture(page, 'release')
    await expect.poll(() => state(peer)).toMatchObject({ phase: 'saved', writes: 0 })
    expect(await fixture(peer, 'read')).toBe('Complete saved source\n')
  })
})

test('closing a native lock owner permits the queued writer to continue', async ({ page, context }, info) => {
  await usingNativeWorkspace(page, context, info, async (peer) => {
    await fixture(page, 'startSave', 'Closed before native write\n', 'before')
    await expect.poll(() => state(page)).toMatchObject({ phase: 'paused' })
    await fixture(peer, 'startSave', 'Live author after closed owner\n')
    await queuedPeer(peer)
    await page.close()
    await expect.poll(() => state(peer)).toMatchObject({ phase: 'saved', writes: 1 })
    expect(await fixture(peer, 'read')).toBe('Live author after closed owner\n')
  })
})

test('closing an interrupted deletion does not bypass its durable recovery original', async ({ page, context }, info) => {
  await usingNativeWorkspace(page, context, info, async (peer) => {
    await fixture(page, 'startDelete')
    await expect.poll(() => state(page)).toMatchObject({ phase: 'paused' })
    expect(await fixture(peer, 'read')).toBe(null)
    await fixture(peer, 'startSave', 'Must wait for explicit restoration\n')
    await queuedPeer(peer)
    expect(await state(peer)).toMatchObject({ phase: 'queued', writes: 0 })
    await page.close()
    await expect.poll(() => state(peer)).toMatchObject({ phase: 'failed', error: 'ADV_STUDIO_WORKSPACE_RECOVERY_REQUIRED', writes: 0 })
    expect((await fixture(peer, 'records')).length).toBe(1)
    expect(await fixture(peer, 'read')).toBe(null)
    await fixture(peer, 'restore')
    expect(await fixture(peer, 'read')).toBe(original)
    expect(await fixture(peer, 'records')).toEqual([])
    await fixture(peer, 'startSave', 'Explicit save after recovery\n')
    await expect.poll(() => state(peer)).toMatchObject({ phase: 'saved' })
    expect(await fixture(peer, 'read')).toBe('Explicit save after recovery\n')
  })
})

test('missing native coordination rejects writes before touching author files', async ({ page, context }, info) => {
  await usingNativeWorkspace(page, context, info, async () => {
    await page.evaluate(() => Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined }))
    await fixture(page, 'startSave', 'Unsafe unsupported write\n')
    await expect.poll(() => state(page)).toMatchObject({ phase: 'failed', error: 'ADV_STUDIO_WORKSPACE_COORDINATION_UNAVAILABLE', writes: 0 })
    expect(await fixture(page, 'read')).toBe(original)
  })
})
