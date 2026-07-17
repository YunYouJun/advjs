import type { AdvConfig, AdvGameConfig, RuntimeSnapshot } from '@advjs/types'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'
import { computed } from 'vue'
import { createBrowserRuntimeProgression } from '../../packages/client/runtime/progression'
import { setupAdvContext } from '../../packages/client/setup/context'

class MemoryWebStorage implements Storage {
  private readonly values = new Map<string, string>()

  get length() {
    return this.values.size
  }

  clear(): void {
    this.values.clear()
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

const progressionConfig = {
  id: 'hamster',
  version: 1,
  keys: ['canonicalCompleted', 'unlockedEndings'],
}

describe('browser runtime meta progression', () => {
  it('captures only whitelisted variables and restores clones over fresh defaults', () => {
    const storage = new MemoryWebStorage()
    const progression = createBrowserRuntimeProgression(progressionConfig, { storage })
    progression.capture({
      canonicalCompleted: true,
      unlockedEndings: ['still-gazing'],
      storyMode: 'interpretive',
    })

    expect(JSON.parse(storage.getItem(progression.storageKey)!)).toEqual({
      schemaVersion: 1,
      variables: {
        canonicalCompleted: true,
        unlockedEndings: ['still-gazing'],
      },
    })

    const restored = progression.restore({
      canonicalCompleted: false,
      unlockedEndings: [],
      storyMode: 'canonical',
    })
    expect(restored).toEqual({
      canonicalCompleted: true,
      unlockedEndings: ['still-gazing'],
      storyMode: 'canonical',
    })

    ;(restored.unlockedEndings as string[]).push('mutated')
    expect(progression.restore({ unlockedEndings: [] }).unlockedEndings).toEqual(['still-gazing'])
  })

  it('isolates game IDs and versions and clears only its own record', () => {
    const storage = new MemoryWebStorage()
    const first = createBrowserRuntimeProgression(progressionConfig, { storage })
    const nextVersion = createBrowserRuntimeProgression({ ...progressionConfig, version: 2 }, { storage })
    const otherGame = createBrowserRuntimeProgression({ ...progressionConfig, id: 'other/game' }, { storage })

    first.capture({ canonicalCompleted: true })
    nextVersion.capture({ canonicalCompleted: false })
    otherGame.capture({ canonicalCompleted: true })

    expect(new Set([first.storageKey, nextVersion.storageKey, otherGame.storageKey]).size).toBe(3)
    expect(first.storageKey).toBe('advjs:progression:hamster:v1')
    expect(otherGame.storageKey).toContain('other%2Fgame')

    first.clear()
    expect(storage.getItem(first.storageKey)).toBeNull()
    expect(storage.getItem(nextVersion.storageKey)).not.toBeNull()
    expect(storage.getItem(otherGame.storageKey)).not.toBeNull()
  })

  it('falls back to fresh defaults for malformed or incompatible records', () => {
    const storage = new MemoryWebStorage()
    const progression = createBrowserRuntimeProgression(progressionConfig, { storage })
    const defaults = { canonicalCompleted: false, storyMode: 'canonical' }

    storage.setItem(progression.storageKey, '{not-json')
    expect(progression.restore(defaults)).toEqual(defaults)

    storage.setItem(progression.storageKey, JSON.stringify({
      schemaVersion: 2,
      variables: { canonicalCompleted: true },
    }))
    expect(progression.restore(defaults)).toEqual(defaults)

    storage.setItem(progression.storageKey, JSON.stringify({
      schemaVersion: 1,
      variables: ['not-an-object'],
    }))
    expect(progression.restore(defaults)).toEqual(defaults)
  })

  it('falls back to fresh defaults when browser storage reads are blocked', () => {
    const storage = new MemoryWebStorage()
    storage.getItem = () => {
      throw new DOMException('blocked', 'SecurityError')
    }
    const progression = createBrowserRuntimeProgression(progressionConfig, { storage })

    expect(progression.restore({ canonicalCompleted: false })).toEqual({
      canonicalCompleted: false,
    })
  })

  it.each([
    { id: '', version: 1, keys: ['value'] },
    { id: 'game', version: 0, keys: ['value'] },
    { id: 'game', version: 1, keys: [] },
    { id: 'game', version: 1, keys: ['value', 'value'] },
    { id: 'game', version: 1, keys: [''] },
  ])('rejects invalid progression config $id/$version/$keys', (config) => {
    expect(() => createBrowserRuntimeProgression(config, {
      storage: new MemoryWebStorage(),
    })).toThrow(TypeError)
  })

  it('restores and captures progression at the client context boundary', async () => {
    const storage = new MemoryWebStorage()
    createBrowserRuntimeProgression(progressionConfig, { storage }).capture({
      canonicalCompleted: true,
      unlockedEndings: ['still-gazing'],
    })

    const gameConfig = computed<AdvGameConfig>(() => ({
      title: 'Progression Test',
      description: 'test',
      favicon: '/favicon.svg',
      bgm: { autoplay: false },
      assets: { manifest: { bundles: [] } },
      variables: {
        canonicalCompleted: false,
        storyMode: 'canonical',
        unlockedEndings: [],
      },
      progression: progressionConfig,
      requiredPlugins: {},
      chapters: [{
        id: 'chapter-1',
        title: 'Chapter 1',
        nodes: [{
          id: 'entry',
          type: 'fountain',
          src: '/chapter-1.adv.md',
        }],
      }],
      characters: [],
      scenes: [],
    }))
    const config = computed<AdvConfig>(() => ({
      gameConfig: gameConfig.value,
    }))
    const pinia = createPinia()
    setActivePinia(pinia)
    const context = setupAdvContext({
      config,
      gameConfig,
      themeConfig: computed(() => ({})),
      progressionStorage: storage,
      pinia,
      fetcher: async () => ({
        ok: true,
        status: 200,
        text: async () => '# Entry {#entry}\n\nThe story begins.\n',
      }),
    })

    await context.init()

    expect(context.progression?.storageKey).toBe('advjs:progression:hamster:v1')
    expect(context.store.state.variables).toMatchObject({
      canonicalCompleted: true,
      storyMode: 'canonical',
      unlockedEndings: ['still-gazing'],
    })

    const snapshot = context.runtime.snapshot() as RuntimeSnapshot
    snapshot.state.variables.unlockedEndings = ['still-gazing', 'endless-wheel']
    context.runtime.restore(snapshot)
    expect(createBrowserRuntimeProgression(progressionConfig, { storage }).restore({})).toEqual({
      canonicalCompleted: true,
      unlockedEndings: ['still-gazing', 'endless-wheel'],
    })

    context.runtime.dispose()
  })
})
