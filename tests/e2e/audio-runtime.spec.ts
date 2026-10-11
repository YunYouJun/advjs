import type { AudioEngineInspection } from '../../packages/audio/src/contracts'
import { createHash } from 'node:crypto'
import { expect, test } from '@playwright/test'

type Inspection = AudioEngineInspection & {
  contextState: string
  graphGains: Record<string, number>
  energy: number
  naturalVoiceEnds: number
  routedMediaSources: number
  decodedSources: number
  resolvedSources: Record<string, string>
  streamingMedia: Array<{ src: string, paused: boolean, duration: number | null }>
}

test('plays real multitrack audio after a gesture and preserves persistent state across history', async ({ page }, info) => {
  const pageErrors: string[] = []
  const consoleErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error')
      consoleErrors.push(message.text())
  })
  const snapshot = () => page.evaluate(() => (window as unknown as { audioFixture: { inspect: () => Inspection } }).audioFixture.inspect())
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('http://127.0.0.1:3347')
  await expect(page).toHaveTitle('ADV.JS AudioEngine verification')
  await expect(page.getByRole('heading', { name: 'ADV.JS AudioEngine verification' })).toBeVisible()
  expect(await page.locator('vite-error-overlay').count()).toBe(0)
  let state = await snapshot()
  expect(state.unlocked).toBe(false)
  expect(state.contextState).toBe('not-created')
  expect(state.tracks[0]?.status).toBe('queued')

  await page.getByRole('button', { name: 'Unlock audio', exact: true }).click()
  await expect.poll(async () => (await snapshot()).contextState).toBe('running')
  await expect.poll(async () => (await snapshot()).tracks[0]?.status).toBe('playing')
  await page.getByRole('button', { name: 'Play music + 4 ambience layers', exact: true }).click()
  await expect.poll(async () => (await snapshot()).tracks.filter(track => track.status === 'playing').length).toBe(5)
  await expect.poll(async () => (await snapshot()).energy).toBeGreaterThan(0.00001)

  await page.getByRole('button', { name: 'Play dialogue voice', exact: true }).click()
  await expect.poll(async () => (await snapshot()).ducking).toBe(true)
  await expect.poll(async () => (await snapshot()).graphGains.music).toBeCloseTo(0.25, 2)
  state = await snapshot()
  expect(state.graphGains.ambience).toBeCloseTo(0.25, 2)
  expect(state.graphGains.sfx).toBe(1)
  expect(state.graphGains.ui).toBe(1)
  await expect.poll(async () => (await snapshot()).naturalVoiceEnds).toBe(1)
  await expect.poll(async () => (await snapshot()).graphGains.music).toBeCloseTo(1, 2)
  expect((await snapshot()).voice).toBeUndefined()

  await page.getByRole('button', { name: 'Play voice + SFX + UI', exact: true }).click()
  await expect.poll(async () => (await snapshot()).tracks.filter(track => ['voice', 'sfx', 'ui'].includes(track.bus)).length).toBe(3)
  await page.getByRole('button', { name: 'Restore history', exact: true }).click()
  state = await snapshot()
  expect(state.tracks.filter(track => ['voice', 'sfx'].includes(track.bus))).toHaveLength(0)
  expect(state.tracks.filter(track => ['music', 'ambience'].includes(track.bus))).toHaveLength(5)
  expect(state.tracks.filter(track => track.bus === 'ui')).toHaveLength(1)
  expect(state.state.bgm?.assetId).toBe('music')
  expect(state.naturalVoiceEnds).toBe(1)

  await page.screenshot({ path: info.outputPath('audio-normal.png') })
  await page.setViewportSize({ width: 360, height: 900 })
  await expect.poll(() => page.locator('body').evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
  await expect(page.getByRole('button', { name: 'Unlock audio', exact: true })).toBeInViewport()
  await page.screenshot({ path: info.outputPath('audio-narrow.png') })

  await page.getByRole('button', { name: 'Load unavailable audio', exact: true }).click()
  await expect.poll(async () => (await snapshot()).errors.length).toBe(1)
  expect((await snapshot()).tracks.filter(track => track.bus === 'sfx')).toHaveLength(0)
  expect((await snapshot()).tracks.filter(track => ['music', 'ambience'].includes(track.bus))).toHaveLength(5)
  await page.getByRole('button', { name: 'Dispose audio', exact: true }).click()
  await expect.poll(async () => (await snapshot()).contextState).toBe('closed')
  state = await snapshot()
  expect(state.disposed).toBe(true)
  expect(state.unlocked).toBe(false)
  expect(state.tracks).toHaveLength(0)
  expect(pageErrors).toEqual([])
  expect(consoleErrors.filter(message => !message.includes('503') && !message.includes('__audio_failure__'))).toEqual([])
})

