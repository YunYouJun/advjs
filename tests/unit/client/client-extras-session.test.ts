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

const script = `# Opening {#opening}

First line.

\`\`\`yaml
type: actions
actions:
  - type: variables/push-unique
    key: unlockedAchievements
    value: first
\`\`\`

Second line.

## Secret {#secret}

\`\`\`yaml
type: cg
id: secret-cg
\`\`\`

\`\`\`yaml
type: actions
actions:
  - type: variables/set
    key: canonicalCompleted
    value: true
  - type: variables/push-unique
    key: unlockedEndings
    value: secret-end
  - type: variables/push-unique
    key: unlockedAchievements
    value: secret
\`\`\`

Secret line.
`

const cleanups: Array<() => void> = []
afterEach(() => {
  cleanups.splice(0).forEach(cleanup => cleanup())
  localStorage.clear()
})

function setup() {
  audioBackend.current = createFakeAudioBackend()
  const pinia = createPinia()
  setActivePinia(pinia)
  const scope = effectScope()
  const gameConfig = computed<AdvGameConfig>(() => ({
    title: 'Extras session',
    description: '',
    favicon: '',
    variables: { canonicalCompleted: false, unlockedEndings: [], unlockedAchievements: [] },
    progression: { id: 'extras-session', keys: ['canonicalCompleted', 'unlockedEndings', 'unlockedAchievements'] },
    gallery: { id: 'extras-session', items: [{ id: 'secret-cg', title: 'Secret CG', src: '/secret.webp' }] },
    endings: { items: [{ id: 'secret-end', title: 'Secret ending' }] },
    achievements: { items: [{ id: 'first', title: 'First' }, { id: 'secret', title: 'Secret' }] },
    replays: [{ id: 'secret', title: 'Secret', chapterId: 'opening', nodeId: 'secret' }],
    musicRoom: {},
    audio: { assets: { 'bgm/day': { kind: 'bgm', src: '/day.ogg', title: 'Day' } } },
    requiredPlugins: {},
    characters: [],
    scenes: [],
    bgm: { autoplay: false },
    assets: { manifest: { bundles: [] } },
    chapters: [{ id: 'opening', title: 'Opening', nodes: [{ id: 'entry', type: 'fountain', src: '/opening.adv.md' }] }],
  }))
  const context = scope.run(() => setupAdvContext({
    config: computed<AdvConfig>(() => ({ gameConfig: gameConfig.value })),
    gameConfig,
    themeConfig: computed(() => ({})),
    pinia,
    fetcher: async () => ({ ok: true, status: 200, text: async () => script }),
  }))!
  cleanups.push(() => {
    context.$audio.dispose()
    context.runtime.dispose()
    scope.stop()
  })
  return { context, game: useGameStore(pinia) }
}

