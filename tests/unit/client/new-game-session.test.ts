import type { AdvConfig, AdvGameConfig } from '@advjs/types'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope } from 'vue'
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

function setup(fetcher?: Parameters<typeof setupAdvContext>[0]['fetcher']) {
  const backend = createFakeAudioBackend()
  audioBackend.current = backend
  const pinia = createPinia()
  setActivePinia(pinia)
  const scope = effectScope()
  const gameConfig = computed<AdvGameConfig>(() => ({
    title: 'New game regression',
    description: '',
    favicon: '',
    variables: { score: 0 },
    requiredPlugins: {},
    characters: [],
    scenes: [],
    audio: { assets: { 'sfx/old': { kind: 'sfx', src: '/old.wav' } } },
    chapters: [{ id: 'opening', title: 'Opening', nodes: [{ id: 'entry', type: 'fountain', src: '/opening.adv.md' }] }],
  }))
  const context = scope.run(() => setupAdvContext({
    config: computed<AdvConfig>(() => ({ gameConfig: gameConfig.value })),
    gameConfig,
    themeConfig: computed(() => ({})),
    pinia,
    progressionStorage: false,
    galleryStorage: false,
    fetcher: fetcher ?? (async () => ({ ok: true, status: 200, text: async () => '# Opening {#opening}\n\nFirst line.\n\nSecond line.\n\nThird line.\n' })),
  }))!
  cleanups.push(() => {
    context.$audio.dispose()
    context.runtime.dispose()
    scope.stop()
  })
  return { context, game: useGameStore(pinia), backend }
}

describe('new game session boundary', () => {
  it('does not install a completed authoring compilation after its host request is cancelled', async () => {
    let resolveSource!: (value: any) => void
    const { context } = setup(() => new Promise((resolve) => {
      resolveSource = resolve
    }))
    const before = context.runtime.snapshot()
    let current = true
    const loading = context.init({ isCurrent: () => current })
    await vi.waitFor(() => expect(resolveSource).toBeTypeOf('function'))
    current = false
    resolveSource({ ok: true, status: 200, text: async () => '# Old draft\n\nMust not replace the current project.\n' })
    await loading
    expect(context.runtime.snapshot().state).toEqual(before.state)
    expect(context.store.program?.id).toBe('advjs:bootstrap')
  })

  it('reinitializes position, variables and history repeatedly without deleting saves or audio preferences', async () => {
    const { context, game } = setup()
    await context.init()
    await context.runtime.start()
    const opening = context.runtime.snapshot()
    context.$audio.setUserSettings({ buses: { music: { gain: 0.25 } } })
    for (let iteration = 0; iteration < 2; iteration++) {
      await context.runtime.next()
      const advanced = context.runtime.snapshot()
      advanced.state.variables.score = 42
      context.runtime.restore(advanced)
      await game.save({ kind: 'manual', index: 1 }, context.runtime.snapshot())
      expect(context.store.state.cursor).not.toEqual(opening.state.cursor)
      expect(context.runtime.snapshot().checkpoints.length).toBeGreaterThan(0)
      // The standalone page calls init() before start() for every new game.
      await context.init()
      await context.runtime.start()
      expect(context.store.state).toEqual(opening.state)
      expect(context.runtime.snapshot().checkpoints).toEqual([])
      expect(() => context.runtime.back()).toThrow('ADV_RUNTIME_NO_CHECKPOINT')
      expect(() => context.runtime.forward()).toThrow('ADV_RUNTIME_NO_FUTURE')
      expect(context.$audio.inspect().buses.music.gain).toBe(0.25)
      const saved = await game.read({ kind: 'manual', index: 1 })
      expect(saved?.snapshot.state.variables.score).toBe(42)
      expect(saved?.snapshot.state.cursor).toEqual(advanced.state.cursor)
      context.runtime.restore(saved!.snapshot)
      expect(context.store.state.variables.score).toBe(42)
      await context.init()
      await context.runtime.start()
      expect(context.store.state).toEqual(opening.state)
    }
  })

  it('does not carry story sound effects from the previous session into a fresh opening', async () => {
    const { context } = setup()
    await context.init()
    await context.runtime.start()
    await context.$audio.applyEffects([{ type: 'audio.sfx', payload: { assetId: 'sfx/old' } }], context.runtime.snapshot().state)
    expect(context.$audio.inspect().tracks.some(track => track.bus === 'sfx')).toBe(true)
    await context.init()
    await context.runtime.start()
    expect(context.$audio.inspect().tracks.filter(track => track.bus === 'sfx')).toEqual([])
  })

  it('ignores an earlier slow initialization after a newer game has already advanced', async () => {
    const first = Promise.withResolvers<{ ok: boolean, status: number, text: () => Promise<string> }>()
    const response = { ok: true, status: 200, text: async () => '# Opening {#opening}\n\nFirst line.\n\nSecond line.\n' }
    const fetcher = vi.fn().mockImplementationOnce(() => first.promise).mockResolvedValue(response)
    const { context } = setup(fetcher)
    const abandoned = context.init()
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce())
    await context.init()
    await context.runtime.start()
    await context.runtime.next()
    const current = context.runtime.snapshot()
    first.resolve(response)
    await abandoned
    expect(context.runtime.snapshot().state).toEqual(current.state)
    expect(context.runtime.snapshot().checkpoints).toEqual(current.checkpoints)
  })

  it.each(['auto', 'skip'])('clears %s and its pending timer without changing the saved delay preference', async (mode) => {
    const { context } = setup()
    await context.init()
    await context.runtime.start()
    vi.useFakeTimers()
    try {
      context.$auto.delay.value = 50
      context.$auto.skipInterval.value = 25
      if (mode === 'auto') {
        context.$auto.toggle()
        context.$auto.notifyPrintDone()
      }
      else {
        context.$auto.toggleSkip()
      }
      expect(vi.getTimerCount()).toBeGreaterThan(0)
      await context.init()
      await context.runtime.start()
      const opening = context.runtime.snapshot().state
      await vi.advanceTimersByTimeAsync(500)
      expect(context.store.state).toEqual(opening)
      expect(context.$auto.enabled.value).toBe(false)
      expect(context.$auto.skipEnabled.value).toBe(false)
      expect(context.$auto.delay.value).toBe(50)
      expect(context.$auto.skipInterval.value).toBe(25)
    }
    finally {
      vi.useRealTimers()
    }
  })
})