test('plays processed Opus and AAC with mixer-safe browser routing and compatible streaming variants', async ({ page, browserName }) => {
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  const snapshot = () => page.evaluate(() => (window as unknown as { audioFixture: { inspect: () => Inspection } }).audioFixture.inspect())
  await page.goto('http://127.0.0.1:3347')
  const receiptResponse = await page.request.get('http://127.0.0.1:3347/variants/receipt.json')
  expect(receiptResponse.ok()).toBe(true)
  const receipt = await receiptResponse.json() as { outputs: Array<{ variant: string, path: string, metadata: { codec: string, sha256: string, bytes: number, sampleRate: number, channels: number } }> }
  expect(receipt.outputs.map(output => output.metadata.codec)).toEqual(['opus', 'aac'])
  for (const output of receipt.outputs) {
    const response = await page.request.get(`http://127.0.0.1:3347/variants/${output.path}`)
    expect(response.ok()).toBe(true)
    const bytes = await response.body()
    expect(bytes.length).toBe(output.metadata.bytes)
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(output.metadata.sha256)
    expect(output.metadata.sampleRate).toBe(48000)
    expect(output.metadata.channels).toBe(1)
  }
  await page.getByRole('button', { name: 'Unlock audio', exact: true }).click()
  await page.getByRole('button', { name: 'Clear persistent layers', exact: true }).click()
  await expect.poll(async () => (await snapshot()).tracks.length).toBe(0)
  let voiceEnds = 0
  for (const codec of ['Opus', 'AAC']) {
    await page.getByRole('button', { name: `Play processed ${codec} voice`, exact: true }).click()
    await expect.poll(async () => (await snapshot()).voice?.assetId).toBe(`voice-${codec.toLowerCase()}`)
    await expect.poll(async () => (await snapshot()).energy).toBeGreaterThan(0.00001)
    await expect.poll(async () => (await snapshot()).naturalVoiceEnds).toBe(++voiceEnds)
    expect((await snapshot()).voice).toBeUndefined()
    expect((await snapshot()).errors).toEqual([])
    const before = await snapshot()
    await page.getByRole('button', { name: `Stream processed ${codec} music`, exact: true }).click()
    await expect.poll(async () => (await snapshot()).tracks.some(track => track.assetId === `voice-${codec.toLowerCase()}` && track.bus === 'music' && track.status === 'playing')).toBe(true)
    if (browserName === 'webkit' && codec === 'Opus') {
      await expect.poll(async () => (await snapshot()).decodedSources).toBe(before.decodedSources + 1)
      expect((await snapshot()).routedMediaSources).toBe(before.routedMediaSources)
    }
    else {
      await expect.poll(async () => (await snapshot()).streamingMedia.some(media => !media.paused && media.src.endsWith(codec === 'Opus' ? 'voice.webm' : 'voice.m4a'))).toBe(true)
      expect((await snapshot()).routedMediaSources).toBe(before.routedMediaSources + 1)
    }
    await expect.poll(async () => (await snapshot()).energy).toBeGreaterThan(0.00001)
    await page.getByRole('button', { name: 'Clear persistent layers', exact: true }).click()
    await expect.poll(async () => (await snapshot()).tracks.length).toBe(0)
  }
  const beforeCompatible = await snapshot()
  await page.getByRole('button', { name: 'Stream compatible processed music', exact: true }).click()
  await expect.poll(async () => (await snapshot()).tracks.some(track => track.assetId === 'processed-music' && track.status === 'playing')).toBe(true)
  expect((await snapshot()).resolvedSources['processed-music']).toBe(browserName === 'webkit' ? '/variants/voice.m4a' : '/variants/voice.webm')
  await expect.poll(async () => (await snapshot()).routedMediaSources).toBe(beforeCompatible.routedMediaSources + 1)
  await expect.poll(async () => (await snapshot()).energy).toBeGreaterThan(0.00001)
  await page.getByRole('button', { name: 'Dispose audio', exact: true }).click()
  await expect.poll(async () => (await snapshot()).contextState).toBe('closed')
  expect((await snapshot()).errors).toEqual([])
  expect(pageErrors).toEqual([])
})
