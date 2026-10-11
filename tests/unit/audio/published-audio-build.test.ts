// @vitest-environment node
import type { AdvAssetManifest, AudioApprovedToolchainProfile, VoiceLedger } from '@advjs/types'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { audioFingerprint, audioObjectKey, resolveVoiceTake } from '@advjs/audio'
import { describe, expect, it } from 'vitest'
import { probeAudioToolchain, runAudioProcess } from '../../../packages/advjs/node/audio/process'
import { createNodeAudioPublicationHost } from '../../../packages/advjs/node/audio/release'
import { createNodeVoiceAuthoringService } from '../../../packages/advjs/node/audio/voice'
import { advBuild } from '../../../packages/advjs/node/commands/build'
import { createPublishedAudioCatalog, loadPublishedAudioManifest } from '../../../packages/advjs/node/commands/build/audio-release'
import { prepareProjectGame } from '../../../packages/advjs/node/commands/build/project'
import { toPlayerData } from '../../../packages/advjs/node/config/player'
import { loadProject } from '../../../packages/advjs/node/project'
import { createCosHttpFixture } from '../../fixtures/audio/cos-http'
import { createEditorVoiceJobsFixture, editorJobLineIds } from '../../fixtures/audio/editor-voice-jobs'

const hash = (source: Uint8Array | string) => createHash('sha256').update(source).digest('hex')
const bgmId = 'audio_019d137e-7abc-7000-8000-000000000009'

async function publishedFlow() {
  const source = await createEditorVoiceJobsFixture()
  const cos = await createCosHttpFixture()
  await writeFile(join(source.root, 'adv.config.json'), JSON.stringify({ id: 'editor-jobs', format: 'flow', root: 'adv', entryChapterId: 'intro' }))
  await rm(join(source.root, 'adv/chapters/intro.adv.md'))
  await writeFile(join(source.root, 'adv/chapters/intro.chapter.json'), JSON.stringify({ schemaVersion: 1, id: 'intro', title: 'Flow', nodes: [
    { id: 'room', type: 'background', name: 'room' },
    { id: 'music', type: 'audio', operations: [{ type: 'bgm', action: 'set', asset: bgmId }] },
    { id: 'hello', type: 'dialogues', imagePrompt: 'PRIVATE-FLOW-IMAGE-PROMPT', dialogues: [{ speakerId: 'hero', text: '你好，世界。', lineId: editorJobLineIds[0] }] },
    { id: 'end', type: 'end' },
  ] }))
  await mkdir(join(source.root, 'adv/scenes'), { recursive: true })
  await writeFile(join(source.root, 'adv/scenes/room.md'), '---\nid: room\ntype: image\nassetId: background/room\n---\n')
  const image = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="blue"/></svg>'
  await writeFile(join(source.root, 'public/media/room.svg'), image)
  await runAudioProcess('ffmpeg', ['-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.7', '-ar', '24000', join(source.root, 'candidate.wav')])
  const bytes = await readFile(join(source.root, 'candidate.wav'))
  const native = await createNodeVoiceAuthoringService({ root: source.root, config: source.config })
  const initial = await native.read()
  await mkdir(join(source.root, 'adv/rights'), { recursive: true })
  await writeFile(join(source.root, 'adv/rights/private-consent.md'), 'PRIVATE-CONSENT-RECORD')
  const binding = { lineId: editorJobLineIds[0]!, locale: 'zh-CN', speakerId: 'hero', displayText: '你好，世界。', candidate: { id: 'selected-candidate', provider: 'fixture-tts', characterId: 'hero', text: '你好，世界。', path: 'candidate.wav', sha256: hash(bytes), bytes: bytes.length, mimeType: 'audio/wav', durationSeconds: 0.7, sampleRate: 24000, model: 'fixture-model', providerVoiceId: 'system:fixture' }, voiceProfileRevision: await audioFingerprint(source.profile), source: 'cloned' as const, rights: { license: 'project-permission', subject: 'private-subject', consentRecord: 'adv/rights/private-consent.md' }, parameters: { preset: 'PRIVATE-TTS-PRESET', instructions: 'PRIVATE-TTS-INSTRUCTIONS' } }
  const registered = await native.register({ ...binding, expectedRevision: initial.revision, assetPath: 'voice/adopted-master.wav' })
  const take = registered.ledger.lines[editorJobLineIds[0]!]!.locales['zh-CN']!.takes[0]!
  const history = await native.register({ ...binding, expectedRevision: registered.revision, assetPath: 'voice/unselected-history.wav', parameters: { preset: 'PRIVATE-HISTORICAL-PRESET' } })
  const old = history.ledger.lines[editorJobLineIds[0]!]!.locales['zh-CN']!.takes[1]!
  await native.select({ lineId: editorJobLineIds[0]!, locale: 'zh-CN', takeId: take.id, expectedRevision: history.revision })
  const manifest = JSON.parse(await readFile(join(source.root, 'adv/assets.json'), 'utf8'))
  manifest.assets.push({ id: 'background/room', type: 'image', kind: 'background', path: 'room.svg', sha256: hash(image) }, { id: bgmId, type: 'audio', kind: 'bgm', path: 'music-master.wav', sha256: hash(bytes), bytes: bytes.length, mimeType: 'audio/wav', duration: 0.7 }, { id: 'reference/private', type: 'audio', kind: 'reference', path: 'reference-private.wav', sha256: hash(bytes), bytes: bytes.length, mimeType: 'audio/wav', characterId: 'hero' })
  await writeFile(join(source.root, 'public/media/music-master.wav'), bytes)
  await writeFile(join(source.root, 'public/media/reference-private.wav'), bytes)
  await writeFile(join(source.root, 'adv/assets.json'), JSON.stringify(manifest))
  const toolchain = await probeAudioToolchain()
  const profile: AudioApprovedToolchainProfile = { id: 'published-build-fixture', ffmpegBuildFingerprint: toolchain.fingerprint, workerImageDigest: `sha256:${'b'.repeat(64)}` }
  await writeFile(join(source.root, 'adv/audio/toolchain.json'), JSON.stringify({ schemaVersion: 1, profileId: profile.id, ffmpegBuildFingerprint: profile.ffmpegBuildFingerprint, workerImageDigest: profile.workerImageDigest }))
  const publisher = await createNodeAudioPublicationHost({ root: source.root, stateDirectory: join(source.directory, 'release-state'), approvedProfiles: [profile], projectPrefix: 'fixture/flow', publicBaseUrl: cos.url, storage: cos.storage })
  const review = await publisher.prepare({})
  const publication = await publisher.publish({ planId: review.planId, expectedManifestRevision: null })
  return { ...source, cos, native, take, old, publisher, publication, image, async close() {
    await publisher.close()
    await cos.close()
    await rm(source.directory, { recursive: true, force: true })
  } }
}

