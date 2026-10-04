import { createPinia, setActivePinia } from 'pinia'
import { afterEach, expect, it, vi } from 'vitest'
import { computed, ref, shallowRef } from 'vue'
import { useCharacterStore } from '../../editor/core/app/stores/useCharacterStore'
import { parseCharacterMd, stringifyCharacterMd } from '../../packages/parser/src/character'

afterEach(() => vi.unstubAllGlobals())

it('saves and exports a card opened directly from the project tree without a separate directory connection', async () => {
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('shallowRef', shallowRef)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('useLocalStorage', (_key: string, initial: unknown) => ref(initial))
  setActivePinia(createPinia())
  let source = stringifyCharacterMd({
    id: 'hero',
    name: 'Hero',
    visual: { version: 'v1', fixedTraits: ['Short beard'] },
    background: 'Keep the story',
  })
  const store = useCharacterStore()
  store.selectedCharacter = parseCharacterMd(source)
  store.selectedCharacterHandle = {
    name: 'hero.character.md',
    getFile: async () => ({ text: async () => source }),
    createWritable: async () => ({
      write: async (value: string) => { source = value },
      close: async () => {},
    }),
  } as unknown as FileSystemFileHandle
  expect(await store.exportForAI('hero')).toContain('Short beard')
  await store.updateCharacter({ ...store.selectedCharacter, name: 'Renamed' })
  const saved = parseCharacterMd(source)
  expect(saved.name).toBe('Renamed')
  expect(saved.visual).toEqual({ version: 'v1', fixedTraits: ['Short beard'] })
  expect(saved.background).toBe('Keep the story')
})
