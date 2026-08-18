import type { AdvCharacterDynamicState, WorldClockState } from '@advjs/types'
import type * as Y from 'yjs'
import { ref, watch } from 'vue'
import { useCharacterStateStore } from '../stores/useCharacterStateStore'
import { useWorldClockStore } from '../stores/useWorldClockStore'

// --- Constants ---

const KEY_CHARACTER_STATES = 'state:characterStates'
const KEY_WORLD_CLOCK = 'state:worldClock'
// --- Composable ---

/**
 * Bidirectional bridge between Yjs shared types and Pinia stores.
 *
 * - Character states  → Y.Map (`state:characterStates`)
 * - World clock       → Y.Map (`state:worldClock`)
 * - Chat messages     → Y.Array (`state:chatMessages`)
 *
 * Includes anti-echo guard, batch update merging, and disconnect handling.
 */
export function useCollabSync() {
  const isActive = ref(false)

  // Anti-echo: when true, local store watchers skip writing back to Yjs
  let _fromRemote = false
  // Anti-echo: when true, Yjs observers skip writing back to Store
  let _fromLocal = false

  // Cleanup handles
  const _cleanups: Array<() => void> = []

  // --- Public API ---

  /**
   * Start bidirectional sync between Yjs shared types and Pinia stores.
   * Call this after the provider has emitted `synced`.
   */
  function startSync(
    getSharedMap: (key: string) => Y.Map<any> | null,
    _getSharedArray: (key: string) => Y.Array<any> | null,
  ) {
    if (isActive.value)
      return
    isActive.value = true

    setupCharacterStateSync(getSharedMap)
    setupWorldClockSync(getSharedMap)
  }

  /**
   * Stop all sync — destroy Yjs observers and Vue watchers.
   * Pinia stores keep their current snapshot and continue working offline.
   */
  function stopSync() {
    for (const cleanup of _cleanups)
      cleanup()
    _cleanups.length = 0
    isActive.value = false
  }

  // --- Character State Sync ---

  function setupCharacterStateSync(getSharedMap: (key: string) => Y.Map<any> | null) {
    const ymap = getSharedMap(KEY_CHARACTER_STATES)
    if (!ymap)
      return

    const store = useCharacterStateStore()

    // 1. Initial load: push local state → Yjs (if Yjs is empty) or merge
    const localStates = store.states
    if (ymap.size === 0 && localStates.size > 0) {
      // First joiner — seed Yjs from local
      ymap.doc!.transact(() => {
        for (const [charId, state] of localStates.entries()) {
          ymap.set(charId, { ...state })
        }
      }, 'local')
    }
    else if (ymap.size > 0) {
      // Yjs has data — merge into local store
      _fromRemote = true
      for (const [charId, state] of ymap.entries()) {
        store.updateState(charId, state as Partial<AdvCharacterDynamicState>)
      }
      _fromRemote = false
    }

    // 2. Yjs → Store: observe remote changes
    const observer = (events: Y.YMapEvent<any>, txn: Y.Transaction) => {
      if (txn.origin === 'local' || _fromLocal)
        return
      _fromRemote = true
      try {
        for (const [key, change] of events.keys) {
          if (change.action === 'delete') {
            store.states.delete(key)
          }
          else {
            const val = ymap.get(key) as AdvCharacterDynamicState
            if (val)
              store.updateState(key, val)
          }
        }
      }
      finally {
        _fromRemote = false
      }
    }
    ymap.observe(observer)
    _cleanups.push(() => ymap.unobserve(observer))

    // 3. Store → Yjs: watch local changes
    const stopWatch = watch(
      () => store.states,
      (states) => {
        if (_fromRemote || !isActive.value)
          return
        _fromLocal = true
        try {
          ymap.doc!.transact(() => {
            for (const [charId, state] of states.entries()) {
              const existing = ymap.get(charId)
              if (!existing || existing.lastUpdated !== state.lastUpdated) {
                ymap.set(charId, { ...state })
              }
            }
            // Remove keys deleted locally
            for (const key of ymap.keys()) {
              if (!states.has(key))
                ymap.delete(key)
            }
          }, 'local')
        }
        finally {
          _fromLocal = false
        }
      },
      { deep: true },
    )
    _cleanups.push(stopWatch)
  }

  // --- World Clock Sync ---

  function setupWorldClockSync(getSharedMap: (key: string) => Y.Map<any> | null) {
    const ymap = getSharedMap(KEY_WORLD_CLOCK)
    if (!ymap)
      return

    const store = useWorldClockStore()

    // 1. Initial: seed or merge
    if (ymap.size === 0) {
      ymap.doc!.transact(() => {
        const c = store.clock
        ymap.set('date', c.date)
        ymap.set('period', c.period)
        ymap.set('weather', c.weather ?? '')
        ymap.set('running', c.running)
        ymap.set('timeScale', c.timeScale)
      }, 'local')
    }
    else {
      _fromRemote = true
      applyClockFromYMap(ymap, store)
      _fromRemote = false
    }

    // 2. Yjs → Store
    const observer = (_events: Y.YMapEvent<any>, txn: Y.Transaction) => {
      if (txn.origin === 'local' || _fromLocal)
        return
      _fromRemote = true
      try {
        applyClockFromYMap(ymap, store)
      }
      finally {
        _fromRemote = false
      }
    }
    ymap.observe(observer)
    _cleanups.push(() => ymap.unobserve(observer))

    // 3. Store → Yjs
    const stopWatch = watch(
      () => store.clock,
      (clock) => {
        if (_fromRemote || !isActive.value)
          return
        _fromLocal = true
        try {
          ymap.doc!.transact(() => {
            if (ymap.get('date') !== clock.date)
              ymap.set('date', clock.date)
            if (ymap.get('period') !== clock.period)
              ymap.set('period', clock.period)
            if (ymap.get('weather') !== (clock.weather ?? ''))
              ymap.set('weather', clock.weather ?? '')
            if (ymap.get('running') !== clock.running)
              ymap.set('running', clock.running)
            if (ymap.get('timeScale') !== clock.timeScale)
              ymap.set('timeScale', clock.timeScale)
          }, 'local')
        }
        finally {
          _fromLocal = false
        }
      },
      { deep: true },
    )
    _cleanups.push(stopWatch)
  }

  function applyClockFromYMap(
    ymap: Y.Map<any>,
    store: ReturnType<typeof useWorldClockStore>,
  ) {
    const clock = store.clock
    const date = ymap.get('date') as string | undefined
    const period = ymap.get('period') as WorldClockState['period'] | undefined
    const weather = ymap.get('weather') as string | undefined
    const running = ymap.get('running') as boolean | undefined
    const timeScale = ymap.get('timeScale') as number | undefined

    if (date && date !== clock.date)
      clock.date = date
    if (period && period !== clock.period)
      clock.period = period
    if (weather !== undefined)
      clock.weather = weather || undefined
    if (running !== undefined && running !== clock.running) {
      if (running)
        store.start()
      else
        store.pause()
    }
    if (timeScale && timeScale !== clock.timeScale)
      clock.timeScale = timeScale
  }

  return {
    isActive,
    startSync,
    stopSync,
  }
}
