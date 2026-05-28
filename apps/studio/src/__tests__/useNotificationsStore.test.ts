import type { NotificationRecord } from '../stores/useNotificationsStore'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useNotificationsStore } from '../stores/useNotificationsStore'

// Stub auth store so the notifications store can resolve the recipient uid.
vi.mock('../stores/useAuthStore', () => ({
  useAuthStore: () => ({
    userInfo: { uid: 'me' },
  }),
}))

// Telemetry is a side-effect we don't care about here.
vi.mock('../utils/telemetry', () => ({
  track: vi.fn(),
}))

function makeNotification(overrides: Partial<NotificationRecord> = {}): NotificationRecord {
  return {
    _id: overrides._id ?? `n-${Math.random().toString(36).slice(2, 8)}`,
    recipientId: 'me',
    type: 'new_project',
    payload: {},
    read: false,
    createdAt: Date.now(),
    ...overrides,
  }
}

/**
 * Build a minimal CloudBase app stub that records every database call so we
 * can assert side-effects without a network round-trip.
 *
 * The Pinia store only consumes `cloudApp.database().collection(name).doc(id).update({...})`
 * and `collection(name).where(...).orderBy(...).limit(...).get()` — we mirror just
 * that surface.
 */
function makeStubCloudApp() {
  const updates: Array<{ id: string, patch: Record<string, unknown> }> = []
  const docFn = (id: string) => ({
    update: vi.fn(async (patch: Record<string, unknown>) => {
      updates.push({ id, patch })
      return { updated: 1 }
    }),
  })
  const collectionFn = vi.fn(() => ({
    doc: docFn,
    where: () => ({
      orderBy: () => ({
        limit: () => ({
          get: async () => ({ data: [] }),
        }),
      }),
    }),
  }))
  const app = {
    database: () => ({ collection: collectionFn }),
  }
  return { app: app as any, updates }
}

describe('useNotificationsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('unreadCount reflects the number of unread items', () => {
    const store = useNotificationsStore()
    store.notifications = [
      makeNotification({ _id: 'a', read: false }),
      makeNotification({ _id: 'b', read: true }),
      makeNotification({ _id: 'c', read: false }),
    ]
    expect(store.unreadCount).toBe(2)
  })

  it('markRead flips the local flag and posts a CloudBase update', async () => {
    const store = useNotificationsStore()
    store.notifications = [
      makeNotification({ _id: 'a', read: false }),
      makeNotification({ _id: 'b', read: false }),
    ]
    const { app, updates } = makeStubCloudApp()

    await store.markRead(app, 'a')

    expect(store.notifications[0].read).toBe(true)
    expect(store.notifications[1].read).toBe(false)
    expect(store.unreadCount).toBe(1)
    expect(updates).toEqual([{ id: 'a', patch: { read: true } }])
  })

  it('markRead is a no-op for an already-read notification', async () => {
    const store = useNotificationsStore()
    store.notifications = [makeNotification({ _id: 'a', read: true })]
    const { app, updates } = makeStubCloudApp()

    await store.markRead(app, 'a')
    expect(updates).toEqual([])
  })

  it('markRead is a no-op for an unknown id', async () => {
    const store = useNotificationsStore()
    store.notifications = [makeNotification({ _id: 'a', read: false })]
    const { app, updates } = makeStubCloudApp()

    await store.markRead(app, 'missing')
    expect(updates).toEqual([])
    expect(store.unreadCount).toBe(1)
  })

  it('markAllRead drains every unread entry and fires one update per item', async () => {
    const store = useNotificationsStore()
    store.notifications = [
      makeNotification({ _id: 'a', read: false }),
      makeNotification({ _id: 'b', read: true }),
      makeNotification({ _id: 'c', read: false }),
    ]
    const { app, updates } = makeStubCloudApp()

    await store.markAllRead(app)

    expect(store.unreadCount).toBe(0)
    expect(updates.map(u => u.id).sort()).toEqual(['a', 'c'])
  })

  it('rolls back the optimistic read flag if the CloudBase update throws', async () => {
    const store = useNotificationsStore()
    store.notifications = [makeNotification({ _id: 'a', read: false })]

    const failingApp = {
      database: () => ({
        collection: () => ({
          doc: () => ({
            update: async () => {
              throw new Error('boom')
            },
          }),
        }),
      }),
    } as any

    await store.markRead(failingApp, 'a')
    expect(store.notifications[0].read).toBe(false)
  })
})
