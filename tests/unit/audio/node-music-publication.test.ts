// @vitest-environment node
import type { AdvAssetEntry, AudioApprovedToolchainProfile } from '@advjs/types'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createMusicMetadata } from '@advjs/audio'
import { describe, expect, it } from 'vitest'
import { probeAudioToolchain } from '../../../packages/advjs/node/audio/process'
import { createNodeAudioPublicationHost } from '../../../packages/advjs/node/audio/release'
import { loadPublishedAudioManifest } from '../../../packages/advjs/node/commands/build/audio-release'
import { prepareProjectGame } from '../../../packages/advjs/node/commands/build/project'
import { loadProject } from '../../../packages/advjs/node/project'
import { createCosHttpFixture } from '../../fixtures/audio/cos-http'
import { createEditorVoiceDesignFixture } from '../../fixtures/audio/editor-voice-design'

const currentId = 'audio_019d137e-7abc-7000-8000-000000000170'
const pendingId = 'audio_019d137e-7abc-7000-8000-000000000171'
const unusedApprovedId = 'audio_019d137e-7abc-7000-8000-000000000172'
const legacyId = 'legacy-music'

/** Original audible PCM, real local processing and localhost COS SDK only; no TTS or cloud writes. */
async function fixture() {
  const source = await createEditorVoiceDesignFixture()
  const cos = await createCosHttpFixture()
  const music = createMusicMetadata({ usage: 'theme', source: { type: 'external-ai', tool: 'USER-CHOSEN-TOOL', url: 'https://suno.com/song/private-author-evidence' }, brief: { summary: 'PRIVATE-MUSIC-BRIEF' }, rights: { license: 'original-unit-wave', permissionNote: 'PRIVATE-PERMISSION' } })
  const approved = { ...music, review: { status: 'approved' as const, sha256: source.sha256, reviewedAt: '2026-10-12T00:00:00.000Z' } }
  const current: AdvAssetEntry = { id: currentId, type: 'audio', kind: 'bgm', path: 'current-theme.wav', sha256: source.sha256, bytes: source.bytes.length, duration: 1, mimeType: 'audio/wav', license: 'original-unit-wave', music: approved }
  const catalog = JSON.parse(await readFile(join(source.root, 'adv/assets.json'), 'utf8'))
  catalog.assets.push(current, { ...current, id: pendingId, path: 'PRIVATE-MISSING-PENDING.wav', music }, { ...current, id: unusedApprovedId, path: 'PRIVATE-MISSING-APPROVED.wav' }, { ...current, id: legacyId, path: 'legacy.wav', music: undefined })
  await writeFile(join(source.root, 'adv/assets.json'), JSON.stringify(catalog))
  await writeFile(join(source.root, 'public/media/current-theme.wav'), source.bytes)
  await writeFile(join(source.root, 'public/media/legacy.wav'), source.bytes)
  await writeFile(join(source.root, 'adv.config.json'), JSON.stringify({ id: 'editor-jobs', root: 'adv', format: 'flow', entryChapterId: 'intro' }))
  await rm(join(source.root, 'adv/chapters/intro.adv.md'))
  const chapterPath = join(source.root, 'adv/chapters/intro.chapter.json')
  const chapter = { schemaVersion: 1, id: 'intro', title: 'Current music', startNodeId: 'music', nodes: [{ id: 'music', type: 'audio', operations: [{ type: 'bgm', action: 'set', asset: currentId, loop: false, gain: 0.7, fade: { in: 500, out: 1000 } }] }, { id: 'listen', type: 'narration', text: 'Theme introduction' }, { id: 'end', type: 'end' }] }
  await writeFile(chapterPath, JSON.stringify(chapter))
  const toolchain = await probeAudioToolchain()
  const profile: AudioApprovedToolchainProfile = { id: 'music-local-integration', ffmpegBuildFingerprint: toolchain.fingerprint, workerImageDigest: `sha256:${'b'.repeat(64)}` }
  await writeFile(join(source.root, 'adv/audio/toolchain.json'), JSON.stringify({ schemaVersion: 1, profileId: profile.id, ffmpegBuildFingerprint: profile.ffmpegBuildFingerprint, workerImageDigest: profile.workerImageDigest }))
  const host = await createNodeAudioPublicationHost({ root: source.root, stateDirectory: join(source.directory, 'private-publication'), approvedProfiles: [profile], projectPrefix: 'fixture/music', publicBaseUrl: cos.url, storage: cos.storage })
  return {
    source,
    cos,
    host,
    chapterPath,
    async close() {
      await host.close()
      await cos.close()
      await rm(source.directory, { recursive: true, force: true })
    },
  }
}

