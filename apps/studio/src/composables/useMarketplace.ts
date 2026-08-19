import type cloudbase from '@cloudbase/js-sdk'
import type { StudioProject } from '../stores/useStudioStore'
import type { MarketDuration, MarketGenre, MarketStyle } from '../utils/marketTaxonomy'
import { ref } from 'vue'
import { useAuthStore } from '../stores/useAuthStore'
import { createNotifications } from '../stores/useNotificationsStore'
import { track } from '../utils/telemetry'
import { useFollow } from './useFollow'

/**
 * CloudBase collection names for the marketplace.
 */
const COLLECTION_MARKET = 'advjs_marketplace'
const COLLECTION_REVIEWS = 'advjs_reviews'

export type MarketStatus = 'draft' | 'published' | 'unlisted'
export type SortMode = 'newest' | 'popular' | 'rating'
export type ReportReason = 'spam' | 'abuse' | 'copyright' | 'other'

export interface MarketplaceRecord {
  _id?: string
  /** Local projectId (slug) */
  projectId: string
  /** CloudBase user UID (publisher) */
  ownerId: string
  /** Author display name */
  authorName: string
  /** Project display name */
  name: string
  description?: string
  cover?: string
  tags: string[]
  /** COS key for the .advpkg.zip package */
  packageKey?: string
  /** Package size in bytes */
  packageSize?: number
  /** Marketplace status */
  status: MarketStatus
  /** Template ID used to generate this project (for category filtering) */
  templateId?: string
  /** Curation taxonomy — theme/genre (Phase 18) */
  genre?: MarketGenre
  /** Curation taxonomy — narrative style (Phase 18) */
  style?: MarketStyle
  /** Curation taxonomy — length bucket, defaults derived from chapter count */
  duration?: MarketDuration
  /** Featured flag (admin-set) */
  featured?: boolean
  /** Stats snapshot */
  stats: {
    chapters: number
    characters: number
    scenes: number
  }
  /** Aggregated review data */
  downloads: number
  ratingSum: number
  ratingCount: number
  /** Semantic version */
  version: string
  createdAt: number
  updatedAt: number
}

export interface ReviewRecord {
  _id?: string
  /** marketplace record _id */
  marketId: string
  /** Reviewer UID */
  reviewerId: string
  reviewerName: string
  /** 1-5 star rating */
  rating: number
  /** Review text */
  comment: string
  /** Likes count */
  likes: number
  createdAt: number
  /** Last edit time (set by the `marketStats` function when a review is updated) */
  updatedAt?: number
  /** One-level project-author reply (Phase 18 MVP). */
  authorReply?: {
    authorId: string
    authorName: string
    comment: string
    createdAt: number
  }
}

/**
 * Composable for Story Market operations.
 *
 * Handles publishing, browsing, installing, and reviewing marketplace items.
 * Data is stored in CloudBase database collections.
 */
