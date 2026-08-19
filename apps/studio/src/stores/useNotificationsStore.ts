import type cloudbase from '@cloudbase/js-sdk'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { track } from '../utils/telemetry'
import { useAuthStore } from './useAuthStore'

const COLLECTION_NOTIFICATIONS = 'advjs_notifications'

/**
 * Types currently emitted by the system.
 *
 * Extend this union when more notification kinds land. UI rendering switches
 * on `type` to pick the right icon + i18n key + click target.
 */
export type NotificationType = 'new_project' | 'follow_received'

export interface NotificationRecord {
  _id?: string
  /** Recipient CloudBase UID. */
  recipientId: string
  type: NotificationType
  /** Optional reference id (marketplace _id for new_project; follower uid for follow_received). */
  refId?: string
  /** Self-describing payload — redundant copy of names/covers to avoid joins. */
  payload: {
    actorName?: string
    actorId?: string
    projectName?: string
    cover?: string
    [k: string]: unknown
  }
  read: boolean
  createdAt: number
}

const POLL_INTERVAL_MS = 30_000
const LIST_LIMIT = 50

export const useNotificationsStore = defineStore('notifications', () => {
  const authStore = useAuthStore()

  const notifications = ref<NotificationRecord[]>([])
  const isLoading = ref(false)
  const lastFetchedAt = ref(0)

  const unreadCount = computed(() => notifications.value.filter(n => !n.read).length)

  let pollTimer: ReturnType<typeof setInterval> | null = null
  let pollCloudApp: cloudbase.app.App | null = null

  function getCollection(cloudApp: cloudbase.app.App) {
    return cloudApp.database().collection(COLLECTION_NOTIFICATIONS)
  }

  async function load(cloudApp: cloudbase.app.App): Promise<void> {
    const uid = authStore.userId
    if (!uid)
      return
    isLoading.value = true
    try {
      const result = await getCollection(cloudApp)
        .where({ recipientId: uid })
        .orderBy('createdAt', 'desc')
        .limit(LIST_LIMIT)
        .get()
      notifications.value = (result.data ?? []) as NotificationRecord[]
      lastFetchedAt.value = Date.now()
    }
    finally {
      isLoading.value = false
    }
  }

  async function markRead(cloudApp: cloudbase.app.App, id: string): Promise<void> {
    const target = notifications.value.find(n => n._id === id)
    if (!target || target.read)
      return
    target.read = true
    try {
      await getCollection(cloudApp).doc(id).update({ read: true })
      track('notification.read', { type: target.type })
    }
    catch {
      target.read = false
    }
  }

  async function markAllRead(cloudApp: cloudbase.app.App): Promise<void> {
    const uid = authStore.userId
    if (!uid)
      return
    const unread = notifications.value.filter(n => !n.read && n._id)
    if (unread.length === 0)
      return
    for (const n of unread)
      n.read = true
    try {
      // CloudBase JS SDK doesn't expose bulk update; iterate. Volume is bounded by LIST_LIMIT.
      await Promise.all(
        unread.map(n => getCollection(cloudApp).doc(n._id!).update({ read: true })),
      )
      track('notification.read', { type: 'bulk', count: unread.length })
    }
    catch {
      // Best effort — if any write fails, next poll will reconcile from server.
    }
  }

  /**
   * Begin a 30s polling loop. Idempotent: starting twice is a no-op.
   *
   * Stops automatically when the user logs out (next poll sees no uid and skips).
   * Pause / resume controlled by `stopPolling` for tests.
   */
  function startPolling(cloudApp: cloudbase.app.App): void {
    pollCloudApp = cloudApp
    if (pollTimer)
      return
    void load(cloudApp)
    pollTimer = setInterval(() => {
      if (authStore.userId && pollCloudApp)
        void load(pollCloudApp)
    }, POLL_INTERVAL_MS)
  }

  function stopPolling(): void {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    pollCloudApp = null
  }

  return {
    notifications,
    unreadCount,
    isLoading,
    lastFetchedAt,
    load,
    markRead,
    markAllRead,
    startPolling,
    stopPolling,
  }
})

/**
 * Insert notification records for an arbitrary list of recipients.
 *
 * Used by `useMarketplace.publishProject` to fan-out a `new_project` notice to
 * the author's followers. Volume is bounded at the caller (follower count cap),
 * so iterating `.add()` is acceptable for MVP scale.
 */
export async function createNotifications(
  cloudApp: cloudbase.app.App,
  recipientIds: string[],
  template: Omit<NotificationRecord, '_id' | 'recipientId' | 'read' | 'createdAt'>,
): Promise<void> {
  if (recipientIds.length === 0)
    return
  const now = Date.now()
  const collection = cloudApp.database().collection(COLLECTION_NOTIFICATIONS)
  await Promise.all(
    recipientIds.map(recipientId =>
      collection.add({
        ...template,
        recipientId,
        read: false,
        createdAt: now,
      }).catch(() => {
        // Don't fail the whole fan-out for a single recipient.
      }),
    ),
  )
}
