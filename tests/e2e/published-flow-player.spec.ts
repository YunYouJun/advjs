import type { Page } from '@playwright/test'
import type { AdvContext } from '../../packages/client/types/context'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { createPublishedFlowFixture, publishedFlowLineId, publishedFlowPrivateMarker } from '../fixtures/audio/published-flow'

const firstLine = 'What... what happened last night? Why do I feel so strange?'
const phoneLine = 'Who wrote this? This isn’t my handwriting... Did someone break into my phone?'
let fixture: Awaited<ReturnType<typeof createPublishedFlowFixture>>

async function inspect(page: Page) {
  return await page.evaluate(() => {
    const app = (document.querySelector('#app') as unknown as { __vue_app__: { _context: { provides: Record<string, AdvContext> } } }).__vue_app__
    const adv = app._context.provides['$advjs-context']
    const probe = (window as unknown as { flowAudioProbe: { energy: () => number, context: () => string, media: string[], buffers: number } }).flowAudioProbe
    return {
      current: adv.store.current,
      state: adv.store.state,
      audio: adv.$audio.inspect(),
      game: JSON.parse(JSON.stringify(adv.gameConfig.value)),
      program: JSON.parse(JSON.stringify(adv.runtime.program.value)),
      diagnostics: adv.compileDiagnostics.value,
      energy: probe.energy(),
      contextState: probe.context(),
      media: [...probe.media],
      buffers: probe.buffers,
    }
  })
}

async function advance(page: Page) {
  const current = (await inspect(page)).current
  const id = current?.id
  const selector = current?.kind === 'narration' ? '.adv-black:visible' : '.adv-dialog-box:visible'
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.locator(selector).click()
    if ((await inspect(page)).current?.id !== id)
      return
  }
  await expect.poll(async () => (await inspect(page)).current?.id).not.toBe(id)
}

test.beforeAll(async () => {
  fixture = await createPublishedFlowFixture()
})
test.afterAll(async () => {
  await fixture?.close()
})

test.beforeEach(async ({ page }) => {
  // Observe positive signal in the real player graph, without replacing its engine.
  await page.addInitScript(() => {
    const NativeContext = window.AudioContext
    const contexts: AudioContext[] = []
    const mediaElements: HTMLMediaElement[] = []
    let analyser: AnalyserNode | undefined
    const probe = {
      get media() { return mediaElements.map(element => element.currentSrc || element.src) },
      buffers: 0,
      context: () => contexts.at(-1)?.state ?? 'not-created',
      energy() {
        const samples = new Float32Array(analyser?.fftSize ?? 256)
        analyser?.getFloatTimeDomainData(samples)
        return Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length)
      },
    }
    class ObservedAudioContext extends NativeContext {
      constructor(options?: AudioContextOptions) {
        super(options)
        contexts.push(this)
        analyser = this.createAnalyser()
        analyser.fftSize = 256
        const createGain = this.createGain.bind(this)
        let master = true
        this.createGain = () => {
          const node = createGain()
          if (master) {
            node.connect(analyser!)
            master = false
          }
          return node
        }
        const createMediaSource = this.createMediaElementSource.bind(this)
        this.createMediaElementSource = (element) => {
          mediaElements.push(element)
          return createMediaSource(element)
        }
        const createBufferSource = this.createBufferSource.bind(this)
        this.createBufferSource = () => {
          probe.buffers++
          return createBufferSource()
        }
      }
    }
    window.AudioContext = ObservedAudioContext
    Object.assign(window, { flowAudioProbe: probe })
  })
})

