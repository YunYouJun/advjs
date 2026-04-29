import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'

/**
 * Unit tests for the Yjs <-> Store bridging logic used in useCollabSync.
 *
 * These tests verify the core synchronisation primitives (Y.Map / Y.Array)
 * without involving Pinia stores or Vue reactivity, keeping them fast & pure.
 */

// --- Y.Map bidirectional sync helpers ---

describe('y.Map bidirectional sync', () => {
  it('seed Y.Map from local data when Y.Map is empty', () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap<Record<string, unknown>>('state:characterStates')

    // Simulate seeding from local store
    const localStates = new Map<string, { location: string, lastUpdated: string }>([
      ['char1', { location: 'forest', lastUpdated: '2025-01-01' }],
      ['char2', { location: 'castle', lastUpdated: '2025-01-02' }],
    ])

    doc.transact(() => {
      for (const [id, state] of localStates.entries()) {
        ymap.set(id, { ...state })
      }
    }, 'local')

    expect(ymap.size).toBe(2)
    expect(ymap.get('char1')).toEqual({ location: 'forest', lastUpdated: '2025-01-01' })
    expect(ymap.get('char2')).toEqual({ location: 'castle', lastUpdated: '2025-01-02' })
  })

  it('observe remote changes on Y.Map', () => {
    const doc1 = new Y.Doc()
    const doc2 = new Y.Doc()
    const ymap1 = doc1.getMap<Record<string, unknown>>('test')
    const ymap2 = doc2.getMap<Record<string, unknown>>('test')

    // Simulate initial sync
    Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1))
    Y.applyUpdate(doc1, Y.encodeStateAsUpdate(doc2))

    const observed: string[] = []
    ymap2.observe((event) => {
      for (const [key] of event.keys)
        observed.push(key)
    })

    // doc1 makes a change
    doc1.transact(() => {
      ymap1.set('hello', { value: 'world' })
    })

    // Sync to doc2
    Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1))

    expect(observed).toContain('hello')
    expect(ymap2.get('hello')).toEqual({ value: 'world' })
  })

  it('transaction origin is preserved for anti-echo', () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap('test')

    const origins: Array<string | null> = []
    ymap.observe((_event, txn) => {
      origins.push(txn.origin as string | null)
    })

    doc.transact(() => {
      ymap.set('a', 1)
    }, 'local')
    doc.transact(() => {
      ymap.set('b', 2)
    }, 'remote')
    doc.transact(() => {
      ymap.set('c', 3)
    })

    expect(origins).toEqual(['local', 'remote', null])
  })
})

// --- Y.Array append-only sync ---

describe('y.Array append-only sync', () => {
  it('seed Y.Array from local messages', () => {
    const doc = new Y.Doc()
    const yarray = doc.getArray<Record<string, unknown>>('state:chatMessages')

    const localMessages = [
      { role: 'user', content: 'hello', timestamp: 1000 },
      { role: 'assistant', content: 'hi there', timestamp: 1001 },
    ]

    doc.transact(() => {
      for (const msg of localMessages)
        yarray.push([msg])
    }, 'local')

    expect(yarray.length).toBe(2)
    expect(yarray.get(0)).toEqual(localMessages[0])
    expect(yarray.get(1)).toEqual(localMessages[1])
  })

  it('observe new items appended to Y.Array', () => {
    const doc1 = new Y.Doc()
    const doc2 = new Y.Doc()
    const ya1 = doc1.getArray<Record<string, unknown>>('messages')
    const ya2 = doc2.getArray<Record<string, unknown>>('messages')

    Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1))

    const insertedItems: unknown[] = []
    ya2.observe((event) => {
      event.changes.added.forEach((item) => {
        if (item.content.getContent)
          insertedItems.push(...item.content.getContent())
      })
    })

    doc1.transact(() => {
      ya1.push([{ role: 'user', content: 'new msg', timestamp: 2000 }])
    })

    Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1))

    expect(insertedItems.length).toBe(1)
    expect((insertedItems[0] as any).content).toBe('new msg')
  })

  it('trim Y.Array preserves most recent messages', () => {
    const doc = new Y.Doc()
    const yarray = doc.getArray<Record<string, unknown>>('messages')
    const MAX = 5

    // Add 8 messages
    doc.transact(() => {
      for (let i = 0; i < 8; i++)
        yarray.push([{ role: 'user', content: `msg${i}`, timestamp: i }])
    }, 'local')

    expect(yarray.length).toBe(8)

    // Trim to MAX
    const excess = yarray.length - MAX
    doc.transact(() => {
      yarray.delete(0, excess)
    }, 'local')

    expect(yarray.length).toBe(MAX)
    expect((yarray.get(0) as any).content).toBe('msg3')
    expect((yarray.get(4) as any).content).toBe('msg7')
  })
})

// --- World clock Y.Map sync ---

describe('y.Map world clock sync', () => {
  it('flat key-value structure for clock state', () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap('state:worldClock')

    doc.transact(() => {
      ymap.set('date', '2025-06-15')
      ymap.set('period', 'afternoon')
      ymap.set('weather', 'sunny')
      ymap.set('running', false)
      ymap.set('timeScale', 300000)
    }, 'local')

    expect(ymap.get('date')).toBe('2025-06-15')
    expect(ymap.get('period')).toBe('afternoon')
    expect(ymap.get('weather')).toBe('sunny')
    expect(ymap.get('running')).toBe(false)
    expect(ymap.get('timeScale')).toBe(300000)
  })

  it('only changed fields trigger observer', () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap('clock')

    // Initial state
    doc.transact(() => {
      ymap.set('date', '2025-01-01')
      ymap.set('period', 'morning')
    }, 'local')

    const changedKeys: string[] = []
    ymap.observe((event) => {
      for (const [key] of event.keys)
        changedKeys.push(key)
    })

    // Only change period
    doc.transact(() => {
      ymap.set('period', 'afternoon')
    }, 'local')

    expect(changedKeys).toEqual(['period'])
  })
})

// --- Anti-echo guard logic ---

describe('anti-echo guard', () => {
  it('prevents feedback loop with origin check', () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap('test')

    const storeUpdates: string[] = []
    const ymapWrites: string[] = []

    // Simulate Yjs → Store bridge
    ymap.observe((_event, txn) => {
      if (txn.origin === 'local')
        return // Skip local writes → anti-echo
      storeUpdates.push('yjs→store')
    })

    // Local write (simulating Store → Yjs)
    doc.transact(() => {
      ymap.set('key', 'from-store')
      ymapWrites.push('store→yjs')
    }, 'local')

    // Remote write (simulating another client)
    doc.transact(() => {
      ymap.set('key2', 'from-remote')
    }, 'remote')

    expect(ymapWrites).toEqual(['store→yjs'])
    expect(storeUpdates).toEqual(['yjs→store']) // Only remote write triggers store update
  })
})
