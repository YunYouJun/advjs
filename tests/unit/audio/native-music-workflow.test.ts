// @vitest-environment node
import type { AdvAssetEntry, AdvMusicUsage } from '@advjs/types'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createMusicMetadata, musicPlaybackDefaults } from '@advjs/audio'
import { describe, expect, it } from 'vitest'
import { prepareProjectGame } from '../../../packages/advjs/node/commands/build/project'
import { loadProject } from '../../../packages/advjs/node/project'
import { createFakeAudioBackend } from '../../../packages/audio/src/testing'
import { useAdvAudio } from '../../../packages/client/composables/useAdvAudio'
import { compileProject, validateProjectAudioOperations } from '../../../packages/core/src/project'
import { createAdvRuntime } from '../../../packages/core/src/runtime'
import { createEditorVoiceDesignFixture } from '../../fixtures/audio/editor-voice-design'

const adoptedId = 'audio_019d137e-7abc-7000-8000-000000000160'
const unusedId = 'audio_019d137e-7abc-7000-8000-000000000161'
const usages: AdvMusicUsage[] = ['background', 'theme', 'opening', 'ending', 'insert']

describe('ordinary native music authoring and playback', () => {
  it.each((['pending', 'rejected', 'changed-sha'] as const).flatMap(review => (['flow', 'adv-md'] as const).map(format => ({ review, format }))))('rejects $review musical review in hand-written $format before producing a playable Program', async ({ review, format }) => {
    const music = createMusicMetadata({ usage: 'theme', source: { type: 'manual' }, rights: { license: 'original-test' } })
    const asset: AdvAssetEntry = { id: adoptedId, type: 'audio', kind: 'bgm', path: 'music.wav', sha256: 'a'.repeat(64), music: { ...music, review: review === 'changed-sha' ? { status: 'approved', sha256: 'b'.repeat(64), reviewedAt: '2026-10-12T08:00:00.000Z' } : { status: review } } }
    const operation = { type: 'bgm' as const, action: 'set' as const, asset: adoptedId }
    const catalog = { schemaVersion: 2 as const, id: 'review-check', defaultProfile: 'local', profiles: { local: { provider: 'project' as const, root: 'public/media' } }, assets: [asset] }
    expect(() => validateProjectAudioOperations([operation], catalog)).toThrow('ADV_AUDIO_MUSIC_REVIEW_REQUIRED')
    const files = {
      'adv.config.json': JSON.stringify({ id: 'review-check', root: 'adv', format }),
      'adv/settings/game.json': JSON.stringify({ title: 'Review check' }),
      'adv/assets.json': JSON.stringify(catalog),
      [`adv/chapters/intro.${format === 'flow' ? 'chapter.json' : 'adv.md'}`]: format === 'flow'
        ? JSON.stringify({ schemaVersion: 1, id: 'intro', title: 'Intro', nodes: [{ id: 'music', type: 'audio', operations: [operation] }, { id: 'listen', type: 'narration', text: 'Listen' }] })
        : `${'```advnode'}\n${JSON.stringify([operation])}\n${'```'}\n\n（Listen）`,
    }
    const compiled = await compileProject({ files })
    expect(compiled.project.program).toBeUndefined()
    expect(compiled.diagnostics).toContainEqual(expect.objectContaining({ code: 'ADV_AUDIO_MUSIC_REVIEW_REQUIRED', severity: 'error' }))
  })

  it.each(usages.flatMap(usage => (['flow', 'adv-md'] as const).map(format => ({ usage, format }))))('plays adopted $usage through canonical $format music while excluding unbound candidates and private briefs', async ({ usage, format }) => {
    const source = await createEditorVoiceDesignFixture()
    try {
      const music = createMusicMetadata({ usage, source: { type: 'external-ai', tool: 'USER-CHOSEN-CREATOR', url: 'https://suno.com/create' }, brief: { summary: 'PRIVATE-MUSIC-BRIEF', instrumental: usage === 'background' }, rights: { license: 'original-test-wave', permissionNote: 'PRIVATE-MUSIC-PERMISSION' } })
      const asset: AdvAssetEntry = { id: adoptedId, type: 'audio', kind: 'bgm', path: 'adopted-music.wav', sha256: source.sha256, bytes: source.bytes.length, mimeType: 'audio/wav', duration: 1, license: 'original-test-wave', music: { ...music, review: { status: 'approved', sha256: source.sha256, reviewedAt: '2026-10-12T08:00:00.000Z' } } }
      const catalog = JSON.parse(await readFile(join(source.root, 'adv/assets.json'), 'utf8'))
      // A missing candidate master proves export never even reads unbound music.
      catalog.assets.push(asset, { ...asset, id: unusedId, path: 'PRIVATE-UNBOUND-MUSIC.wav', music })
      await writeFile(join(source.root, 'adv/assets.json'), JSON.stringify(catalog))
      await writeFile(join(source.root, 'public/media/adopted-music.wav'), source.bytes)
      await writeFile(join(source.root, 'adv.config.json'), JSON.stringify({ id: 'editor-jobs', root: 'adv', format, entryChapterId: 'intro' }))
      const start = { type: 'bgm', action: 'set', asset: adoptedId, ...musicPlaybackDefaults(usage) }
      const stop = { type: 'bgm', action: 'clear', fade: { out: 1000 } }
      const markdown = `${'```advnode'}\n${JSON.stringify([start])}\n${'```'}\n\n（试听音乐）\n\n${'```advnode'}\n${JSON.stringify([stop])}\n${'```'}\n\n（音乐结束）`
      if (format === 'flow') {
        await rm(join(source.root, 'adv/chapters/intro.adv.md'))
        await writeFile(join(source.root, 'adv/chapters/intro.chapter.json'), JSON.stringify({ schemaVersion: 1, id: 'intro', title: 'Music workflow', nodes: [{ id: 'music', type: 'audio', operations: [start] }, { id: 'listen', type: 'narration', text: '试听音乐' }, { id: 'clear', type: 'audio', operations: [stop] }, { id: 'done', type: 'narration', text: '音乐结束' }, { id: 'end', type: 'end' }] }))
      }
      else {
        await writeFile(join(source.root, 'adv/chapters/intro.adv.md'), markdown)
      }
      const before = await readFile(join(source.root, 'adv/assets.json'), 'utf8')
      const loaded = await loadProject({ root: source.root })
      expect(loaded.result.diagnostics.filter(issue => issue.severity === 'error')).toEqual([])
      const prepared = await prepareProjectGame(loaded)
      expect(Object.keys(prepared.game.audio!.assets)).toEqual([adoptedId])
      expect(Object.keys(prepared.game.bgm.library!)).toEqual([adoptedId])
      expect([...prepared.resources.values()]).toEqual([source.bytes])
      expect(prepared.game.audio!.assets[adoptedId]!.sha256).toBe(source.sha256)
      for (const value of ['PRIVATE-MUSIC-BRIEF', 'PRIVATE-MUSIC-PERMISSION', 'PRIVATE-UNBOUND-MUSIC', 'USER-CHOSEN-CREATOR', 'https://suno.com/create', '"music":', '"rights":'])
        expect(JSON.stringify(prepared.game)).not.toContain(value)
      const runtime = createAdvRuntime({ program: loaded.result.project.program! })
      const first = await runtime.start()
      expect(first.state.stage.audio.bgm).toMatchObject({ assetId: adoptedId, gain: 0.7, loop: usage === 'background', fadeInMs: 500, fadeOutMs: 1000 })
      const backend = createFakeAudioBackend()
      const audio = useAdvAudio({ backend, gameConfig: () => prepared.game })
      try {
        await audio.applyEffects(first.effects, first.state)
        expect(backend.playbacks).toHaveLength(1)
        const playback = backend.playbacks[0]!
        expect(playback.bus).toBe('music')
        expect(playback.loop).toBe(usage === 'background')
        expect(playback.asset.url).toBe(prepared.game.audio!.assets[adoptedId]!.src)
        expect(playback.fades).toContainEqual(expect.objectContaining({ durationMs: 500 }))
        audio.pause()
        expect(playback.paused).toBe(true)
        await audio.resume()
        expect(playback.playing).toBe(true)
        const next = await runtime.next()
        await audio.applyEffects(next.effects, next.state)
        expect(next.state.stage.audio.bgm).toBeNull()
        expect(playback.stopped).toBe(true)
        expect(playback.fades).toContainEqual(expect.objectContaining({ durationMs: 1000 }))
      }
      finally { audio.dispose() }
      expect(await readFile(join(source.root, 'adv/assets.json'), 'utf8')).toBe(before)
      expect(source.calls).toEqual([])
    }
    finally { await rm(source.directory, { recursive: true, force: true }) }
  })
})