describe('music publication follows the same current program projection as ordinary builds', () => {
  it('publishes referenced approved music plus legacy BGM, excluding unbound music and private handoff evidence', async () => {
    const project = await fixture()
    try {
      const before = await readFile(join(project.source.root, 'adv/assets.json'), 'utf8')
      const review = await project.host.prepare({})
      expect(review.assetCount).toBe(2)
      expect(review.objectCount).toBe(4)
      expect(review.assets.map(asset => asset.id).sort()).toEqual([currentId, legacyId].sort())
      for (const id of [pendingId, unusedApprovedId])
        await expect(project.host.prepare({ assetIds: [id] })).rejects.toThrow('AUDIO_RELEASE_ASSET_INVALID')
      expect(project.cos.requests).toHaveLength(0)
      const publication = await project.host.publish({ planId: review.planId, expectedManifestRevision: null })
      const manifest = await (await fetch(publication.manifestUrl)).json()
      expect(manifest.assets.map((asset: AdvAssetEntry) => asset.id).sort()).toEqual([currentId, legacyId].sort())
      expect(manifest.assets.every((asset: AdvAssetEntry) => asset.kind === 'bgm')).toBe(true)
      for (const privateValue of ['PRIVATE-', 'suno.com', 'USER-CHOSEN-TOOL', '"music":', '"rights":', 'current-theme.wav', 'reference/original'])
        expect(JSON.stringify(manifest)).not.toContain(privateValue)
      for (const asset of manifest.assets as AdvAssetEntry[]) {
        expect(asset.sha256).toBe(project.source.sha256)
        expect(Object.keys(asset.variants!).sort()).toEqual(['aac', 'opus'])
      }
      const publishedAudioCatalog = await loadPublishedAudioManifest(project.source.root, { audioManifest: publication.manifestUrl, audioManifestSha256: publication.revision })
      const prepared = await prepareProjectGame(await loadProject({ root: project.source.root }), { publishedAudioCatalog })
      expect(Object.keys(prepared.game.audio!.assets).sort()).toEqual([currentId, legacyId].sort())
      expect(prepared.resources.size).toBe(0)
      expect(prepared.game.audio!.assets[currentId]!.variants!.opus!.src).toContain(`${project.cos.url}fixture/music/`)
      expect(prepared.game.audio!.assets[currentId]!.variants!.aac!.src).toContain(`${project.cos.url}fixture/music/`)
      expect(JSON.stringify(prepared.game)).not.toMatch(/PRIVATE-|suno\.com|USER-CHOSEN-TOOL|"music":|"rights":/u)
      expect(await readFile(join(project.source.root, 'adv/assets.json'), 'utf8')).toBe(before)
      expect(project.source.calls).toEqual([])
    }
    finally { await project.close() }
  }, 30_000)

  it('rejects a reviewed publication before object I/O after music is removed from the current Flow', async () => {
    const project = await fixture()
    try {
      const review = await project.host.prepare({})
      await writeFile(project.chapterPath, JSON.stringify({ schemaVersion: 1, id: 'intro', title: 'No current music', startNodeId: 'listen', nodes: [{ id: 'listen', type: 'narration', text: 'Theme removed' }, { id: 'end', type: 'end' }] }))
      await expect(project.host.publish({ planId: review.planId, expectedManifestRevision: null })).rejects.toThrow('AUDIO_RELEASE_SOURCE_CONFLICT')
      expect(project.cos.requests).toHaveLength(0)
      expect(project.source.calls).toEqual([])
    }
    finally { await project.close() }
  }, 30_000)
})
