import type { AdvGameConfig, RuntimeState } from '@advjs/types'
import { describe, expect, it } from 'vitest'
import { createBrowserExtrasController } from '../../../packages/client/runtime/extras'

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()][index] ?? null,
    removeItem: key => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  }
}

const game: Pick<AdvGameConfig, 'title' | 'progression' | 'gallery' | 'endings' | 'achievements'> = {
  title: 'Hamster',
  progression: { id: 'hamster', keys: ['unlockedEndings', 'unlockedAchievements'] },
  endings: { items: [{ id: 'true-end', title: 'True' }, { id: 'bad-end', title: 'Bad' }] },
  achievements: { key: 'trophies', items: [{ id: 'first', title: 'First' }] },
}

function state(patch: Partial<RuntimeState> = {}): RuntimeState {
  return {
    status: 'playing',
    cursor: { chapterId: 'one', nodeId: 'node-1' },
    variables: {},
    stage: { background: '', audio: { bgm: null, ambience: {} }, cg: '', tachies: {} },
    choices: [],
    visited: [],
    ...patch,
  }
}

describe('browser extras record', () => {
  it('records route nodes, heard BGM and declared unlocks, reporting each only once', () => {
    const storage = memoryStorage()
    const extras = createBrowserExtrasController(game, { storage })
    const routeNodes = new Set(['one#opening', 'two#hall'])

    expect(extras.storageKey).toBe('advjs:extras:hamster:v1')
    expect(extras.capture(state({
      visited: ['one#opening', 'one#node-1'],
      stage: { background: '', audio: { bgm: { assetId: 'bgm/day' }, ambience: {} }, cg: '', tachies: {} },
      variables: { unlockedEndings: ['bad-end', 'unknown'], trophies: ['first'] },
    }), routeNodes)).toEqual({ endings: ['bad-end'], achievements: ['first'] })
    expect(extras.capture(state({ variables: { unlockedEndings: ['bad-end', 'true-end'], trophies: ['first'] } }), routeNodes))
      .toEqual({ endings: ['true-end'], achievements: [] })

    const reloaded = createBrowserExtrasController(game, { storage })
    expect(reloaded.visited.value).toEqual(['one#opening'])
    expect(reloaded.heard.value).toEqual(['bgm/day'])
    expect(reloaded.endings.value).toEqual(['bad-end', 'true-end'])
    expect(reloaded.achievements.value).toEqual(['first'])
  })

  it('keeps unlocks after loading an older save whose variables predate them', () => {
    const extras = createBrowserExtrasController(game, { storage: memoryStorage() })
    extras.capture(state({ variables: { unlockedEndings: ['true-end'] } }))
    expect(extras.capture(state({ variables: { unlockedEndings: [] } }))).toEqual({ endings: [], achievements: [] })
    expect(extras.endings.value).toEqual(['true-end'])
  })

  it('ignores malformed storage and clears only its own record', () => {
    const storage = memoryStorage()
    storage.setItem('advjs:extras:hamster:v1', JSON.stringify({ schemaVersion: 1, visited: ['one#opening', 3], heard: 'bgm/day' }))
    storage.setItem('advjs:gallery:hamster:v1', '{}')
    const extras = createBrowserExtrasController(game, { storage })

    expect(extras.visited.value).toEqual(['one#opening'])
    expect(extras.heard.value).toEqual([])
    extras.clear()
    expect(extras.visited.value).toEqual([])
    expect(storage.getItem('advjs:extras:hamster:v1')).toBeNull()
    expect(storage.getItem('advjs:gallery:hamster:v1')).toBe('{}')
  })

  it('falls back to the gallery id or title for its namespace', () => {
    expect(createBrowserExtrasController({ title: 'My game', gallery: { id: 'cg', items: [] } }, { storage: memoryStorage() }).storageKey)
      .toBe('advjs:extras:cg:v1')
    expect(createBrowserExtrasController({ title: 'My game' }, { storage: memoryStorage() }).storageKey)
      .toBe('advjs:extras:My%20game:v1')
  })
})
