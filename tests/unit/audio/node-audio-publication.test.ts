// @vitest-environment node
import type { AudioApprovedToolchainProfile } from '@advjs/types'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { probeAudioToolchain, runAudioProcess } from '../../../packages/advjs/node/audio/process'
import { createNodeAudioPublicationHost } from '../../../packages/advjs/node/audio/release'
import { createNodeVoiceAuthoringService } from '../../../packages/advjs/node/audio/voice'
import { loadPublishedAudioManifest } from '../../../packages/advjs/node/commands/build/audio-release'
import { prepareProjectGame } from '../../../packages/advjs/node/commands/build/project'
import { loadProject } from '../../../packages/advjs/node/project'
import { createCosHttpFixture } from '../../fixtures/audio/cos-http'
import { createEditorVoiceJobsFixture, editorJobLineIds } from '../../fixtures/audio/editor-voice-jobs'

async function fixture(cloned = false) {
  const source = await createEditorVoiceJobsFixture()
  const cos = await createCosHttpFixture()
  await runAudioProcess('ffmpeg', ['-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.7', '-ar', '24000', join(source.root, 'candidate.wav')])
  const bytes = await readFile(join(source.root, 'candidate.wav'))
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const native = await createNodeVoiceAuthoringService({ root: source.root, config: source.config })
  const initial = await native.read()
  if (cloned) {
    await mkdir(join(source.root, 'adv/rights'), { recursive: true })
    await writeFile(join(source.root, 'adv/rights/consent.md'), 'Permission for this project.')
  }
  const rights = cloned ? { license: 'project-permission', subject: 'fixture-speaker', consentRecord: 'adv/rights/consent.md' } : undefined
  const registered = await native.register({ lineId: editorJobLineIds[0]!, locale: 'zh-CN', speakerId: 'hero', displayText: '你好，世界。', expectedRevision: initial.revision, candidate: { id: 'candidate', provider: 'fixture-tts', characterId: 'hero', text: '你好，世界。', path: 'candidate.wav', sha256, bytes: bytes.length, mimeType: 'audio/wav', durationSeconds: 0.7, sampleRate: 24000, model: 'fixture-model', providerVoiceId: 'system:fixture' }, assetPath: 'audio/voice/adopted.wav', voiceProfileRevision: 'a'.repeat(64), source: cloned ? 'cloned' : 'system', ...(rights ? { rights } : {}) })
  const take = registered.ledger.lines[editorJobLineIds[0]!]!.locales['zh-CN']!.takes[0]!
  const selected = await native.select({ lineId: editorJobLineIds[0]!, locale: 'zh-CN', takeId: take.id, expectedRevision: registered.revision })
  const toolchain = await probeAudioToolchain()
  const profile: AudioApprovedToolchainProfile = { id: 'local-integration', ffmpegBuildFingerprint: toolchain.fingerprint, workerImageDigest: `sha256:${'b'.repeat(64)}` }
  await writeFile(join(source.root, 'adv/audio/toolchain.json'), JSON.stringify({ schemaVersion: 1, profileId: profile.id, ffmpegBuildFingerprint: profile.ffmpegBuildFingerprint, workerImageDigest: profile.workerImageDigest }))
  const options = { root: source.root, stateDirectory: join(source.directory, 'private-publication'), approvedProfiles: [profile], projectPrefix: 'fixture/project', publicBaseUrl: cos.url, storage: cos.storage }
  const host = await createNodeAudioPublicationHost(options)
  return { ...source, cos, host, options, native, take, selected, async close() {
    await cos.close()
    await rm(source.directory, { recursive: true, force: true })
  } }
}