export function useMarketplace() {
  const authStore = useAuthStore()
  const { listFollowers } = useFollow()
  const isBusy = ref(false)
  const error = ref<string | null>(null)

  function getDb(cloudApp: cloudbase.app.App) {
    return cloudApp.database()
  }

  /** Shape returned by the `marketStats` cloud function. */
  interface MarketStatsResult {
    error?: string
    ok?: boolean
    counted?: boolean
    downloads?: number
    likes?: number
    liked?: boolean
    updated?: boolean
  }

  /**
   * Call the privileged `marketStats` cloud function. It runs with admin
   * privileges and is the *only* writer allowed past the owner-only security
   * rules for the cross-user counters (downloads / rating aggregate / review
   * likes). See `cloudbase/README.md` → 「跨用户计数写入」.
   */
  async function callMarketStats(
    cloudApp: cloudbase.app.App,
    data: Record<string, unknown>,
  ): Promise<MarketStatsResult> {
    const res = await cloudApp.callFunction({ name: 'marketStats', data })
    return (res.result || {}) as MarketStatsResult
  }

  /**
   * After a first-time publish, notify each follower with a `new_project`
   * entry in `advjs_notifications`. Best-effort; bounded by the 500-follower
   * cap in `useFollow.listFollowers`.
   */
  async function fanOutNewProject(
    cloudApp: cloudbase.app.App,
    authorId: string,
    marketDocId: string,
    record: Omit<MarketplaceRecord, '_id'>,
  ): Promise<void> {
    const followers = await listFollowers(cloudApp, authorId)
    const recipientIds = followers.map(f => f.followerId).filter(Boolean)
    if (recipientIds.length === 0)
      return
    await createNotifications(cloudApp, recipientIds, {
      type: 'new_project',
      refId: marketDocId,
      payload: {
        actorId: authorId,
        actorName: record.authorName,
        projectName: record.name,
        cover: record.cover,
      },
    })
  }

  /**
   * Publish a project to the marketplace.
   */
  async function publishProject(
    cloudApp: cloudbase.app.App,
    project: StudioProject,
    options: {
      tags: string[]
      stats: MarketplaceRecord['stats']
      version?: string
      packageKey?: string
      packageSize?: number
      genre?: MarketGenre
      style?: MarketStyle
      duration?: MarketDuration
    },
  ): Promise<string | null> {
    const uid = authStore.userId
    if (!uid) {
      error.value = 'Not logged in'
      return null
    }

    isBusy.value = true
    error.value = null

    try {
      const db = getDb(cloudApp)
      const collection = db.collection(COLLECTION_MARKET)
      const now = Date.now()

      // Check if already published by this user
      const existing = await collection
        .where({ projectId: project.projectId, ownerId: uid })
        .get()

      const record: Omit<MarketplaceRecord, '_id'> = {
        projectId: project.projectId,
        ownerId: uid,
        authorName: authStore.displayName,
        name: project.name,
        description: project.description,
        cover: project.cover,
        tags: options.tags,
        // Only persist taxonomy keys that are set — CloudBase rejects `undefined`.
        ...(options.genre ? { genre: options.genre } : {}),
        ...(options.style ? { style: options.style } : {}),
        ...(options.duration ? { duration: options.duration } : {}),
        packageKey: options.packageKey,
        packageSize: options.packageSize,
        status: 'published',
        stats: options.stats,
        downloads: (existing.data?.[0] as MarketplaceRecord)?.downloads || 0,
        ratingSum: (existing.data?.[0] as MarketplaceRecord)?.ratingSum || 0,
        ratingCount: (existing.data?.[0] as MarketplaceRecord)?.ratingCount || 0,
        version: options.version || '1.0.0',
        createdAt: (existing.data?.[0] as MarketplaceRecord)?.createdAt || now,
        updatedAt: now,
      }

      let docId: string
      let firstPublish = false
      if (existing.data && existing.data.length > 0) {
        docId = (existing.data[0] as MarketplaceRecord)._id!
        await collection.doc(docId).update(record)
        track('project_published', { projectId: project.projectId, version: record.version, tags: options.tags, genre: options.genre, style: options.style })
      }
      else {
        const result = await collection.add(record)
        docId = result.id as string
        firstPublish = true
        track('project_published', { projectId: project.projectId, version: record.version, tags: options.tags, genre: options.genre, style: options.style, firstTime: true })
      }

      // Fan-out a `new_project` notification to all followers on first publish
      // only — bumping a version shouldn't spam everyone again.
      if (firstPublish) {
        await fanOutNewProject(cloudApp, uid, docId, record).catch(() => {
          // Notification fan-out is best-effort; don't fail the publish.
        })
      }
      return docId
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      return null
    }
    finally {
      isBusy.value = false
    }
  }

  /**
   * Browse marketplace items with search, tag filter, and sort.
   */
  async function browseMarket(
    cloudApp: cloudbase.app.App,
    options?: {
      search?: string
      tag?: string
      genre?: MarketGenre
      style?: MarketStyle
      duration?: MarketDuration
      sort?: SortMode
      limit?: number
      offset?: number
    },
  ): Promise<MarketplaceRecord[]> {
    isBusy.value = true
    error.value = null

    try {
      const db = getDb(cloudApp)

      // Compose an equality filter from the structured dimensions. CloudBase
      // ANDs the fields in a single `where()` object; `tags: value` matches
      // membership in the array field.
      const condition: Record<string, unknown> = { status: 'published' }
      if (options?.tag)
        condition.tags = options.tag
      if (options?.genre)
        condition.genre = options.genre
      if (options?.style)
        condition.style = options.style
      if (options?.duration)
        condition.duration = options.duration

      let query = db.collection(COLLECTION_MARKET).where(condition)

      // Sort
      const sortField = options?.sort === 'popular'
        ? 'downloads'
        : options?.sort === 'rating'
          ? 'ratingSum'
          : 'updatedAt'
      query = query.orderBy(sortField, 'desc')

      if (options?.offset)
        query = query.skip(options.offset)

      query = query.limit(options?.limit || 20)

      const result = await query.get()
      let items = (result.data || []) as MarketplaceRecord[]

      // Client-side search filter (CloudBase doesn't support full-text search natively)
      if (options?.search) {
        const q = options.search.toLowerCase()
        items = items.filter(i =>
          i.name.toLowerCase().includes(q)
          || (i.description || '').toLowerCase().includes(q)
          || i.authorName.toLowerCase().includes(q),
        )
      }

      return items
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      return []
    }
    finally {
      isBusy.value = false
    }
  }

  /**
   * Get a single marketplace record by ID.
   */
  async function getMarketItem(
    cloudApp: cloudbase.app.App,
    marketId: string,
  ): Promise<MarketplaceRecord | null> {
    try {
      const db = getDb(cloudApp)
      const result = await db.collection(COLLECTION_MARKET).doc(marketId).get()
      return (result.data?.[0] || null) as MarketplaceRecord | null
    }
    catch {
      return null
    }
  }

  /**
   * Increment download count when a user installs a project.
   */
  async function incrementDownloads(
    cloudApp: cloudbase.app.App,
    marketId: string,
  ): Promise<void> {
    try {
      // Cross-user write: the installer is not the owner, so the owner-only
      // rule rejects a direct write. Route through the privileged function,
      // which also dedups to count at most once per (item, user).
      await callMarketStats(cloudApp, { action: 'incrementDownloads', marketId })
    }
    catch {
      // non-critical
    }
  }

  /**
   * Fetch published projects by a specific user (for creator profile).
   */
  async function fetchCreatorProjects(
    cloudApp: cloudbase.app.App,
    ownerId: string,
  ): Promise<MarketplaceRecord[]> {
    try {
      const db = getDb(cloudApp)
      const result = await db.collection(COLLECTION_MARKET)
        .where({ ownerId, status: 'published' })
        .orderBy('updatedAt', 'desc')
        .limit(50)
        .get()
      return (result.data || []) as MarketplaceRecord[]
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      return []
    }
  }

  // ── Reviews ──

  /**
   * Submit a review for a marketplace item.
   */
  async function submitReview(
    cloudApp: cloudbase.app.App,
    marketId: string,
    rating: number,
    comment: string,
  ): Promise<boolean> {
    const uid = authStore.userId
    if (!uid)
      return false

    isBusy.value = true
    error.value = null

    try {
      // The function owns the review-doc write *and* the market rating
      // aggregate, so the whole mutation is atomic and the aggregate diff
      // can't be forged. The reviewer's review doc itself is owner-writable,
      // but the cross-user aggregate on the market record is not.
      const data = await callMarketStats(cloudApp, {
        action: 'submitReview',
        marketId,
        rating,
        comment,
        reviewerName: authStore.displayName,
      })
      if (data.error) {
        error.value = data.error
        return false
      }
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

  /**
   * Fetch reviews for a marketplace item.
   */
  async function fetchReviews(
    cloudApp: cloudbase.app.App,
    marketId: string,
    limit = 20,
  ): Promise<ReviewRecord[]> {
    try {
      const db = getDb(cloudApp)
      const result = await db.collection(COLLECTION_REVIEWS)
        .where({ marketId })
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get()
      return (result.data || []) as ReviewRecord[]
    }
    catch {
      return []
    }
  }

  /**
   * Like a review (idempotent — at most once per user). Routed through the
   * privileged function since likes are a cross-user write blocked by the
   * owner-only rule. Returns the authoritative new like count, or `null` if the
   * like was rejected/failed, so the caller can reconcile instead of blindly +1.
   */
  async function likeReview(
    cloudApp: cloudbase.app.App,
    reviewId: string,
  ): Promise<number | null> {
    try {
      const data = await callMarketStats(cloudApp, { action: 'likeReview', reviewId })
      if (data.error || typeof data.likes !== 'number')
        return null
      return data.likes
    }
    catch {
      return null
    }
  }

  /** Create or replace the project author's one-level reply to a review. */
  async function replyToReview(
    cloudApp: cloudbase.app.App,
    reviewId: string,
    comment: string,
  ): Promise<boolean> {
    try {
      const data = await callMarketStats(cloudApp, { action: 'replyReview', reviewId, comment })
      if (data.error) {
        error.value = data.error
        return false
      }
      return true
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      return false
    }
  }

  /** Submit one pending report per user and project. */
  async function reportProject(
    cloudApp: cloudbase.app.App,
    marketId: string,
    reason: ReportReason,
    details = '',
  ): Promise<boolean> {
    try {
      const data = await callMarketStats(cloudApp, { action: 'reportProject', marketId, reason, details })
      if (data.error) {
        error.value = data.error
        return false
      }
      return true
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      return false
    }
  }

  /**
   * Toggle the `featured` curation flag on a marketplace item (Phase 18).
   *
   * Manual curation MVP: gated in the UI to the record owner. A future
   * moderation role can reuse the same write path via a cloud function.
   */
  async function setFeatured(
    cloudApp: cloudbase.app.App,
    marketId: string,
    featured: boolean,
  ): Promise<boolean> {
    try {
      const db = getDb(cloudApp)
      await db.collection(COLLECTION_MARKET)
        .doc(marketId)
        .update({ featured, updatedAt: Date.now() })
      return true
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      return false
    }
  }

  /**
   * Unlist (unpublish) a marketplace item.
   */
  async function unlistProject(
    cloudApp: cloudbase.app.App,
    marketId: string,
  ): Promise<boolean> {
    try {
      const db = getDb(cloudApp)
      await db.collection(COLLECTION_MARKET)
        .doc(marketId)
        .update({ status: 'unlisted', updatedAt: Date.now() })
      return true
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      return false
    }
  }

  return {
    isBusy,
    error,
    publishProject,
    browseMarket,
    getMarketItem,
    incrementDownloads,
    fetchCreatorProjects,
    submitReview,
    fetchReviews,
    likeReview,
    replyToReview,
    reportProject,
    setFeatured,
    unlistProject,
  }
}
