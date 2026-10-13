import type { FlowEditDocument } from '@advjs/core'
import type { AdvConfig, AdvGameConfig, RuntimeProgram } from '@advjs/types'
import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, shallowRef } from 'vue'
import { nativeFlowPreviewSnapshot } from '../../../editor/core/app/utils/native-flow-preview'
import { createFakeAudioBackend } from '../../../packages/audio/src/testing'
import { setupAdvContext } from '../../../packages/client/setup/context'
import { useGameStore } from '../../../packages/client/stores/useGameStore'

const audioBackend = vi.hoisted(() => ({ current: undefined as unknown }))
vi.mock('../../../packages/client/audio', async importOriginal => ({
  ...await importOriginal<typeof import('../../../packages/client/audio')>(),
  createBrowserAudioBackend: () => audioBackend.current,
}))

const cleanups: Array<() => void> = []
afterEach(() => {
  cleanups.splice(0).forEach(cleanup => cleanup())
  localStorage.clear()
})

const chapter: FlowEditDocument = {
  schemaVersion: 1,
  id: 'intro',
  title: 'Intro',
  nodes: [
    { id: 'greeting', type: 'narration', text: 'Draft first line', lineId: 'line_019d137e-7abc-7000-8000-000000000001' },
    { id: 'decision', type: 'choices', choices: [{ id: 'yes', text: 'Continue', target: 'ending' }] },
    { id: 'ending', type: 'end' },
  ],
}

function storageBytes() {
  return Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)]))
}

function setup() {
  audioBackend.current = createFakeAudioBackend()
  const pinia = createPinia()
  setActivePinia(pinia)
  const scope = effectScope()
  const gameConfig = shallowRef<AdvGameConfig>({
    title: 'Draft persistence',
    description: '',
    favicon: '',
    characters: [],
    scenes: [],
    variables: { unlocked: false },
    progression: { id: 'draft-persistence', version: 1, keys: ['unlocked'] },
    gallery: { id: 'draft-persistence', version: 1, items: [{ id: 'kept', title: 'Kept', src: '/kept.webp' }] },
    chapters: [chapter as unknown as AdvGameConfig['chapters'][number]],
  })
  const context = scope.run(() => setupAdvContext({
    config: computed<AdvConfig>(() => ({ gameConfig: gameConfig.value })),
    gameConfig: computed(() => gameConfig.value),
    themeConfig: computed(() => ({})),
    pinia,
  }))!
  cleanups.push(() => {
    context.$audio.dispose()
    context.runtime.dispose()
    scope.stop()
  })
  return { context, gameConfig, game: useGameStore(pinia) }
}

describe('draft preview persistence isolation', () => {
  it('keeps saved progression, gallery and saves byte-identical across actual draft restore, next, choices and save operations', async () => {
    localStorage.setItem('advjs:progression:draft-persistence:v1', JSON.stringify({ schemaVersion: 1, variables: { unlocked: true } }))
    localStorage.setItem('advjs:gallery:draft-persistence:v1', JSON.stringify({ schemaVersion: 1, unlocked: ['kept'] }))
    const { context, game, gameConfig } = setup()
    await context.init()
    await context.runtime.start()
    await game.save({ kind: 'manual', index: 1 }, context.runtime.snapshot(), { memo: 'Keep this source save' })
    await flushPromises()
    const sourceSave = await game.read({ kind: 'manual', index: 1 })
    const before = storageBytes()

    await context.init({ persistence: false })
    const derived = nativeFlowPreviewSnapshot(context.store.program as RuntimeProgram, context.runtime.snapshot(), { document: chapter, nodeId: 'greeting' }, gameConfig.value.variables)
    context.runtime.restore(derived.snapshot)
    expect(context.store.state.variables.unlocked).toBe(false)
    expect(context.progression).toBeUndefined()
    expect(context.gallery).toBeUndefined()
    expect(game.previewMode).toBe(true)
    expect(await game.read({ kind: 'manual', index: 1 })).toBeUndefined()
    await context.runtime.next()
    expect(context.store.state.status).toBe('waiting-choice')
    await context.runtime.choose('yes')
    await flushPromises()
    expect(await game.list('auto')).not.toHaveLength(0)
    await game.save({ kind: 'manual', index: 1 }, context.runtime.snapshot(), { memo: 'Ephemeral draft' })
    await game.save({ kind: 'quick' }, context.runtime.snapshot())
    await game.updateMeta({ kind: 'manual', index: 1 }, { memo: 'Draft rename' })
    expect((await game.read({ kind: 'manual', index: 1 }))?.meta.memo).toBe('Draft rename')
    await game.remove({ kind: 'manual', index: 1 })
    expect(storageBytes()).toEqual(before)

    await context.init()
    expect(game.previewMode).toBe(false)
    expect(context.store.state.variables.unlocked).toBe(true)
    expect(context.gallery?.isUnlocked('kept')).toBe(true)
    expect(await game.read({ kind: 'manual', index: 1 })).toEqual(sourceSave)
    expect(await game.read({ kind: 'quick' })).toBeUndefined()
    expect(storageBytes()).toEqual(before)
  })

  it('clears controllers when the next source project does not declare progression or gallery', async () => {
    const { context, gameConfig } = setup()
    await context.init()
    expect(context.progression).toBeDefined()
    expect(context.gallery).toBeDefined()
    const before = storageBytes()
    gameConfig.value = { ...gameConfig.value, progression: undefined, gallery: undefined }
    await context.init()
    await context.runtime.start()
    expect(context.progression).toBeUndefined()
    expect(context.gallery).toBeUndefined()
    expect(localStorage.getItem('advjs:progression:draft-persistence:v1')).toBe(before['advjs:progression:draft-persistence:v1'])
  })

  it('preserves a pending normal save restoration when initializing an ordinary source game', async () => {
    const { context, game } = setup()
    await context.init()
    await context.runtime.start()
    const pending = context.runtime.snapshot()
    game.pendingRestore = pending
    await context.init()
    expect(game.pendingRestore).toEqual(pending)
  })
})
