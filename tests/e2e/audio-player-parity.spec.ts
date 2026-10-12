import type { Locator, Page } from '@playwright/test'
import type { AdvContext } from '../../packages/client/types/context'
import { readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import process from 'node:process'
import { expect, test } from '@playwright/test'
import { installPlayerParityProbe } from '../fixtures/audio/audio-probe'
import { createPlayerParityFixture, parsePlayerParityInputs } from '../fixtures/audio/player-parity'

const inputsFile = process.env.ADVJS_PLAYER_PARITY_INPUTS
const inputs = inputsFile ? parsePlayerParityInputs(JSON.parse(readFileSync(inputsFile, 'utf8'))) : []
if (!inputs.length) {
  test('existing native artifacts must be explicitly supplied', () => {
    test.skip(true, 'Set ADVJS_PLAYER_PARITY_INPUTS to explicit Editor/Studio artifact identities; this test never generates audio')
  })
}

async function inspect(page: Page) {
  return page.evaluate(() => {
    const app = (document.querySelector('#app') as unknown as { __vue_app__: { _context: { provides: Record<string, AdvContext> } } }).__vue_app__
    const adv = app._context.provides['$advjs-context']!
    const probe = (window as any).audioParityProbe
    return {
      current: adv.store.current,
      status: adv.store.state.status,
      game: JSON.parse(JSON.stringify(adv.gameConfig.value)),
      audio: adv.$audio.inspect(),
      context: probe.context(),
      sampleRate: probe.sampleRate(),
      rms: probe.rms(),
      diagnostics: adv.compileDiagnostics.value,
      visibility: document.visibilityState,
    }
  })
}

async function activate(locator: Locator, touch: boolean) {
  if (touch)
    await locator.tap()
  else
    await locator.click()
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installPlayerParityProbe)
})

