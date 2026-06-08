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
    const uid = authStore.userInfo.uid
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
      const db = getDb(cloudApp)
      const _ = db.command
      await db.collection(COLLECTION_MARKET)
        .doc(marketId)
        .update({ downloads: _.inc(1) })
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
    const uid = authStore.userInfo.uid
    if (!uid)
      return false

    isBusy.value = true
    error.value = null

    try {
      const db = getDb(cloudApp)
      const _ = db.command

      // Check if already reviewed
      const existing = await db.collection(COLLECTION_REVIEWS)
        .where({ marketId, reviewerId: uid })
        .get()

      if (existing.data && existing.data.length > 0) {
        // Update existing review
        const oldReview = existing.data[0] as ReviewRecord
        const ratingDiff = rating - oldReview.rating
        await db.collection(COLLECTION_REVIEWS)
          .doc(oldReview._id!)
          .update({ rating, comment, createdAt: Date.now() })

        // Update aggregate on marketplace record
        await db.collection(COLLECTION_MARKET)
          .doc(marketId)
          .update({ ratingSum: _.inc(ratingDiff) })
      }
      else {
        // Create new review
        await db.collection(COLLECTION_REVIEWS).add({
          marketId,
          reviewerId: uid,
          reviewerName: authStore.displayName,
          rating,
          comment,
          likes: 0,
          createdAt: Date.now(),
        })

        // Update aggregate
        await db.collection(COLLECTION_MARKET)
          .doc(marketId)
          .update({
            ratingSum: _.inc(rating),
            ratingCount: _.inc(1),
          })
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
   * Like a review (increment likes).
   */
  async function likeReview(
    cloudApp: cloudbase.app.App,
    reviewId: string,
  ): Promise<void> {
    try {
      const db = getDb(cloudApp)
      const _ = db.command
      await db.collection(COLLECTION_REVIEWS)
        .doc(reviewId)
        .update({ likes: _.inc(1) })
    }
    catch {
      // non-critical
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
    setFeatured,
    unlistProject,
  }
}