describe('extras in browser sessions', () => {
  it('records live unlocks once and raises a toast only for new achievements', async () => {
    const { context } = setup()
    await context.init()
    expect(context.extrasNotices.value).toEqual([])
    await context.runtime.start()
    await context.runtime.next()

    expect(context.extras?.achievements.value).toEqual(['first'])
    expect(context.extras?.visited.value).toEqual(['opening#opening'])
    expect(context.extrasNotices.value.map(item => item.id)).toEqual(['first'])

    // A new game restores the persisted achievement without announcing it again.
    context.extrasNotices.value = []
    await context.init()
    await context.runtime.start()
    await context.runtime.next()
    expect(context.extrasNotices.value).toEqual([])
  })

  it('replays in isolation without writing saves, progression or the extras record', async () => {
    const { context, game } = setup()
    await context.init()
    await context.runtime.start()
    await context.runtime.next()
    const progression = localStorage.getItem(context.progression!.storageKey)
    const extras = localStorage.getItem(context.extras!.storageKey)
    const readLogKey = context.readLog!.storageKey!
    const readLog = localStorage.getItem(readLogKey)
    expect(readLog).not.toBeNull()
    context.extrasNotices.value = []

    await context.init({ isolated: true, variables: { replayed: true } })
    expect(game.previewMode).toBe(true)
    expect(context.readLog?.storageKey).toBeUndefined()
    expect(context.runtime.state.value.variables).toEqual({ canonicalCompleted: false, unlockedEndings: [], unlockedAchievements: [], replayed: true })
    await context.runtime.go({ chapterId: 'opening', nodeId: 'secret' })

    expect(context.runtime.state.value.variables.unlockedEndings).toEqual(['secret-end'])
    expect(context.runtime.state.value.stage.cg).toBe('secret-cg')
    expect(localStorage.getItem(context.progression!.storageKey)).toBe(progression)
    expect(localStorage.getItem(context.extras!.storageKey)).toBe(extras)
    const visited = context.store.state.visited.at(-1)!
    expect(context.readLog?.isRead(visited)).toBe(true)
    expect(localStorage.getItem(readLogKey)).toBe(readLog)
    expect(localStorage.getItem(context.gallery!.storageKey)).toBeNull()
    expect(context.gallery?.unlocked.value).toEqual([])
    expect(context.extras?.endings.value).toEqual([])
    expect(context.extrasNotices.value).toEqual([])
    await game.save({ kind: 'manual', index: 1 }, context.runtime.snapshot())
    game.setPreviewMode(false)
    expect(await game.read({ kind: 'manual', index: 1 })).toBeUndefined()

    // The next ordinary session records again.
    await context.init()
    await context.runtime.go({ chapterId: 'opening', nodeId: 'secret' })
    expect(context.gallery?.unlocked.value).toEqual(['secret-cg'])
    expect(context.extras?.endings.value).toEqual(['secret-end'])
    expect(context.extrasNotices.value.map(item => item.id)).toEqual(['secret'])
  })

  it('keeps newer cross-playthrough unlocks when loading and continuing an older save', async () => {
    const { context, game } = setup()
    const slot = { kind: 'manual', index: 1 } as const
    await context.init()
    await context.runtime.start()
    const old = context.runtime.snapshot()
    await game.save(slot, old)
    await context.runtime.go({ chapterId: 'opening', nodeId: 'secret' })
    const unlocked = {
      canonicalCompleted: true,
      unlockedEndings: ['secret-end'],
      unlockedAchievements: ['secret'],
    }
    expect(context.progression?.restore({})).toEqual(unlocked)
    context.extrasNotices.value = []

    context.runtime.restore((await game.read(slot))!.snapshot)
    expect(context.runtime.state.value.variables).toEqual(old.state.variables)
    expect(context.progression?.restore({})).toEqual(unlocked)
    await context.runtime.next()

    expect(context.progression?.restore({})).toEqual({
      ...unlocked,
      unlockedAchievements: ['secret', 'first'],
    })
    expect(context.extras?.endings.value).toEqual(['secret-end'])
    expect(context.extrasNotices.value.map(item => item.id)).toEqual(['first'])
    await context.init()
    expect(context.runtime.state.value.variables).toEqual(context.progression?.restore({}))
  })

  it('plays and stops music room tracks on the music bus', async () => {
    const { context } = setup()
    await context.$audio.playMusic('bgm/day')
    expect(context.$audio.inspect().tracks.filter(track => track.bus === 'music' && track.status !== 'ended').map(track => track.assetId)).toEqual(['bgm/day'])
    await context.$audio.playMusic(null)
    expect(context.$audio.inspect().tracks.filter(track => track.bus === 'music' && track.status === 'playing')).toEqual([])
  })

  it('compiles the program for extras screens without installing a session', async () => {
    const { context } = setup()
    const program = await context.loadProgram()
    expect(Object.keys(program?.chapters ?? {})).toEqual(['opening'])
    expect(context.runtime.program.value?.id).toBe('advjs:bootstrap')
  })
})