for (const input of inputs) {
  test(`${input.host} native selection preserves the playback protocol across layouts and audio controls`, async ({ page }, info) => {
    const fixture = await createPlayerParityFixture(input)
    const failures: string[] = []
    const requests: { method: string, url: string }[] = []
    page.on('pageerror', error => failures.push(error.message))
    page.on('response', (response) => {
      if (response.status() >= 400)
        failures.push(`${response.status()} ${response.url()}`)
    })
    page.on('request', request => requests.push({ method: request.method(), url: request.url() }))
    const touch = Boolean(info.project.use.hasTouch)
    try {
      await page.goto(fixture.url)
      const start = page.locator('[data-action="start_game"]')
      await expect(start).toBeVisible()
      const startGeometry = await start.evaluate((element: HTMLElement) => {
        const rect = element.getBoundingClientRect()
        const viewport = { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight, visualWidth: visualViewport?.width, visualHeight: visualViewport?.height, scale: visualViewport?.scale }
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
        return { viewport, rect: rect.toJSON(), centerHitsStart: hit === element || element.contains(hit) }
      })
      expect(startGeometry.centerHitsStart).toBe(true)
      expect(startGeometry.rect.left).toBeGreaterThanOrEqual(0)
      expect(startGeometry.rect.top).toBeGreaterThanOrEqual(0)
      expect(startGeometry.rect.right).toBeLessThanOrEqual(startGeometry.viewport.width + 1)
      expect(startGeometry.rect.bottom).toBeLessThanOrEqual(startGeometry.viewport.height + 1)
      await activate(start, touch)
      await expect.poll(async () => (await inspect(page)).current?.data?.lineId).toBe(input.lineId)
      await expect.poll(async () => (await inspect(page)).context).toBe('running')
      let started = await inspect(page)
      await expect.poll(async () => {
        started = await inspect(page)
        return started.rms
      }).toBeGreaterThan(0.00001)
      expect(Number.isFinite(started.sampleRate)).toBe(true)
      expect(started.sampleRate).toBeGreaterThan(0)
      expect(started.audio.voice).toMatchObject({ assetId: input.assetId, lineId: input.lineId, locale: fixture.locale })
      const binding = started.game.audio.voiceLedger.lines[input.lineId].locales[fixture.locale]
      expect(binding.selectedTake).toBe(input.takeId)
      expect(binding.takes.map((take: any) => take.id)).toEqual([input.takeId])
      expect(binding.takes[0].assetId).toBe(input.assetId)
      expect(started.game.audio.assets[input.assetId].sha256).toBe(input.masterSha256)
      expect(Object.keys(started.game.audio.assets)).toEqual([input.assetId])
      expect(started.current?.data?.text).toBe(fixture.text)
      expect(started.diagnostics).toEqual([])
      const runtime = JSON.stringify(started.game)
      for (const field of ['voiceProfile', 'rights', 'parameters', 'presetSha256', 'consentRecord'])
        expect(runtime).not.toContain(`"${field}"`)
      for (const path of ['authoring/voices/', 'authoring/rights/', 'voice/samples/', '.advjs/voice'])
        expect(runtime).not.toContain(path)

      // Pause/resume are public AudioEngine operations; the player has no
      // separate pause button. The real media backend stays in this graph.
      await page.evaluate(() => {
        const app = (document.querySelector('#app') as any).__vue_app__
        app._context.provides['$advjs-context'].$audio.pause()
      })
      const paused = await inspect(page)
      expect(paused.audio.paused).toBe(true)
      expect(paused.audio.tracks.every(track => track.status === 'paused')).toBe(true)
      await page.evaluate(async () => {
        const app = (document.querySelector('#app') as any).__vue_app__
        await app._context.provides['$advjs-context'].$audio.resume()
      })
      await expect.poll(async () => (await inspect(page)).audio.paused).toBe(false)
      expect((await inspect(page)).current?.data?.lineId).toBe(input.lineId)

      const mute = page.getByRole('button', { name: /^(?:关闭音乐|Mute music)$/u })
      await activate(mute, touch)
      expect((await inspect(page)).audio.buses.master.effectiveGain).toBe(0)
      await activate(page.getByRole('button', { name: /^(?:开启音乐|Unmute music)$/u }), touch)
      expect((await inspect(page)).audio.buses.master.effectiveGain).toBeGreaterThan(0)
      await activate(page.getByRole('button', { name: /^(?:设置|Settings)$/u, exact: true }).first(), touch)
      await activate(page.getByRole('tab', { name: /^(?:音频|Audio)$/u }), touch)
      await page.getByRole('spinbutton', { name: /^(?:总音量音量|Master Volume)$/u }).fill('0.5')
      await expect.poll(async () => (await inspect(page)).audio.buses.master.effectiveGain).toBeCloseTo(0.5, 2)
      await activate(page.getByRole('button', { name: /^(?:关闭|Close)$/u, exact: true }).last(), touch)

      const layouts = []
      const initial = page.viewportSize()!
      const dimensions = touch ? [initial, { width: initial.height, height: initial.width }] : [initial, { width: 390, height: 844 }, { width: 844, height: 390 }]
      await expect(page.locator('.print-words .invisible')).toHaveCount(0)
      for (const [index, viewport] of dimensions.entries()) {
        await page.setViewportSize(viewport)
        await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
        const layout = await page.locator('.adv-dialog-box:visible').evaluate((element: HTMLElement) => {
          const content = element.querySelector('.dialog-content') ?? element
          const logicalFontSize = Number.parseFloat(getComputedStyle(content).fontSize)
          const scale = element.getBoundingClientRect().width / element.offsetWidth
          return { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight, innerWidth, innerHeight, visualViewport: { width: visualViewport?.width, height: visualViewport?.height, scale: visualViewport?.scale }, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, logicalFontSize, screenFontSize: logicalFontSize * scale, text: element.querySelector('.print-words')?.textContent?.trim() }
        })
        expect(layout.overflow).toBeLessThanOrEqual(1)
        expect(layout.screenFontSize).toBeGreaterThanOrEqual(17.9)
        expect((await inspect(page)).current?.data?.lineId).toBe(input.lineId)
        layouts.push(layout)
        await page.screenshot({ path: info.outputPath(`${input.host}-layout-${index}.png`), animations: 'disabled', scale: 'css' })
      }

      // Actual focus transition; report the observed visibility instead of
      // pretending headless emulation proves OS background suspension.
      const other = await page.context().newPage()
      await other.goto('about:blank')
      await other.bringToFront()
      const background = await inspect(page)
      await page.bringToFront()
      await other.close()
      const foreground = await inspect(page)
      expect(foreground.current?.data?.lineId).toBe(input.lineId)
      expect(foreground.audio.errors).toEqual([])
      const syntheticVisibility = await page.evaluate(() => {
        const descriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState')
        const adv = (document.querySelector('#app') as any).__vue_app__._context.provides['$advjs-context']
        let hidden: { visibility: DocumentVisibilityState, paused: boolean, lineId?: string }
        try {
          Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
          document.dispatchEvent(new Event('visibilitychange'))
          hidden = { visibility: document.visibilityState, paused: adv.$audio.inspect().paused, lineId: adv.store.current?.data?.lineId }
        }
        finally {
          if (descriptor)
            Object.defineProperty(document, 'visibilityState', descriptor)
          else
            Reflect.deleteProperty(document, 'visibilityState')
          document.dispatchEvent(new Event('visibilitychange'))
        }
        return { simulatedEvent: true, trustedOsEvent: false, hidden, restored: { visibility: document.visibilityState, paused: adv.$audio.inspect().paused, lineId: adv.store.current?.data?.lineId } }
      })
      expect(syntheticVisibility.hidden.lineId).toBe(input.lineId)
      expect(syntheticVisibility.restored.lineId).toBe(input.lineId)

      const visited = []
      let branch = ''
      for (let index = 0; index < 24 && (await inspect(page)).status !== 'ended'; index++) {
        const current = (await inspect(page)).current!
        visited.push({ id: current.id, kind: current.kind, lineId: current.data?.lineId })
        if (current.kind === 'choices') {
          const choice = page.locator('.adv-choice button:visible').first()
          branch = (await choice.textContent())?.trim() ?? ''
          await activate(choice, touch)
        }
        else {
          const surface = page.locator(current.kind === 'narration' ? '.adv-black:visible' : '.adv-dialog-box:visible')
          if (touch)
            await surface.tap({ position: { x: 20, y: 20 } })
          else
            await surface.click({ position: { x: 20, y: 20 } })
        }
      }
      expect(branch).not.toBe('')
      await expect.poll(async () => (await inspect(page)).status).toBe('ended')
      await expect.poll(async () => (await inspect(page)).audio.tracks).toEqual([])
      expect((await inspect(page)).audio.voice).toBeUndefined()
      expect((await inspect(page)).audio.errors).toEqual([])
      expect(failures).toEqual([])
      expect(requests.every(request => ['GET', 'HEAD', 'OPTIONS'].includes(request.method))).toBe(true)
      expect(requests.some(request => /\/v1\/audio\/projects\/|\/__advjs\/api\/|authoring\/|voice\/samples\/|\/\.advjs\//u.test(new URL(request.url).pathname))).toBe(false)
      const asset = started.game.audio.assets[input.assetId]
      const allowedMedia = new Set<string>([asset.src, ...Object.values(asset.variants ?? {}).map((variant: any) => variant.src)].filter(Boolean).map(src => new URL(src as string, fixture.url).href))
      const mediaRequests = requests.filter(request => /\.(?:wav|m4a|webm|mp3|ogg)$/u.test(new URL(request.url).pathname))
      expect(mediaRequests.length).toBeGreaterThan(0)
      expect(mediaRequests.every(request => allowedMedia.has(request.url))).toBe(true)
      await fixture.verifyUnchanged()
      await writeFile(info.outputPath('player-parity-proof.json'), JSON.stringify({ schemaVersion: 1, host: input.host, browser: info.project.name, physicalDevice: false, touchEmulated: touch, newModelCalls: 0, cloudWrites: 0, start: { gesture: touch ? 'tap' : 'click', additionalUnlockGesture: false, ...startGeometry }, input, nativeFiles: fixture.nativeFiles, distFiles: fixture.distFiles, sampleRate: started.sampleRate, rms: started.rms, identity: { lineId: input.lineId, takeId: binding.selectedTake, assetId: binding.takes[0].assetId, masterSha256: started.game.audio.assets[input.assetId].sha256 }, controls: { paused: paused.audio.paused, resumed: !foreground.audio.paused, masterGain: foreground.audio.buses.master.effectiveGain, muteRestored: !foreground.audio.buses.master.muted }, focus: { background: background.visibility, foreground: foreground.visibility, osSuspensionVerified: false }, syntheticVisibility, layouts, branch, visited, runtimeAssetIds: Object.keys(started.game.audio.assets), mediaRequests, requests, errors: failures }, null, 2))
    }
    finally { await fixture.close() }
  })
}
