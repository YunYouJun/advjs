import type { Page } from '@playwright/test'
import type { AdvContext } from '../../packages/client/types/context'
import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { expect, test } from '@playwright/test'

test.use({ baseURL: 'http://127.0.0.1:3359' })

const demoRoot = resolve(import.meta.dirname, '../../demo/flow')
const firstLine = 'What... what happened last night? Why do I feel so strange?'
const phoneLine = 'Who wrote this? This isn’t my handwriting... Did someone break into my phone?'
const assets = JSON.parse(await readFile(join(demoRoot, 'adv/assets.json'), 'utf8')) as {
  assets: Array<{ id: string, kind: string, path: string, sha256: string, bytes: number }>
}

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

test.beforeEach(async ({ page }) => {
  // Observe the real browser graph; the app retains its own AudioEngine/backend.
  await page.addInitScript(() => {
    const NativeContext = window.AudioContext
    const contexts: AudioContext[] = []
    let analyser: AnalyserNode | undefined
    const probe = {
      media: [] as string[],
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
          probe.media.push(element.currentSrc || element.src)
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

for (const branch of ['phone', 'school']) {
  test(`built native Flow plays dialogue, ${branch} choice and real multitrack audio`, async ({ page }, info) => {
    const pageErrors: string[] = []
    const consoleErrors: string[] = []
    const failedResources: string[] = []
    page.on('pageerror', error => pageErrors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error')
        consoleErrors.push(message.text())
    })
    page.on('response', (response) => {
      if (response.status() >= 400)
        failedResources.push(`${response.status()} ${response.url()}`)
    })
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/')
    await expect(page).toHaveTitle(/Your Name/)
    await expect(page.locator('[data-action="start_game"]')).toBeVisible()
    expect(await page.locator('vite-error-overlay').count()).toBe(0)
    await page.locator('[data-action="start_game"]').click()
    await expect(page).toHaveURL(/\/game$/)
    await info.attach('initial-native-flow-state', { body: JSON.stringify(await inspect(page)), contentType: 'application/json' })
    await expect(page.locator('.adv-dialog-box:visible')).toBeVisible()
    await expect.poll(async () => (await inspect(page)).current?.data?.text).toBe(firstLine)
    await page.locator('.adv-dialog-box:visible').click()
    await expect(page.locator('.dialog-content:visible')).toContainText(firstLine)
    await expect.poll(async () => (await inspect(page)).contextState).toBe('running')
    await expect.poll(async () => (await inspect(page)).audio.tracks.filter(track => track.status === 'playing').length).toBe(2)
    await expect.poll(async () => (await inspect(page)).energy).toBeGreaterThan(0.00001)
    let snapshot = await inspect(page)
    expect(snapshot.diagnostics).toEqual([])
    expect(snapshot.audio.tracks.map(track => track.bus).sort()).toEqual(['ambience', 'music'])
    expect(snapshot.current?.data?.lineId).toBe('line_019d137e-7abc-7000-8000-000000000001')
    expect(snapshot.current?.data?.character).toBe('taki')
    expect(snapshot.program.schemaVersion).toBe(2)
    expect(snapshot.program.entry.chapterId).toBe('intro')
    const published = JSON.stringify({ game: snapshot.game, program: snapshot.program })
    for (const privateField of ['imagePrompt', 'sceneDescription', 'originalArtworkUri', 'originalEdges', 'legacySource', 'voiceProfile', 'consentRecord'])
      expect(published).not.toContain(`"${privateField}"`)
    const directory = join(tmpdir(), 'advjs-flow-production-artifacts')
    await mkdir(directory, { recursive: true })
    await page.screenshot({ path: join(directory, `flow-dialogue-normal-${branch}-${info.project.name}.png`), animations: 'disabled', scale: 'css' })

    const resolved = new Map<string, string>(Object.entries(snapshot.game.audio.assets).map(([id, asset]) => [id, (asset as { src: string }).src]))
    for (const scene of snapshot.game.scenes)
      resolved.set(scene.assetId, scene.src)
    for (const asset of assets.assets.filter(asset => ['bgm', 'ambience', 'sfx', 'background'].includes(asset.kind))) {
      const uri = resolved.get(asset.id)
      expect(uri).toMatch(/^\.\/project-assets\/[a-f\d]{64}\.(?:wav|svg)$/)
      const response = await page.request.get(uri!)
      expect(response.ok()).toBe(true)
      const bytes = await response.body()
      expect(bytes.length).toBe(asset.bytes)
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256)
    }
    const scripts = await readdir(join(demoRoot, 'dist/assets'))
    const scriptText = (await Promise.all(scripts.filter(file => file.endsWith('.js')).map(file => readFile(join(demoRoot, 'dist/assets', file), 'utf8')))).join('\n')
    expect(scriptText).not.toContain('A small, cluttered Tokyo apartment with morning light')
    expect(scriptText).not.toContain('1.chapter.ts')
    expect(scriptText).not.toContain('/img/your-name/node3.jpg')

    for (let line = 0; line < 6; line++)
      await advance(page)
    await expect.poll(async () => (await inspect(page)).current?.kind).toBe('choices')
    const choice = page.getByRole('button', { name: branch === 'phone' ? 'Check your phone for clues' : 'Go to school and see if anything feels off', exact: true })
    await expect(choice).toBeVisible()
    await page.screenshot({ path: join(directory, `flow-choices-normal-${branch}-${info.project.name}.png`), animations: 'disabled', scale: 'css' })
    await page.setViewportSize({ width: 320, height: 900 })
    await expect.poll(() => page.locator('body').evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
    await choice.scrollIntoViewIfNeeded()
    await expect(choice).toBeInViewport()
    const buttonBounds = await choice.boundingBox()
    const controlsBounds = await page.locator('.dialog-controls-shell').boundingBox()
    expect(buttonBounds?.height).toBeGreaterThanOrEqual(43.9)
    expect(buttonBounds!.y + buttonBounds!.height).toBeLessThanOrEqual(controlsBounds!.y + 1)
    await page.screenshot({ path: join(directory, `flow-choices-narrow-${branch}-${info.project.name}.png`), animations: 'disabled', scale: 'css' })
    await choice.click()
    await expect.poll(async () => (await inspect(page)).current?.data?.text).toBe(phoneLine)
    await expect.poll(async () => (await inspect(page)).buffers).toBe(1)
    snapshot = await inspect(page)
    expect(snapshot.state.stage.background).toBe(branch === 'phone' ? 'taki-phone' : 'taki-school')
    expect(snapshot.current?.data?.lineId).toBe('line_019d137e-7abc-7000-8000-000000000007')
    expect(snapshot.audio.state.bgm?.assetId).toBe(assets.assets.find(asset => asset.kind === 'bgm')?.id)
    expect(Object.keys(snapshot.audio.state.ambience)).toEqual(['bed'])
    await page.setViewportSize({ width: 1280, height: 900 })
    for (let line = 0; line < 12; line++)
      await advance(page)
    await expect.poll(async () => (await inspect(page)).state.status).toBe('ended')
    await expect.poll(async () => (await inspect(page)).audio.tracks.length).toBe(0)
    expect((await inspect(page)).audio.errors).toEqual([])
    expect(pageErrors).toEqual([])
    expect(consoleErrors).toEqual([])
    expect(failedResources).toEqual([])
  })
}
