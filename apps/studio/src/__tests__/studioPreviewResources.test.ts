import type { AdvCharacter } from '@advjs/types'
import type { AudioInfo, ChapterInfo, SceneInfo } from '../composables/useProjectContent'
import type { IFileSystem } from '../utils/fs/types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useStudioAdvConfig } from '../composables/useStudioAdvConfig'

const project = vi.hoisted(() => ({ content: undefined as unknown, currentProject: { name: 'Preview regression' } }))
vi.mock('../composables/useProjectContent', () => ({ useProjectContent: () => project.content }))
vi.mock('../stores/useStudioStore', () => ({ useStudioStore: () => project }))

afterEach(() => vi.unstubAllGlobals())

describe('studio authoring resources → embedded game', () => {
  it('refreshes edited characters, tachies and audio into the runtime manifest and releases local media', async () => {
    const revoke = vi.fn()
    vi.stubGlobal('URL', class extends URL { static revokeObjectURL = revoke })
    const characters = ref<AdvCharacter[]>([{ id: 'alice', name: 'Alice', tachies: { default: { src: 'adv/tachies/alice.png' } } }])
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
