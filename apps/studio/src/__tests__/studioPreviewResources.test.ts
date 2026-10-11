import type { AdvCharacter } from '@advjs/types'
import type { AudioInfo, ChapterInfo, SceneInfo } from '../composables/useProjectContent'
import type { IFileSystem } from '../utils/fs/types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isProxy, ref } from 'vue'
import { useStudioAdvConfig } from '../composables/useStudioAdvConfig'

const project = vi.hoisted(() => ({ content: undefined as unknown, currentProject: { name: 'Preview regression' } }))
vi.mock('../composables/useProjectContent', () => ({ useProjectContent: () => project.content }))
vi.mock('../stores/useStudioStore', () => ({ useStudioStore: () => project }))

afterEach(() => vi.unstubAllGlobals())

describe('studio authoring resources → embedded game', () => {
  it('compiles native JSON Flow sources and selected entry without Markdown wrapping or author Profile leakage', async () => {
    const documents: Record<string, string> = {
      'adv.config.json': JSON.stringify({ schemaVersion: 1, id: 'native-flow', root: 'adv', format: 'flow', entryChapterId: 'finale' }),
      'adv/settings/game.json': JSON.stringify({ locale: 'en', variables: { routeEnabled: true }, characters: [{ id: 'hero', name: 'Hero', voiceProfile: { intent: { speakingStyle: 'private' } } }] }),
      'adv/assets.json': JSON.stringify({ schemaVersion: 2, id: 'native-assets', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public/media' } }, assets: [] }),
      'adv/chapters/intro.chapter.json': JSON.stringify({ schemaVersion: 1, id: 'intro', title: 'Intro', nodes: [{ id: 'jump', type: 'start', next: { chapterId: 'finale', nodeId: 'speech' } }] }),
      'adv/chapters/finale.chapter.json': JSON.stringify({ schemaVersion: 1, id: 'finale', title: 'Finale', nodes: [{ id: 'speech', type: 'narration', text: 'Edited JSON narration', lineId: 'line_019d137e-7abc-7000-8000-000000000001', next: 'end', position: { x: 50, y: 80 } }, { id: 'end', type: 'end' }] }),
      'adv/chapters/old.adv.md': '@Hero\nRetained mirror must be ignored.',
    }
    const fs = { exists: async (path: string) => Object.hasOwn(documents, path), readFile: async (path: string) => documents[path], collectAllFiles: async () => Object.entries(documents).map(([path, content]) => ({ path, content, lastModified: new Date() })) } as unknown as IFileSystem
    project.content = { characters: ref([]), audios: ref([]), chapters: ref([{ file: 'adv/chapters/old.adv.md', name: 'Old', preview: '', content: documents['adv/chapters/old.adv.md'] }]), scenes: ref([]), getFs: () => fs }
    const config = useStudioAdvConfig()
    try {
      await config.refresh()
      expect(config.gameConfigRef.value.entryChapterId).toBe('finale')
      expect(isProxy(config.gameConfigRef.value)).toBe(false)
      expect(isProxy(config.gameConfigRef.value.variables)).toBe(false)
      expect(structuredClone(config.gameConfigRef.value.variables)).toEqual({ routeEnabled: true })
      expect(config.gameConfigRef.value.chapters!.map(chapter => chapter.id).sort()).toEqual(['finale', 'intro'])
      expect(config.gameConfigRef.value.chapters!.find(chapter => chapter.id === 'finale')!.nodes[0]).toMatchObject({ id: 'speech', type: 'narration', text: 'Edited JSON narration', lineId: 'line_019d137e-7abc-7000-8000-000000000001' })
      expect(config.chapterIdForFile('adv/chapters/finale.chapter.json')).toBe('finale')
      expect(config.gameConfigRef.value.audio!.locale).toBe('en')
      expect(JSON.stringify(config.gameConfigRef.value)).not.toContain('voiceProfile')
      expect(JSON.stringify(config.gameConfigRef.value.chapters)).not.toContain('position')
      expect(JSON.stringify(config.gameConfigRef.value.chapters)).not.toContain('Retained mirror')
    }
    finally { config.dispose() }
  })
  it('resolves selected-only native Opus and AAC transports through the Studio filesystem and disposes every variant URL', async () => {
    const revoke = vi.fn()
    vi.stubGlobal('URL', class extends URL { static revokeObjectURL = revoke })
    const hash = 'a'.repeat(64)
    const id = (kind: string, sequence: number) => `${kind}_019b1ca0-0000-7000-8000-${String(sequence).padStart(12, '0')}`
    const lineId = id('line', 1)
    const selectedId = id('audio', 1)
    const selectedTake = id('take', 1)
    const documents: Record<string, string> = {
      'adv/assets.json': JSON.stringify({ schemaVersion: 2, id: 'native-preview', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'adv/assets' } }, assets: [
        { id: selectedId, kind: 'voice', type: 'audio', path: 'selected.wav', sha256: hash, duration: 2, variants: { opus: { path: 'selected.webm', mimeType: 'audio/webm', sha256: hash, bytes: 100 }, aac: { path: 'selected.m4a', mimeType: 'audio/mp4', sha256: hash, bytes: 100 } } },
        { id: id('audio', 2), kind: 'voice', type: 'audio', path: 'private-history.wav', sha256: hash, variants: { aac: { path: 'private-history.m4a', mimeType: 'audio/mp4' } } },
        { id: id('audio', 3), kind: 'reference', type: 'audio', path: 'private-reference.wav', sha256: hash },
      ] }),
      'adv/audio/voice-ledger.json': JSON.stringify({ schemaVersion: 1, lines: { [lineId]: { speakerId: 'hero', displayText: 'Hello', locales: { en: { selectedTake, takes: [1, 2].map(sequence => ({ id: id('take', sequence), assetId: id('audio', sequence), sha256: hash, providerId: 'fake-tts', voiceId: 'supplier-voice', model: 'fixture-model', inputFingerprint: hash, voiceProfileRevision: hash, source: 'system', spokenText: 'Hello', createdAt: '2026-10-11T00:00:00Z' })) } } } } }),
    }
    const readBlobUrl = vi.fn(async (path: string) => `blob:${path}`)
    const fs = { exists: async (path: string) => Object.hasOwn(documents, path), readFile: async (path: string) => documents[path], readBlobUrl } as unknown as IFileSystem
    project.content = { characters: ref([]), audios: ref([]), chapters: ref([]), scenes: ref([]), getFs: () => fs }
    const config = useStudioAdvConfig()
    try {
      await config.refresh()
      const audio = config.gameConfigRef.value.audio!
      expect(Object.keys(audio.assets)).toEqual([selectedId])
      expect(audio.assets[selectedId]).toMatchObject({ src: 'blob:adv/assets/selected.wav', sha256: hash, variants: { opus: { src: 'blob:adv/assets/selected.webm', mime: 'audio/webm' }, aac: { src: 'blob:adv/assets/selected.m4a', mime: 'audio/mp4' } } })
      expect(audio.voiceLedger!.lines[lineId]!.locales.en!.takes.map(take => take.id)).toEqual([selectedTake])
      expect(readBlobUrl.mock.calls.map(([path]) => path).sort()).toEqual(['adv/assets/selected.m4a', 'adv/assets/selected.wav', 'adv/assets/selected.webm'])
      expect(JSON.stringify(audio)).not.toContain('private-history')
      expect(JSON.stringify(audio)).not.toContain('private-reference')
    }
    finally {
      config.dispose()
    }
    for (const path of ['selected.wav', 'selected.webm', 'selected.m4a'])
      expect(revoke).toHaveBeenCalledWith(`blob:adv/assets/${path}`)
  })

  it('refreshes edited characters, tachies and audio into the runtime manifest and releases local media', async () => {
    const revoke = vi.fn()
    vi.stubGlobal('URL', class extends URL { static revokeObjectURL = revoke })
    const authorVoiceProfile = { version: 1 as const, intent: { speakingStyle: 'calm' }, locales: { en: { providers: { 'private-provider': { voiceId: 'private-voice', model: 'private-model', source: 'system' as const } } } } }
    const characters = ref<AdvCharacter[]>([{ id: 'alice', name: 'Alice', voiceProfile: authorVoiceProfile, tachies: { default: { src: 'adv/tachies/alice.png' } } }])
    const audios = ref<AudioInfo[]>([{ file: 'adv/audio/calm.md', name: 'calm', src: 'adv/audio/calm.ogg' }])
    const chapters = ref<ChapterInfo[]>([{ file: 'adv/chapters/one.adv.md', name: 'One', preview: '', content: '# One\n\nHello.' }])
    const scenes = ref<SceneInfo[]>([])
    const fs = {
      exists: async () => false,
      readBlobUrl: async (path: string) => `blob:${path}`,
    } as unknown as IFileSystem
    project.content = { characters, audios, chapters, scenes, getFs: () => fs }
    const config = useStudioAdvConfig()
    try {
      await config.refresh()
      expect(config.ready.value).toBe(true)
      expect(config.configRef.value).toMatchObject({ viewportFit: 'responsive', themeConfig: { ui: { colorScheme: 'dark' } } })
      expect(config.gameConfigRef.value.characters?.[0]).toMatchObject({ avatar: 'blob:adv/tachies/alice.png', tachies: { default: { src: 'blob:adv/tachies/alice.png' } } })
      expect(config.gameConfigRef.value.characters?.[0]).not.toHaveProperty('voiceProfile')
      expect(characters.value[0]?.voiceProfile).toEqual(authorVoiceProfile)
      expect(JSON.stringify(config.gameConfigRef.value.characters)).not.toContain('private-provider')
      expect(config.gameConfigRef.value.bgm).toMatchObject({ library: { calm: { src: 'blob:adv/audio/calm.ogg' } } })
      expect(config.gameConfigRef.value.assets?.manifest.bundles.find(bundle => bundle.name === 'tachies')?.assets).toContainEqual({ alias: 'alice-default', src: 'blob:adv/tachies/alice.png' })
      const id = config.chapterIdForFile(chapters.value[0].file)!
      expect(config.chapterFileForId(id)).toBe(chapters.value[0].file)
      expect(await (await config.fetchChapter(chapters.value[0].file)).text()).toContain('Hello.')

      characters.value = [{ id: 'bob', name: 'Bob', tachies: { smile: { src: 'adv/tachies/bob.png' } } }]
      audios.value = [{ file: 'adv/audio/night.md', name: 'night', src: 'adv/audio/night.ogg' }]
      await config.refresh()
      expect(config.gameConfigRef.value.characters?.map(character => character.id)).toEqual(['bob'])
      expect(config.gameConfigRef.value.bgm?.library).toEqual({ night: expect.objectContaining({ src: 'blob:adv/audio/night.ogg' }) })
      expect(config.gameConfigRef.value.assets?.manifest.bundles.find(bundle => bundle.name === 'tachies')?.assets).toEqual([{ alias: 'bob-smile', src: 'blob:adv/tachies/bob.png' }])
    }
    finally {
      config.dispose()
    }
    for (const path of ['adv/tachies/alice.png', 'adv/audio/calm.ogg', 'adv/tachies/bob.png', 'adv/audio/night.ogg'])
      expect(revoke).toHaveBeenCalledWith(`blob:${path}`)
  })
})
