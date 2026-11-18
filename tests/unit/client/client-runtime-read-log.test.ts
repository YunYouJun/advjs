import type { FlowEditDocument } from '@advjs/core'
import type { AdvConfig, AdvGameConfig, RuntimeState } from '@advjs/types'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, shallowRef } from 'vue'
import { createFakeAudioBackend } from '../../../packages/audio/src/testing'
import { createBrowserReadLog } from '../../../packages/client/runtime/read-log'
import { setupAdvContext } from '../../../packages/client/setup/context'
import { useSettingsStore } from '../../../packages/client/stores/settings'

const audioBackend = vi.hoisted(() => ({ current: undefined as unknown }))
vi.mock('../../../packages/client/audio', async importOriginal => ({
  ...await importOriginal<typeof import('../../../packages/client/audio')>(),
  createBrowserAudioBackend: () => audioBackend.current,
}))

const cleanups: Array<() => void> = []
afterEach(() => {
  cleanups.splice(0).forEach(cleanup => cleanup())
  localStorage.clear()
  vi.useRealTimers()
})

function state(cursor: string, visited: string[], choices: Array<[string, string]> = []): RuntimeState {
  const [chapterId, nodeId] = cursor.split('#')
  return {
    status: 'playing',
    cursor: { chapterId, nodeId },
    variables: {},
    stage: { background: '', audio: { bgm: null, ambience: {} }, cg: '', tachies: {} },
    visited,
    choices: choices.map(([address, choiceId]) => {
      const [chapter, node] = address.split('#')
      return { node: { chapterId: chapter, nodeId: node }, choiceId }
    }),
  } as RuntimeState
}