test('published variants play in an ordinary native Flow production build without exposing masters or author data', async ({ page }, info) => {
  const pageErrors: string[] = []
  const consoleErrors: string[] = []
  const failedResources: string[] = []
  const browserMediaRequests: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error')
      consoleErrors.push(message.text())
  })
  page.on('response', (response) => {
    if (response.status() >= 400)
      failedResources.push(`${response.status()} ${response.url()}`)
  })
  page.on('request', (request) => {
    if (/\.(?:webm|m4a)$/u.test(request.url()))
      browserMediaRequests.push(request.url())
  })

  const puts = fixture.cos.requests.filter(request => request.method === 'PUT')
  expect(puts).toHaveLength(9)
  expect(puts.at(-1)!.key).toBe(fixture.publication.manifestObjectKey)
  expect(createHash('sha256').update(fixture.manifestBytes).digest('hex')).toBe(fixture.publication.revision)
  expect(fixture.manifest.assets.map(asset => asset.kind).sort()).toEqual(['ambience', 'bgm', 'sfx', 'voice'])
  expect(fixture.build.assets.some(asset => /\.wav$/u.test(asset.path))).toBe(false)
  expect(fixture.build.assets.some(asset => /private-audio-evidence|voice-profiles|toolchain|\.chapter\.ts/u.test(asset.path))).toBe(false)
  const scripts = (await Promise.all(fixture.build.assets.filter(asset => asset.path.endsWith('.js')).map(asset => readFile(join(fixture.build.outDir, asset.path), 'utf8')))).join('\n')
  for (const privateValue of [publishedFlowPrivateMarker, 'A small, cluttered Tokyo apartment with morning light', '/img/your-name/node3.jpg', '1.chapter.ts'])
    expect(scripts).not.toContain(privateValue)
  await fixture.verifyImmutableFiles()

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(fixture.url)
  await expect(page).toHaveTitle(/Your Name/)
  await expect(page.locator('[data-action="start_game"]')).toBeVisible()
  expect(await page.locator('vite-error-overlay').count()).toBe(0)
  // Use the real device mixer controls to isolate voice at the master analyser.
  await page.evaluate(() => {
    const app = (document.querySelector('#app') as unknown as { __vue_app__: { _context: { provides: Record<string, AdvContext> } } }).__vue_app__
    app._context.provides['$advjs-context'].$audio.setUserSettings({ buses: { music: { muted: true }, ambience: { muted: true } } })
  })
  await page.locator('[data-action="start_game"]').click()
  await expect(page).toHaveURL(/\/game$/)
  await expect.poll(async () => (await inspect(page)).current?.data?.text).toBe(firstLine)
  await page.locator('.adv-dialog-box:visible').click()
  await expect.poll(async () => (await inspect(page)).contextState).toBe('running')
  await expect.poll(async () => (await inspect(page)).audio.tracks.filter(track => track.status === 'playing').length).toBe(3)
  await expect.poll(async () => (await inspect(page)).energy).toBeGreaterThan(0.00001)
  let snapshot = await inspect(page)
  const observedVoiceRms = snapshot.energy
  expect(snapshot.audio.tracks.map(track => track.bus).sort()).toEqual(['ambience', 'music', 'voice'])
  expect(snapshot.audio.buses.music.effectiveGain).toBe(0)
  expect(snapshot.audio.buses.ambience.effectiveGain).toBe(0)
  expect(snapshot.audio.voice).toMatchObject({ assetId: fixture.voiceTake.assetId, lineId: publishedFlowLineId, locale: 'en-US' })
  expect(snapshot.diagnostics).toEqual([])
  expect(snapshot.program.schemaVersion).toBe(2)
  expect(snapshot.program.entry.chapterId).toBe('intro')
  expect(snapshot.current?.data?.lineId).toBe(publishedFlowLineId)
  const voiceBinding = snapshot.game.audio.voiceLedger.lines[publishedFlowLineId].locales['en-US']
  expect(voiceBinding.selectedTake).toBe(fixture.voiceTake.id)
  expect(voiceBinding.takes).toHaveLength(1)
  expect(voiceBinding.takes[0].assetId).toBe(fixture.voiceTake.assetId)
  const runtimeJson = JSON.stringify({ game: snapshot.game, program: snapshot.program })
  for (const field of ['voiceProfile', 'rights', 'parameters', 'imagePrompt', 'originalEdges', 'originalArtworkUri', 'legacySource'])
    expect(runtimeJson).not.toContain(`"${field}"`)
  expect(runtimeJson).not.toContain(publishedFlowPrivateMarker)

  // Validate the publication's bytes and the runtime identity against each master.
  const chosen = info.project.name === 'webkit' ? 'aac' : 'opus'
  for (const asset of fixture.manifest.assets) {
    const native = fixture.masters.find(master => master.id === asset.id)!
    const runtime = snapshot.game.audio.assets[asset.id]
    expect(asset.sha256).toBe(native.sha256)
    expect(runtime.sha256).toBe(native.sha256)
    for (const [name, variant] of Object.entries(asset.variants)) {
      const uri = new URL(variant.objectKey, fixture.cos.url).href
      const response = await page.request.get(uri)
      expect(response.ok()).toBe(true)
      expect(response.headers()['access-control-allow-origin']).toBe('*')
      expect(response.headers()['content-type']).toBe(variant.mimeType)
      const bytes = await response.body()
      expect(bytes.length).toBe(variant.bytes)
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(variant.sha256)
      expect(runtime.variants[name].src).toBe(uri)
      expect(runtime.variants[name].sha256).toBe(variant.sha256)
    }
    if (asset.kind !== 'sfx')
      expect(snapshot.media).toContain(new URL(asset.variants[chosen].objectKey, fixture.cos.url).href)
  }
  for (const scene of snapshot.game.scenes) {
    const native = fixture.catalog.assets.find(asset => asset.id === scene.assetId)!
    expect(scene.src).toMatch(/^\.\/project-assets\/[a-f\d]{64}\.svg$/u)
    const response = await page.request.get(new URL(scene.src, fixture.url).href)
    expect(response.ok()).toBe(true)
    expect(createHash('sha256').update(await response.body()).digest('hex')).toBe(native.sha256)
  }
  const music = fixture.manifest.assets.find(asset => asset.kind === 'bgm')!.variants[chosen]
  const preflight = await page.request.fetch(new URL(music.objectKey, fixture.cos.url).href, { method: 'OPTIONS', headers: { 'origin': fixture.url, 'access-control-request-method': 'GET' } })
  expect(preflight.status()).toBe(204)
  expect(preflight.headers()['access-control-allow-methods']).toBe('GET, HEAD, OPTIONS')
  const head = await page.request.head(new URL(music.objectKey, fixture.cos.url).href)
  expect(head.status()).toBe(200)
  expect(head.headers()['content-length']).toBe(String(music.bytes))

  const directory = join(tmpdir(), 'advjs-published-flow-production-artifacts')
  await mkdir(directory, { recursive: true })
  await page.screenshot({ path: join(directory, `published-flow-dialogue-normal-${info.project.name}.png`), animations: 'disabled', scale: 'css' })
  const playedMedia = snapshot.media
  await advance(page)
  await expect.poll(async () => (await inspect(page)).audio.voice).toBeUndefined()
  expect((await inspect(page)).audio.tracks.some(track => track.bus === 'voice')).toBe(false)
  await page.evaluate(async () => {
    const app = (document.querySelector('#app') as unknown as { __vue_app__: { _context: { provides: Record<string, AdvContext> } } }).__vue_app__
    app._context.provides['$advjs-context'].$audio.setUserSettings({ buses: { music: { muted: false }, ambience: { muted: false } } })
    // Let the analyser replace samples from the stopped voice before measuring.
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  })
  await expect.poll(async () => (await inspect(page)).energy).toBeGreaterThan(0.00001)
  const observedMultitrackRms = (await inspect(page)).energy
  for (let line = 0; line < 5; line++)
    await advance(page)
  await expect.poll(async () => (await inspect(page)).current?.kind).toBe('choices')
  const choice = page.getByRole('button', { name: 'Check your phone for clues', exact: true })
  await expect(choice).toBeVisible()
  await page.setViewportSize({ width: 320, height: 900 })
  await expect.poll(() => page.locator('body').evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
  await choice.scrollIntoViewIfNeeded()
  const bounds = await choice.boundingBox()
  const controls = await page.locator('.dialog-controls-shell').boundingBox()
  expect(bounds!.height).toBeGreaterThanOrEqual(43.9)
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(controls!.y + 1)
  await page.screenshot({ path: join(directory, `published-flow-choices-narrow-${info.project.name}.png`), animations: 'disabled', scale: 'css' })
  await choice.click()
  await expect.poll(async () => (await inspect(page)).current?.data?.text).toBe(phoneLine)
  await expect.poll(async () => (await inspect(page)).buffers).toBe(1)
  const effect = fixture.manifest.assets.find(asset => asset.kind === 'sfx')!
  // Short effects decode to AudioBuffer, so WebKit's streamed Opus GainNode
  // limitation does not apply. Both browsers prefer the decoded Opus variant.
  expect(browserMediaRequests).toContain(new URL(effect.variants.opus.objectKey, fixture.cos.url).href)
  await page.setViewportSize({ width: 1280, height: 900 })
  for (let line = 0; line < 12; line++)
    await advance(page)
  await expect.poll(async () => (await inspect(page)).state.status).toBe('ended')
  await expect.poll(async () => (await inspect(page)).audio.tracks.length).toBe(0)
  snapshot = await inspect(page)
  expect(snapshot.audio.voice).toBeUndefined()
  expect(snapshot.audio.errors).toEqual([])
  expect(pageErrors).toEqual([])
  expect(consoleErrors).toEqual([])
  expect(failedResources).toEqual([])
  await fixture.verifyImmutableFiles()
  const proof = JSON.stringify({ manifestRevision: fixture.publication.revision, codec: chosen, media: playedMedia, selectedVoiceAssetId: fixture.voiceTake.assetId, observedVoiceRms, observedMultitrackRms, masterFilesUnchanged: true, buildFiles: fixture.build.assets.map(asset => asset.path) }, null, 2)
  await writeFile(join(directory, `published-flow-proof-${info.project.name}.json`), proof)
  await info.attach('published-flow-proof', { body: proof, contentType: 'application/json' })
})