describe('native audio publication with real FFmpeg and COS SDK HTTP', () => {
  it('publishes only current JSON Flow selected takes and keeps orphan selection private', async () => {
    const source = await fixture()
    try {
      await writeFile(join(source.root, 'adv.config.json'), JSON.stringify({ id: 'editor-jobs', format: 'flow', root: 'adv', entryChapterId: 'intro' }))
      await rm(join(source.root, 'adv/chapters/intro.adv.md'))
      await writeFile(join(source.root, 'adv/chapters/intro.chapter.json'), JSON.stringify({ schemaVersion: 1, id: 'intro', title: 'Current Flow', startNodeId: 'current', nodes: [{ id: 'current', type: 'dialogues', dialogues: [{ speakerId: 'hero', text: '你好，世界。', lineId: editorJobLineIds[0] }] }] }))
      const snapshot = await source.native.read()
      const bytes = await readFile(join(source.root, 'candidate.wav'))
      const translated = await source.native.register({ lineId: editorJobLineIds[0]!, locale: 'en-US', speakerId: 'hero', displayText: 'Hello, world.', expectedRevision: snapshot.revision, candidate: { id: 'translated', provider: 'fixture-tts', characterId: 'hero', text: 'Hello, world.', path: 'candidate.wav', sha256: source.take.sha256, bytes: bytes.length, mimeType: 'audio/wav', durationSeconds: 0.7, sampleRate: 24000, model: 'fixture-model', providerVoiceId: 'system:fixture' }, assetPath: 'audio/voice/translated.wav', voiceProfileRevision: 'a'.repeat(64), source: 'system' })
      const englishTake = translated.ledger.lines[editorJobLineIds[0]!]!.locales['en-US']!.takes[0]!
      const adoptedTranslation = await source.native.select({ lineId: editorJobLineIds[0]!, locale: 'en-US', takeId: englishTake.id, expectedRevision: translated.revision })
      const orphan = await source.native.register({ lineId: editorJobLineIds[1]!, locale: 'zh-CN', speakerId: 'hero', displayText: '历史对白。', expectedRevision: adoptedTranslation.revision, candidate: { id: 'orphan', provider: 'fixture-tts', characterId: 'hero', text: '历史对白。', path: 'candidate.wav', sha256: source.take.sha256, bytes: bytes.length, mimeType: 'audio/wav', durationSeconds: 0.7, sampleRate: 24000, model: 'fixture-model', providerVoiceId: 'system:fixture' }, assetPath: 'audio/voice/orphan.wav', voiceProfileRevision: 'a'.repeat(64), source: 'system' })
      const historical = orphan.ledger.lines[editorJobLineIds[1]!]!.locales['zh-CN']!.takes[0]!
      await source.native.select({ lineId: editorJobLineIds[1]!, locale: 'zh-CN', takeId: historical.id, expectedRevision: orphan.revision })
      expect((await loadProject({ root: source.root })).result.diagnostics.filter(item => item.severity === 'error')).toEqual([])
      const review = await source.host.prepare({})
      expect(review).toMatchObject({ assetCount: 2, objectCount: 4 })
      expect(review.assets.map(asset => asset.id).sort()).toEqual([source.take.assetId, englishTake.assetId].sort())
      await expect(source.host.prepare({ assetIds: [historical.assetId] })).rejects.toThrow('ASSET_INVALID')
      const publication = await source.host.publish({ planId: review.planId, expectedManifestRevision: null })
      const catalog = await (await fetch(publication.manifestUrl)).json()
      expect(catalog.assets.map((asset: { id: string }) => asset.id).sort()).toEqual([source.take.assetId, englishTake.assetId].sort())
      expect(JSON.stringify(catalog)).not.toContain(historical.id)
      expect(JSON.stringify(catalog)).not.toContain(editorJobLineIds[1])
      const latest = await source.native.read()
      expect(latest.ledger.lines[editorJobLineIds[1]!]!.locales['zh-CN']!.selectedTake).toBe(historical.id)
      const publishedAudioCatalog = await loadPublishedAudioManifest(source.root, { audioManifest: publication.manifestUrl, audioManifestSha256: publication.revision })
      const prepared = await prepareProjectGame(await loadProject({ root: source.root }), { publishedAudioCatalog })
      expect(Object.keys(prepared.game.audio!.assets).sort()).toEqual([source.take.assetId, englishTake.assetId].sort())
      expect(prepared.game.audio!.voiceLedger!.lines[editorJobLineIds[0]!]!.locales['zh-CN']!.selectedTake).toBe(source.take.id)
      expect(prepared.game.audio!.voiceLedger!.lines[editorJobLineIds[0]!]!.locales['en-US']!.selectedTake).toBe(englishTake.id)
      expect(prepared.game.audio!.voiceLedger!.lines[editorJobLineIds[1]!]).toBeUndefined()
      expect(prepared.resources.size).toBe(0)
      expect(prepared.game.audio!.assets[englishTake.assetId]!.variants?.aac?.src).toContain(`/en-us/hero/${editorJobLineIds[0]}/${englishTake.id}.`)
    }
    finally { await source.close() }
  }, 30_000)

  it.each(['chapter', 'legacy-review'] as const)('rejects %s changes not covered by the native audio revision before storage I/O', async (change) => {
    const source = await fixture()
    try {
      const review = await source.host.prepare({})
      if (change === 'chapter') {
        await writeFile(join(source.root, 'adv/chapters/intro.adv.md'), `@Hero\n已修改的正文。 {#${editorJobLineIds[0]}}`)
        expect((await source.native.read()).revision).toBe(review.sourceRevision)
      }
      else {
        const path = join(source.options.stateDirectory, 'audio-releases.json')
        const state = JSON.parse(await readFile(path, 'utf8'))
        delete state.plans[review.planId].reviewedProgramSha256
        await writeFile(path, JSON.stringify(state))
      }
      await expect(source.host.publish({ planId: review.planId, expectedManifestRevision: null })).rejects.toThrow('SOURCE_CONFLICT')
      expect(source.cos.requests).toHaveLength(0)
    }
    finally { await source.close() }
  }, 30_000)

  it('rechecks the current program before manifest commit after a noncooperating chapter edit during upload', async () => {
    const source = await fixture()
    try {
      const review = await source.host.prepare({})
      const put = source.cos.storage.putBytes.bind(source.cos.storage)
      let changed = false
      source.cos.storage.putBytes = async (...args) => {
        await put(...args)
        if (!changed) {
          changed = true
          await writeFile(join(source.root, 'adv/chapters/intro.adv.md'), `@Hero\n上传期间变更。 {#${editorJobLineIds[0]}}`)
        }
      }
      await expect(source.host.publish({ planId: review.planId, expectedManifestRevision: null })).rejects.toThrow('SOURCE_CONFLICT')
      expect(await source.host.current()).toBeNull()
      expect(source.cos.requests.filter(request => request.method === 'PUT').every(request => !request.key.endsWith('.json'))).toBe(true)
    }
    finally { await source.close() }
  }, 30_000)

  it('verifies the exact output bytes again after remote HEAD before publishing any changed media', async () => {
    const source = await fixture()
    try {
      const review = await source.host.prepare({})
      const state = JSON.parse(await readFile(join(source.options.stateDirectory, 'audio-releases.json'), 'utf8'))
      const output = state.plans[review.planId].plan.objects[0]
      const head = source.cos.storage.head.bind(source.cos.storage)
      source.cos.storage.head = async (key) => {
        const info = await head(key)
        if (key === output.objectKey)
          await writeFile(join(source.root, output.path), 'Private bytes replaced the reviewed output.')
        return info
      }
      await expect(source.host.publish({ planId: review.planId, expectedManifestRevision: null })).rejects.toThrow('OUTPUT_CHANGED')
      expect(source.cos.requests.some(request => request.method === 'PUT')).toBe(false)
      expect(await source.host.current()).toBeNull()
    }
    finally { await source.close() }
  }, 30_000)

  it('rechecks the reviewed source after manifest PUT before committing the durable public pointer', async () => {
    const source = await fixture()
    try {
      const review = await source.host.prepare({})
      const put = source.cos.storage.putBytes.bind(source.cos.storage)
      source.cos.storage.putBytes = async (...args) => {
        await put(...args)
        if (args[0].endsWith('.json'))
          await writeFile(join(source.root, 'adv/chapters/intro.adv.md'), `@Hero\n提交期间变更。 {#${editorJobLineIds[0]}}`)
      }
      await expect(source.host.publish({ planId: review.planId, expectedManifestRevision: null })).rejects.toThrow('SOURCE_CONFLICT')
      expect(await source.host.current()).toBeNull()
      expect(source.cos.requests.filter(request => request.method === 'PUT')).toHaveLength(3)
    }
    finally { await source.close() }
  }, 30_000)

  it.each(['variant', 'manifest'] as const)('recovers a lost %s PUT acknowledgement by verifying the exact remote bytes on explicit retry', async (lost) => {
    const source = await fixture()
    try {
      const review = await source.host.prepare({})
      const put = source.cos.storage.putBytes.bind(source.cos.storage)
      let responseLost = false
      source.cos.storage.putBytes = async (...args) => {
        await put(...args)
        if (!responseLost && args[0].endsWith('.json') === (lost === 'manifest')) {
          responseLost = true
          throw Object.assign(new Error('Do not expose a transport credential'), { code: 'ETIMEDOUT' })
        }
      }
      await expect(source.host.publish({ planId: review.planId, expectedManifestRevision: null })).rejects.toThrow('AUDIO_RELEASE_STORAGE_UNAVAILABLE')
      expect(await source.host.current()).toBeNull()
      const publication = await source.host.publish({ planId: review.planId, expectedManifestRevision: null })
      expect(await source.host.current()).toEqual(publication)
      const writes = source.cos.requests.filter(request => request.method === 'PUT')
      expect(writes).toHaveLength(3)
      expect(new Set(writes.map(request => request.key)).size).toBe(3)
      for (const request of source.cos.requests.filter(request => request.method === 'GET' && request.key))
        expect(request.headers['if-match']).toBe(source.cos.objects.get(request.key)!.headers.etag)
    }
    finally { await source.close() }
  }, 30_000)

  it.each([undefined, '', 'W/"weak-etag"'] as const)('rejects an unavailable or weak ETag %s before an unpinned remote read', async (etag) => {
    const source = await fixture()
    try {
      const review = await source.host.prepare({})
      const state = JSON.parse(await readFile(join(source.options.stateDirectory, 'audio-releases.json'), 'utf8'))
      const object = state.plans[review.planId].plan.objects[0]
      await source.cos.storage.putBytes(object.objectKey, await readFile(join(source.root, object.path)), { contentType: object.mimeType, cacheControl: object.cacheControl, forbidOverwrite: true })
      const head = source.cos.storage.head.bind(source.cos.storage)
      source.cos.storage.head = async (key) => {
        const info = await head(key)
        return info ? { ...info, etag } : info
      }
      source.cos.requests.length = 0
      await expect(source.host.publish({ planId: review.planId, expectedManifestRevision: null })).rejects.toThrow('OBJECT_ETAG_REQUIRED')
      expect(source.cos.requests.some(request => request.method === 'GET' && request.key)).toBe(false)
      expect(source.cos.requests.some(request => request.method === 'PUT')).toBe(false)
      expect(await source.host.current()).toBeNull()
    }
    finally { await source.close() }
  }, 30_000)

  it('accepts quoted multipart-style COS ETags while still verifying each remote SHA', async () => {
    const source = await fixture()
    try {
      const review = await source.host.prepare({})
      const put = source.cos.storage.putBytes.bind(source.cos.storage)
      source.cos.storage.putBytes = async (...args) => {
        await put(...args)
        const object = source.cos.objects.get(args[0])!
        object.headers.etag = object.headers.etag.replace(/"$/u, '-2"')
      }
      const publication = await source.host.publish({ planId: review.planId, expectedManifestRevision: null })
      expect(await source.host.current()).toEqual(publication)
      for (const request of source.cos.requests.filter(request => request.method === 'GET' && request.key))
        expect(request.headers['if-match']).toBe(source.cos.objects.get(request.key)!.headers.etag)
    }
    finally { await source.close() }
  }, 30_000)

  it('returns a durable background preparation immediately, deduplicates work and restores an interrupted preparation', async () => {
    const source = await fixture()
    try {
      const task = await source.host.beginPrepare({ expectedSourceRevision: source.selected.revision })
      expect(task.status).toBe('queued')
      expect((await source.host.beginPrepare({ expectedSourceRevision: source.selected.revision })).id).toBe(task.id)
      let latest = await source.host.preparation(task.id)
      for (let index = 0; index < 200 && ['queued', 'running'].includes(latest.status); index++) {
        await new Promise(resolve => setTimeout(resolve, 15))
        latest = await source.host.preparation(task.id)
      }
      expect(latest).toMatchObject({ status: 'ready', review: { assetCount: 1, objectCount: 2 } })
      expect(source.cos.requests).toHaveLength(0)
      await source.host.close()
      // Model a host stopping after writing 'running', before the ready commit.
      const path = join(source.options.stateDirectory, 'audio-releases.json')
      const state = JSON.parse(await readFile(path, 'utf8'))
      state.preparations[task.id].state = { id: task.id, status: 'running' }
      await writeFile(path, JSON.stringify(state))
      const restored = await createNodeAudioPublicationHost(source.options)
      try {
        latest = await restored.preparation(task.id)
        for (let index = 0; index < 200 && ['queued', 'running'].includes(latest.status); index++) {
          await new Promise(resolve => setTimeout(resolve, 15))
          latest = await restored.preparation(task.id)
        }
        expect(latest.status).toBe('ready')
        expect((await restored.preparations()).map(task => task.id)).toEqual([task.id])
        expect(source.cos.requests).toHaveLength(0)
      }
      finally { await restored.close() }
    }
    finally {
      await source.host.close()
      await source.close()
    }
  }, 30_000)
  it('publishes verified Opus/AAC and a private-data-free manifest last, persists pointer CAS and recovers a lost response', async () => {
    const source = await fixture()
    try {
      const authored = JSON.parse(await readFile(join(source.root, 'adv/assets.json'), 'utf8'))
      authored.assets.find((asset: { id: string }) => asset.id === source.take.assetId).duration = 120
      await writeFile(join(source.root, 'adv/assets.json'), JSON.stringify(authored))
      const review = await source.host.prepare({})
      expect(review).toMatchObject({ assetCount: 1, objectCount: 2, expectedManifestRevision: null })
      expect(JSON.stringify(review)).not.toContain(source.root)
      const publication = await source.host.publish({ planId: review.planId, expectedSourceRevision: review.sourceRevision, expectedManifestRevision: null })
      const puts = source.cos.requests.filter(request => request.method === 'PUT')
      expect(puts).toHaveLength(3)
      expect(puts.at(-1)!.key).toBe(publication.manifestObjectKey)
      const response = await fetch(publication.manifestUrl)
      expect(response.status).toBe(200)
      const publicJson = await response.text()
      const catalog = JSON.parse(publicJson)
      expect(catalog.assets[0].id).toBe(source.take.assetId)
      expect(Object.keys(catalog.assets[0].variants)).toEqual(['aac', 'opus'])
      for (const privateValue of ['voice-ledger', 'spokenText', 'reference', source.root, 'adopted.wav', 'fixture-model', 'candidate.wav'])
        expect(publicJson).not.toContain(privateValue)
      const durations: number[] = []
      for (const [variant, value] of Object.entries(catalog.assets[0].variants) as Array<[string, { objectKey: string, sha256: string, bytes: number }]>) {
        const stored = source.cos.objects.get(value.objectKey)!
        expect(createHash('sha256').update(stored.bytes).digest('hex')).toBe(value.sha256)
        expect(stored.bytes.length).toBe(value.bytes)
        const filename = join(source.root, `downloaded.${variant === 'opus' ? 'webm' : 'm4a'}`)
        await writeFile(filename, stored.bytes)
        const probe = JSON.parse((await runAudioProcess('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,sample_rate,channels:format=duration', '-of', 'json', filename])).stdout)
        expect(probe.streams[0]).toMatchObject({ codec_name: variant, sample_rate: '48000', channels: 1 })
        durations.push(Number(probe.format.duration))
      }
      expect(catalog.assets[0].duration).toBe(Math.max(...durations))
      expect(catalog.assets[0].duration).toBeLessThan(1)
      const restored = await createNodeAudioPublicationHost(source.options)
      expect(await restored.current()).toEqual(publication)
      expect(await restored.publish({ planId: review.planId, expectedManifestRevision: null })).toEqual(publication)
      expect(source.cos.requests.filter(request => request.method === 'PUT')).toHaveLength(3)
      const next = await restored.prepare({})
      await expect(restored.publish({ planId: next.planId, expectedManifestRevision: null })).rejects.toThrow('MANIFEST_CONFLICT')
      await expect(createNodeAudioPublicationHost({ ...source.options, stateDirectory: join(source.root, '.advjs/private') })).rejects.toThrow('PRIVATE_REQUIRED')
    }
    finally { await source.close() }
  }, 30_000)
  it('publishes music, ambience, effects and UI variants while excluding private references', async () => {
    const source = await fixture()
    try {
      const path = join(source.root, 'adv/assets.json')
      const catalog = JSON.parse(await readFile(path, 'utf8'))
      const bytes = await readFile(join(source.root, 'candidate.wav'))
      const sha256 = createHash('sha256').update(bytes).digest('hex')
      for (const kind of ['bgm', 'ambience', 'sfx', 'ui', 'reference']) {
        catalog.assets.push({ id: `fixture-${kind}`, type: 'audio', kind, path: `${kind}.wav`, sha256, bytes: bytes.length, mimeType: 'audio/wav' })
        await writeFile(join(source.root, `public/media/${kind}.wav`), bytes)
      }
      await writeFile(path, JSON.stringify(catalog))
      const review = await source.host.prepare({})
      expect(review).toMatchObject({ assetCount: 5, objectCount: 10 })
      const publication = await source.host.publish({ planId: review.planId, expectedManifestRevision: null })
      const manifest = await (await fetch(publication.manifestUrl)).json()
      expect(manifest.assets.map((asset: { kind: string }) => asset.kind).sort()).toEqual(['ambience', 'bgm', 'sfx', 'ui', 'voice'])
      expect(JSON.stringify(manifest)).not.toContain('reference')
      for (const asset of manifest.assets) {
        for (const variant of Object.values(asset.variants) as Array<{ objectKey: string, sha256: string }>) {
          expect(variant.objectKey).toContain(`/audio/${asset.kind}/`)
          const object = source.cos.objects.get(variant.objectKey)!
          expect(object.headers['cache-control']).toBe('public, max-age=31536000, immutable')
          expect(createHash('sha256').update(object.bytes).digest('hex')).toBe(variant.sha256)
        }
      }
      expect(source.cos.requests.filter(request => request.method === 'PUT')).toHaveLength(11)
    }
    finally { await source.close() }
  }, 30_000)

  it('fails before object I/O when the selected take or immutable output changes', async () => {
    const source = await fixture()
    try {
      const review = await source.host.prepare({})
      await source.native.select({ lineId: editorJobLineIds[0]!, locale: 'zh-CN', takeId: null, replaceSelected: true, expectedRevision: review.sourceRevision })
      await expect(source.host.publish({ planId: review.planId, expectedManifestRevision: null })).rejects.toThrow('SOURCE_CONFLICT')
      expect(source.cos.requests).toHaveLength(0)
      await expect(source.host.prepare({ assetIds: [source.take.assetId] })).rejects.toThrow('ASSET_INVALID')
      const latest = await source.native.read()
      await source.native.select({ lineId: editorJobLineIds[0]!, locale: 'zh-CN', takeId: source.take.id, expectedRevision: latest.revision })
      const fresh = await source.host.prepare({})
      const privateState = JSON.parse(await readFile(join(source.options.stateDirectory, 'audio-releases.json'), 'utf8'))
      await writeFile(join(source.root, privateState.plans[fresh.planId].plan.objects[0].path), 'tampered')
      await expect(source.host.publish({ planId: fresh.planId, expectedManifestRevision: null })).rejects.toThrow('OUTPUT_CHANGED')
      expect(source.cos.requests).toHaveLength(0)
    }
    finally { await source.close() }
  }, 30_000)

  it('rechecks consent document bytes independently of ledger revision and never commits a conflicting remote object', async () => {
    const source = await fixture(true)
    try {
      const review = await source.host.prepare({})
      await writeFile(join(source.root, 'adv/rights/consent.md'), 'Permission revoked.')
      await expect(source.host.publish({ planId: review.planId, expectedManifestRevision: null })).rejects.toThrow('CONSENT_CHANGED')
      expect(source.cos.requests).toHaveLength(0)
      await writeFile(join(source.root, 'adv/rights/consent.md'), 'Permission for this project.')
      const state = JSON.parse(await readFile(join(source.options.stateDirectory, 'audio-releases.json'), 'utf8'))
      const object = state.plans[review.planId].plan.objects[0]
      source.cos.objects.set(object.objectKey, { bytes: Buffer.from('other-data'), headers: { 'content-length': '10', 'content-type': object.mimeType, 'cache-control': object.cacheControl, 'etag': '"bad"' } })
      await expect(source.host.publish({ planId: review.planId, expectedManifestRevision: null })).rejects.toThrow('OBJECT_CONFLICT')
      expect(await source.host.current()).toBeNull()
      expect(source.cos.requests.some(request => request.method === 'PUT')).toBe(false)
    }
    finally { await source.close() }
  }, 30_000)
  it('revalidates master and consent bytes when recovering an already committed publication', async () => {
    const source = await fixture(true)
    try {
      const review = await source.host.prepare({})
      await source.host.publish({ planId: review.planId, expectedManifestRevision: null })
      const writes = source.cos.requests.filter(request => request.method === 'PUT').length
      await writeFile(join(source.root, 'adv/rights/consent.md'), 'Permission revoked.')
      await expect(source.host.publish({ planId: review.planId, expectedManifestRevision: null })).rejects.toThrow('CONSENT_CHANGED')
      await writeFile(join(source.root, 'adv/rights/consent.md'), 'Permission for this project.')
      await writeFile(join(source.root, 'public/media/audio/voice/adopted.wav'), 'tampered')
      await expect(source.host.publish({ planId: review.planId, expectedManifestRevision: null })).rejects.toThrow('RECEIPT_UNTRUSTED')
      expect(source.cos.requests.filter(request => request.method === 'PUT')).toHaveLength(writes)
    }
    finally { await source.close() }
  }, 30_000)
  it('keeps the publication pointer unchanged when manifest PUT succeeds but its HEAD remains missing', async () => {
    const source = await fixture()
    try {
      const review = await source.host.prepare({})
      const state = JSON.parse(await readFile(join(source.options.stateDirectory, 'audio-releases.json'), 'utf8'))
      const key = state.plans[review.planId].plan.manifest.objectKey
      source.cos.hideOnHead.add(key)
      await expect(source.host.publish({ planId: review.planId, expectedManifestRevision: null })).rejects.toThrow('OBJECT_UNVERIFIED')
      expect(await source.host.current()).toBeNull()
      source.cos.hideOnHead.delete(key)
      expect(await source.host.publish({ planId: review.planId, expectedManifestRevision: null })).toMatchObject({ manifestObjectKey: key })
      expect(source.cos.requests.filter(request => request.method === 'PUT')).toHaveLength(3)
    }
    finally { await source.close() }
  }, 30_000)
})