describe('browser read log', () => {
  it('records whether the current node was read before it was entered, and persists across sessions', () => {
    const program = { id: 'game', hash: 'v1' }
    const first = createBrowserReadLog(program, { storage: localStorage })
    first.capture(state('main#a', []))
    first.capture(state('main#a', ['main#a']))
    // Repeated updates for the same node keep the decision made on entry.
    expect(first.currentWasRead.value).toBe(false)
    first.capture(state('main#b', ['main#a', 'main#b'], [['main#a', 'left']]))
    expect(first.currentWasRead.value).toBe(false)
    expect(first.isChoiceTaken('main#a', 'left')).toBe(true)

    const second = createBrowserReadLog(program, { storage: localStorage })
    expect(second.isRead('main#b')).toBe(true)
    expect(second.isChoiceTaken('main#a', 'left')).toBe(true)
    expect(second.isChoiceTaken('main#a', 'right')).toBe(false)
    second.capture(state('main#a', []))
    expect(second.currentWasRead.value).toBe(true)
    second.capture(state('main#c', ['main#a', 'main#c']))
    expect(second.currentWasRead.value).toBe(false)
  })

  it('imports a legacy saved cursor and keeps read history across stale controllers', () => {
    const program = { id: 'game', hash: 'v1' }
    const first = createBrowserReadLog(program, { storage: localStorage })
    const second = createBrowserReadLog(program, { storage: localStorage })
    first.capture(state('main#a', ['main#a'], [['main#a', 'left']]))
    expect(first.currentWasRead.value).toBe(false)
    first.capture(state('main#a', ['main#a']), { restored: true })
    expect(first.currentWasRead.value).toBe(true)

    second.capture(state('main#b', ['main#b'], [['main#a', 'right']]), { restored: true })
    expect(second.currentWasRead.value).toBe(true)
    const persisted = createBrowserReadLog(program, { storage: localStorage })
    expect(persisted.isRead('main#a')).toBe(true)
    expect(persisted.isRead('main#b')).toBe(true)
    expect(persisted.isChoiceTaken('main#a', 'left')).toBe(true)
    expect(persisted.isChoiceTaken('main#a', 'right')).toBe(true)
  })

  it('starts fresh when the program hash changes or the record is malformed', () => {
    createBrowserReadLog({ id: 'game', hash: 'v1' }, { storage: localStorage }).capture(state('main#a', ['main#a']))
    expect(createBrowserReadLog({ id: 'game', hash: 'v2' }, { storage: localStorage }).isRead('main#a')).toBe(false)
    expect(createBrowserReadLog({ id: 'other', hash: 'v1' }, { storage: localStorage }).isRead('main#a')).toBe(false)
    const log = createBrowserReadLog({ id: 'game', hash: 'v1' }, { storage: localStorage })
    localStorage.setItem(log.storageKey!, '{broken')
    expect(createBrowserReadLog({ id: 'game', hash: 'v1' }, { storage: localStorage }).isRead('main#a')).toBe(false)
  })

  it('keeps a session-only log without storage and survives blocked writes', () => {
    const memory = createBrowserReadLog({ id: 'game', hash: 'v1' })
    memory.capture(state('main#a', ['main#a']))
    expect(memory.storageKey).toBeUndefined()
    expect(memory.isRead('main#a')).toBe(true)
    expect(localStorage.length).toBe(0)

    const blocked = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError')
      },
    } as unknown as Storage
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const log = createBrowserReadLog({ id: 'game', hash: 'v1' }, { storage: blocked })
    log.capture(state('main#a', ['main#a']))
    expect(log.isRead('main#a')).toBe(true)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

const chapter: FlowEditDocument = {
  schemaVersion: 1,
  id: 'intro',
  title: 'Intro',
  nodes: [
    { id: 'first', type: 'narration', text: 'First line' },
    { id: 'second', type: 'narration', text: 'Second line' },
    { id: 'decision', type: 'choices', choices: [{ id: 'left', text: 'Left', target: 'left-line' }, { id: 'right', text: 'Right', target: 'right-line' }] },
    { id: 'left-line', type: 'narration', text: 'Left path' },
    { id: 'left-end', type: 'end' },
    { id: 'right-line', type: 'narration', text: 'Right path' },
    { id: 'right-end', type: 'end' },
  ],
}

function setup() {
  audioBackend.current = createFakeAudioBackend()
  const pinia = createPinia()
  setActivePinia(pinia)
  const scope = effectScope()
  const gameConfig = shallowRef<AdvGameConfig>({
    title: 'Read log',
    description: '',
    favicon: '',
    characters: [],
    scenes: [],
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
  return { context }
}

describe('skip read text only', () => {
  it('skips lines read in an earlier playthrough and stops at the first unread one', async () => {
    const { context } = setup()
    await context.init()
    await context.runtime.start()
    // Nothing is read in a fresh browser, so skip refuses to start.
    context.$auto.toggleSkip()
    expect(context.$auto.skipEnabled.value).toBe(false)
    await context.runtime.next()
    await context.runtime.next()
    await context.runtime.choose('left')
    expect(context.store.current?.id).toBe('left-line')

    // New game: same program, read log restored from storage.
    await context.init()
    await context.runtime.start()
    expect(context.readLog?.currentWasRead.value).toBe(true)
    expect(context.readLog?.isChoiceTaken('intro#decision', 'left')).toBe(true)
    vi.useFakeTimers()
    context.$auto.toggleSkip()
    await vi.advanceTimersByTimeAsync(1000)
    expect(context.store.current?.id).toBe('decision')
    expect(context.$auto.skipEnabled.value).toBe(false)

    await context.runtime.choose('right')
    context.$auto.toggleSkip()
    await vi.advanceTimersByTimeAsync(1000)
    expect(context.store.current?.id).toBe('right-line')
    expect(context.$auto.skipEnabled.value).toBe(false)
  })

  it('passes unread lines when the player chooses to skip all text', async () => {
    const { context } = setup()
    useSettingsStore().storage.skip = 'all'
    await context.init()
    await context.runtime.start()
    vi.useFakeTimers()
    context.$auto.toggleSkip()
    await vi.advanceTimersByTimeAsync(1000)
    expect(context.store.current?.id).toBe('decision')
  })

  it('stops pending playback on a valid restore and keeps the newer read history', async () => {
    const { context } = setup()
    await context.init()
    await context.runtime.start()
    const saved = context.runtime.snapshot()
    await context.runtime.next()
    vi.useFakeTimers()
    context.$auto.toggle()
    context.$auto.notifyPrintDone()

    context.runtime.restore(saved)
    expect(context.$auto.enabled.value).toBe(false)
    expect(context.readLog?.currentWasRead.value).toBe(true)
    expect(context.readLog?.isRead('intro#second')).toBe(true)
    await vi.advanceTimersByTimeAsync(3000)
    expect(context.store.current?.id).toBe('first')
    context.$auto.toggleSkip()
    await vi.advanceTimersByTimeAsync(1000)
    expect(context.store.current?.id).toBe('decision')
    expect(context.$auto.skipEnabled.value).toBe(false)
  })

  it('keeps draft previews out of browser storage but still skips within the session', async () => {
    const { context } = setup()
    await context.init({ persistence: false })
    await context.runtime.start()
    await context.runtime.next()
    expect(context.readLog?.storageKey).toBeUndefined()
    expect(Object.keys(localStorage).some(key => key.startsWith('advjs:read-log:'))).toBe(false)
    context.runtime.back()
    expect(context.readLog?.isRead('intro#first')).toBe(true)
  })
})