describe('published audio in ordinary native Flow builds', () => {
  it('publishes with actual FFmpeg/COS SDK HTTP, builds the ordinary player with remote variants and preserves native authoring', async () => {
    const source = await publishedFlow()
    try {
      const before = await readFile(join(source.root, 'adv/assets.json'), 'utf8')
      const ledger = await readFile(join(source.root, 'adv/audio/voice-ledger.json'), 'utf8')
      const catalog = await loadPublishedAudioManifest(source.root, { audioManifest: source.publication.manifestUrl, audioManifestSha256: source.publication.revision })
      const loaded = await loadProject({ root: source.root })
      expect(loaded.result.diagnostics.filter(item => item.severity === 'error')).toEqual([])
      const prepared = await prepareProjectGame(loaded, { publishedAudioCatalog: catalog })
      expect([...prepared.resources.values()]).toEqual([Buffer.from(source.image)])
      expect(prepared.game.favicon).toMatch(/^data:image\/svg\+xml;base64,/u)
      expect(prepared.game.audio?.assets[source.take.assetId]?.sha256).toBe(source.take.sha256)
      expect(prepared.game.audio?.assets[source.take.assetId]?.variants?.aac.src).toContain(source.take.id)
      expect(prepared.game.bgm.library).toMatchObject({ [bgmId]: { src: expect.stringContaining(source.cos.url) } })
      expect(resolveVoiceTake(prepared.game.audio!.voiceLedger!, editorJobLineIds[0]!, 'zh-CN', prepared.game.audio!.assets).take?.id).toBe(source.take.id)
      const publicGame = toPlayerData({ config: {} as any, gameConfig: prepared.game } as any).gameConfig
      expect(JSON.stringify(publicGame)).not.toContain('private-consent')
      expect(JSON.stringify(publicGame)).not.toContain('PRIVATE-TTS')
      const result = await advBuild({ userRoot: source.root, outDir: 'dist-published', audioManifest: source.publication.manifestUrl, audioManifestSha256: source.publication.revision, vite: { logLevel: 'silent', build: { minify: false } } })
      const scripts = await Promise.all(result.assets.filter(asset => asset.path.endsWith('.js')).map(asset => readFile(join(result.outDir, asset.path), 'utf8')))
      const output = scripts.join('\n')
      expect(output).toContain(source.take.id)
      expect(output).toContain(editorJobLineIds[0])
      expect(output).toContain(source.cos.url)
      expect(output).toContain('.webm')
      expect(output).toContain('.m4a')
      for (const privateValue of ['adopted-master.wav', 'music-master.wav', 'reference-private.wav', 'unselected-history.wav', source.old.id, source.old.assetId, 'PRIVATE-FLOW-IMAGE-PROMPT', 'PRIVATE-TTS-PRESET', 'PRIVATE-TTS-INSTRUCTIONS', 'private-consent.md', 'PRIVATE-CONSENT-RECORD'])
        expect(output).not.toContain(privateValue)
      expect(result.assets.filter(asset => /\.(?:wav|m4a|webm|mp3)$/u.test(asset.path))).toEqual([])
      expect(result.assets.some(asset => asset.path.endsWith('.svg'))).toBe(true)
      const html = await readFile(join(result.outDir, 'index.html'), 'utf8')
      expect(html).toContain(`href="${prepared.game.favicon}"`)
      expect(html).not.toContain('href="/favicon.svg"')
      expect(html).not.toContain('href="/safari-pinned-tab.svg"')
      expect(await readFile(join(source.root, 'adv/assets.json'), 'utf8')).toBe(before)
      expect(await readFile(join(source.root, 'adv/audio/voice-ledger.json'), 'utf8')).toBe(ledger)
    }
    finally { await source.close() }
  }, 120_000)

  it('rejects changed bytes, missing variants, changed master identity and selected-take object keys', async () => {
    const source = await publishedFlow()
    try {
      const raw = source.cos.objects.get(source.publication.manifestObjectKey)!.bytes
      const filename = join(source.root, 'published-audio.json')
      await writeFile(filename, raw)
      await expect(loadPublishedAudioManifest(source.root, { audioManifest: filename })).rejects.toThrow('PIN_REQUIRED')
      await expect(loadPublishedAudioManifest(source.root, { audioManifest: filename, audioManifestSha256: 'a'.repeat(64) })).rejects.toThrow('HASH_CHANGED')
      const loaded = await loadProject({ root: source.root })
      const original = JSON.parse(raw.toString('utf8')) as AdvAssetManifest
      const altered = structuredClone(original)
      delete altered.assets[0]!.variants!.aac
      await writeFile(filename, JSON.stringify(altered))
      await expect(loadPublishedAudioManifest(source.root, { audioManifest: filename, audioManifestSha256: hash(JSON.stringify(altered)) })).rejects.toThrow('ASSET_INVALID')
      const changed = structuredClone(original)
      changed.assets[0]!.sha256 = 'c'.repeat(64)
      expect(() => createPublishedAudioCatalog(loaded.result.project.assets, changed, JSON.parse(loaded.files['adv/audio/voice-ledger.json']!) as VoiceLedger)).toThrow('MASTER_IDENTITY_CHANGED')
      const missing = structuredClone(original)
      missing.assets = missing.assets.filter(asset => asset.kind !== 'bgm')
      expect(() => createPublishedAudioCatalog(loaded.result.project.assets, missing, preparedLedger(loaded.files))).toThrow('ASSET_SET_CHANGED')
      const wrong = structuredClone(original)
      const voice = wrong.assets.find(asset => asset.kind === 'voice')!
      for (const name of ['opus', 'aac'] as const)
        voice.variants![name]!.objectKey = audioObjectKey({ projectPrefix: wrong.release!.objectPrefix!, kind: 'voice', assetId: voice.id, lineId: editorJobLineIds[0], speakerId: 'hero', locale: 'zh-CN', takeId: source.old.id, sha256: voice.variants![name]!.sha256!, extension: name === 'opus' ? 'webm' : 'm4a' })
      expect(() => createPublishedAudioCatalog(loaded.result.project.assets, wrong, preparedLedger(loaded.files))).toThrow('OBJECT_IDENTITY_CHANGED')
      loaded.result.project.game.favicon = '/media/room.svg'
      const icon = await prepareProjectGame(loaded, { publishedAudioCatalog: original })
      expect(icon.game.favicon).toBe(`data:image/svg+xml;base64,${Buffer.from(source.image).toString('base64')}`)
      delete loaded.result.project.game.favicon
      // A master outside public is verified just as strictly and never bundled.
      const native = loaded.result.project.assets!
      native.profiles.local!.root = '.'
      for (const asset of native.assets)
        asset.path = `public/media/${asset.path}`
      const music = native.assets.find(asset => asset.id === bgmId)!
      music.path = 'adv/private-masters/music.wav'
      await mkdir(join(source.root, 'adv/private-masters'), { recursive: true })
      await writeFile(join(source.root, music.path), await readFile(join(source.root, 'public/media/music-master.wav')))
      const outside = await prepareProjectGame(loaded, { publishedAudioCatalog: original })
      expect([...outside.resources.values()]).toEqual([Buffer.from(source.image)])
      await writeFile(join(source.root, music.path), 'changed original bytes')
      await expect(prepareProjectGame(loaded, { publishedAudioCatalog: original })).rejects.toThrow('ADV_AUDIO_MEDIA_CHANGED')
      music.path = 'public/media/music-master.wav'
      await writeFile(join(source.root, 'public/media/music-master.wav'), 'changed original bytes')
      await expect(prepareProjectGame(loaded, { publishedAudioCatalog: original })).rejects.toThrow('ADV_AUDIO_MEDIA_CHANGED')
    }
    finally { await source.close() }
  }, 30_000)
})

function preparedLedger(files: Record<string, string>) {
  return JSON.parse(files['adv/audio/voice-ledger.json']!) as VoiceLedger
}
