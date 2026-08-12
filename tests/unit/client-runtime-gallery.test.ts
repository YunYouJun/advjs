import type { AdvGameGalleryConfig } from '@advjs/types'
import { describe, expect, it } from 'vitest'
import { createBrowserGalleryController } from '../../packages/client/runtime/gallery'

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

const gallery: AdvGameGalleryConfig = {
  id: 'hamster',
  version: 1,
  items: [
    { id: 'star-in-hand', title: '恒星在手', src: '/cg/star.webp' },
    { id: 'real-workstation', title: '现实工作站', src: '/cg/workstation.webp' },
  ],
}

describe('browser gallery controller', () => {
  it('persists stable ids without storing image payloads', () => {
    const storage = memoryStorage()
    const controller = createBrowserGalleryController(gallery, { storage })

    expect(controller.unlock('star-in-hand')).toBe(true)
    expect(controller.unlock('star-in-hand')).toBe(false)
    expect(controller.unlock('missing')).toBe(false)

    const stored = storage.getItem(controller.storageKey) ?? ''
    expect(stored).toContain('star-in-hand')
    expect(stored).not.toContain('/cg/star.webp')
    expect(createBrowserGalleryController(gallery, { storage }).unlocked.value).toEqual(['star-in-hand'])
  })

  it('filters stale ids and clears collection state', () => {
    const storage = memoryStorage()
    const key = 'advjs:gallery:hamster:v1'
    storage.setItem(key, JSON.stringify({ schemaVersion: 1, unlocked: ['missing', 'real-workstation'] }))
    const controller = createBrowserGalleryController(gallery, { storage })

    expect(controller.unlocked.value).toEqual(['real-workstation'])
    controller.clear()
    expect(controller.unlocked.value).toEqual([])
    expect(storage.getItem(key)).toBeNull()
  })
})
