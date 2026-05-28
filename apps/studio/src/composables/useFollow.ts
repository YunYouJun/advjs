import type cloudbase from '@cloudbase/js-sdk'
import { ref } from 'vue'
import { useAuthStore } from '../stores/useAuthStore'
import { track } from '../utils/telemetry'

const COLLECTION_FOLLOWS = 'advjs_follows'

export interface FollowRecord {
  _id?: string
  /** CloudBase UID of the user doing the following. */
  followerId: string
  /** CloudBase UID of the user being followed. */
  followeeId: string
  /** Snapshot of the follower's display name at follow time (avoids join for notification fan-out). */
  followerName?: string
  createdAt: number
}

/**
 * Compose follow / unfollow operations against CloudBase `advjs_follows`.
 *
 * Schema:
 * - Composite logical key: `(followerId, followeeId)` — self-follow rejected.
 * - No server-side cardinality enforcement; client checks existing record before insert.
 *
 * For fan-out (notifications), `listFollowers(followeeId)` returns the UID
 * array of all subscribers — call right after `publishProject` to seed
 * `advjs_notifications` records.
 */
export function useFollow() {
  const authStore = useAuthStore()
  const isBusy = ref(false)
  const error = ref<string | null>(null)

  function getCollection(cloudApp: cloudbase.app.App) {
    return cloudApp.database().collection(COLLECTION_FOLLOWS)
  }

  async function follow(cloudApp: cloudbase.app.App, followeeId: string): Promise<boolean> {
    const followerId = authStore.userInfo.uid
    if (!followerId || followerId === followeeId)
      return false

    isBusy.value = true
    error.value = null
    try {
      const collection = getCollection(cloudApp)
      // Idempotent: skip if already following.
      const existing = await collection
        .where({ followerId, followeeId })
        .limit(1)
        .get()
      if (existing.data && existing.data.length > 0)
        return true

      const record: Omit<FollowRecord, '_id'> = {
        followerId,
        followeeId,
        followerName: authStore.displayName,
        createdAt: Date.now(),
      }
      await collection.add(record)
      track('follow.created', { followeeId })
      return true
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      return false
    }
    finally {
      isBusy.value = false
    }
  }

  async function unfollow(cloudApp: cloudbase.app.App, followeeId: string): Promise<boolean> {
    const followerId = authStore.userInfo.uid
    if (!followerId)
      return false

    isBusy.value = true
    error.value = null
    try {
      const collection = getCollection(cloudApp)
      const existing = await collection
        .where({ followerId, followeeId })
        .limit(1)
        .get()
      const doc = existing.data?.[0] as FollowRecord | undefined
      if (!doc?._id)
        return true
      await collection.doc(doc._id).remove()
      track('follow.removed', { followeeId })
      return true
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      return false
    }
    finally {
      isBusy.value = false
    }
  }

  async function isFollowing(cloudApp: cloudbase.app.App, followeeId: string): Promise<boolean> {
    const followerId = authStore.userInfo.uid
    if (!followerId)
      return false
    try {
      const result = await getCollection(cloudApp)
        .where({ followerId, followeeId })
        .limit(1)
        .get()
      return (result.data?.length ?? 0) > 0
    }
    catch {
      return false
    }
  }

  /**
   * Return the UIDs of users following `followeeId`. Used for notification fan-out.
   */
  async function listFollowers(cloudApp: cloudbase.app.App, followeeId: string): Promise<FollowRecord[]> {
    try {
      const result = await getCollection(cloudApp)
        .where({ followeeId })
        .limit(500)
        .get()
      return (result.data ?? []) as FollowRecord[]
    }
    catch {
      return []
    }
  }

  async function countFollowers(cloudApp: cloudbase.app.App, followeeId: string): Promise<number> {
    try {
      const result = await getCollection(cloudApp).where({ followeeId }).count()
      return (result as { total?: number }).total ?? 0
    }
    catch {
      return 0
    }
  }

  async function countFollowing(cloudApp: cloudbase.app.App, followerId: string): Promise<number> {
    try {
      const result = await getCollection(cloudApp).where({ followerId }).count()
      return (result as { total?: number }).total ?? 0
    }
    catch {
      return 0
    }
  }

  return {
    isBusy,
    error,
    follow,
    unfollow,
    isFollowing,
    listFollowers,
    countFollowers,
    countFollowing,
  }
}
