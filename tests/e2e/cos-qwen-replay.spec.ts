import { readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { expect, test } from '@playwright/test'
import { verifyStudioHandoffPlayer } from '../../apps/studio/tests/fixtures/design-flow/player'
import { cosReplayPublicationFile, parseCosReplayReceipt } from '../fixtures/audio/cos-replay-config'

const receiptFile = cosReplayPublicationFile(process.env)
test.skip(!receiptFile, 'Real COS replay requires ADVJS_COS_REPLAY_PUBLICATION; no TTS, mock storage or cloud writes are started')
let fixture: Awaited<ReturnType<typeof import('../fixtures/audio/cos-replay')['createCosQwenReplayFixture']>> | undefined

test.beforeAll(async () => {
  if (!receiptFile)
    return
  // One read after the publisher has finished; this file contains public receipt
  // metadata, never credentials or SDK session state.
  const receipt = parseCosReplayReceipt(JSON.parse(await readFile(receiptFile, 'utf8')))
  const { createCosQwenReplayFixture } = await import('../fixtures/audio/cos-replay')
  fixture = await createCosQwenReplayFixture(receipt)
})
test.afterAll(async () => {
  await fixture?.close()
})

test('real COS variants replay the existing genuine Qwen selection in a pinned ordinary Flow player', async ({ page }, info) => {
  if (!fixture)
    return
  const requests: { url: string, method: string }[] = []
  page.on('request', request => requests.push({ url: request.url(), method: request.method() }))
  const played = await verifyStudioHandoffPlayer(page, info, { playerUrl: fixture.playerUrl, lineId: fixture.lineId, text: fixture.text, locale: fixture.locale, takeId: fixture.take.id, assetId: fixture.take.assetId, minimumRms: 1e-4, choiceLabel: fixture.choiceLabel, branchText: fixture.branchText })
  expect(played.assetSha256).toBe(fixture.master.sha256)
  expect(played.runtime.voiceLineIds).toEqual([fixture.lineId])
  expect(played.runtime.assetIds).toEqual([fixture.take.assetId])
  const authorFieldsAbsent = await page.evaluate(() => {
    const app = (document.querySelector('#app') as unknown as { __vue_app__: { _context: { provides: Record<string, { gameConfig: { value: unknown } }> } } }).__vue_app__
    const runtime = JSON.stringify(app._context.provides['$advjs-context']!.gameConfig.value)
    // The selected take retains spokenText/inputFingerprint for the runtime
    // stale-selection check; provider parameters and rights stay author-only.
    return Object.fromEntries(['voiceProfile', 'rights', 'parameters', 'presetSha256', 'consentRecord'].map(field => [field, !runtime.includes(`"${field}"`)]))
  })
  expect(Object.values(authorFieldsAbsent).every(Boolean)).toBe(true)
  const audioRequests = requests.filter(request => fixture!.variants.some(variant => variant.url === request.url))
  expect(audioRequests.length).toBeGreaterThan(0)
  expect(requests.every(request => ['GET', 'HEAD', 'OPTIONS'].includes(request.method))).toBe(true)
  const objectProof = []
  for (const variant of fixture.variants) {
    const head = await page.request.head(variant.url)
    expect(head.status()).toBe(200)
    expect(head.headers()['content-type'].split(';')[0]).toBe(variant.mimeType)
    expect(head.headers()['content-length']).toBe(String(variant.bytes))
    expect(head.headers()['x-cos-meta-sha256']).toBe(variant.sha256)
    // Run the Range fetch from the real page origin, so a disabled CORS rule
    // cannot be masked by Playwright's APIRequestContext.
    const range = await page.evaluate(async (url) => {
      const response = await fetch(url, { headers: { Range: 'bytes=0-63' }, credentials: 'omit', redirect: 'error' })
      return { status: response.status, bytes: (await response.arrayBuffer()).byteLength, contentType: response.headers.get('content-type'), cacheControl: response.headers.get('cache-control'), sha256: response.headers.get('x-cos-meta-sha256') }
    }, variant.url)
    expect(range.status).toBe(206)
    expect(range.bytes).toBe(64)
    expect(range.contentType?.split(';')[0]).toBe(variant.mimeType)
    expect(range.sha256).toBe(variant.sha256)
    expect(range.cacheControl).toContain('immutable')
    objectProof.push({ ...variant, head: { status: head.status(), sha256: head.headers()['x-cos-meta-sha256'], cacheControl: head.headers()['cache-control'] }, range })
  }
  await fixture.verifySourceUnchanged()
  await writeFile(info.outputPath('real-cos-qwen-player-proof.json'), JSON.stringify({ schemaVersion: 1, mode: 'real-public-cos-existing-local-qwen-replay', newTtsCalls: 0, cloudWrites: 0, hostedStudioVerified: false, cloudTtsVerified: false, receiptFile, sourceRoot: fixture.sourceRoot, temporaryNativeRoot: fixture.root, originalNativeUnchanged: true, publication: fixture.publication, check: fixture.check, build: fixture.build, nativeFiles: fixture.nativeFiles, master: fixture.master, publicObjects: objectProof, browserAudioRequests: audioRequests, authorFieldsAbsent, player: played }, null, 2))
})
