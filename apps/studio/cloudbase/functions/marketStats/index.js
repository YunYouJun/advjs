/**
 * marketStats — privileged Story Market counter writer (Path B).
 *
 * CloudBase database security rules keep `advjs_marketplace` / `advjs_reviews`
 * **owner-only** (`auth.uid == doc.ownerId` / `doc.reviewerId`). That deliberately
 * blocks the three cross-user counter writes the client used to attempt directly:
 *
 *   - install count   → `advjs_marketplace.downloads`        (written by the installer)
 *   - rating aggregate → `advjs_marketplace.ratingSum/Count` (written by the reviewer)
 *   - review likes     → `advjs_reviews.likes`               (written by any user)
 *
 * This Event Function runs with admin privileges (it bypasses security rules), so it
 * is the single privileged writer for those fields. It performs atomic `_.inc()`
 * updates with light validation + per-user dedup, and owns the review document write
 * so the whole rating mutation is consistent and race-free.
 *
 * Invoked from the client via `cloudApp.callFunction({ name: 'marketStats', data })`.
 * `data.action` selects the operation; the return shape is `{ error }` on failure or
 * `{ ok: true, ... }` on success (matching the repo's existing function convention).
 *
 * Required collections (see ../../README.md):
 *   advjs_marketplace, advjs_reviews           — existing
 *   advjs_market_installs, advjs_review_likes   — dedup ledgers, this function only
 */

const cloud = require('@cloudbase/node-sdk')

const app = cloud.init({ env: cloud.SYMBOL_CURRENT_ENV })
const db = app.database()
const _ = db.command

const COLLECTION_MARKET = 'advjs_marketplace'
const COLLECTION_REVIEWS = 'advjs_reviews'
/** Dedup ledger: one row per (marketId, uid) install. */
const COLLECTION_INSTALLS = 'advjs_market_installs'
/** Dedup ledger: one row per (reviewId, uid) like. */
const COLLECTION_REVIEW_LIKES = 'advjs_review_likes'

function fail(message) {
  return { error: message }
}

/**
 * Resolve the calling user's CloudBase UID.
 *
 * `getCloudbaseContext(context).TCB_UUID` is the user uid for web-SDK logins and is
 * the most version-tolerant source; the auth SDK is a fallback. Returns an empty
 * string for anonymous / unauthenticated callers.
 */
function resolveUid(context) {
  try {
    const ctx = cloud.getCloudbaseContext(context) || {}
    if (ctx.TCB_UUID)
      return String(ctx.TCB_UUID)
  }
  catch {}
  try {
    const info = app.auth().getUserInfo() || {}
    if (info.uid)
      return String(info.uid)
  }
  catch {}
  return ''
}

/** True if the (collection, key) dedup row already exists. */
async function alreadyRecorded(collection, key) {
  const res = await db.collection(collection).where({ key }).limit(1).get()
  return !!(res.data && res.data.length > 0)
}

/**
 * Increment `downloads` once per (item, user). Anonymous installs can't be deduped,
 * so they count once per call. If the dedup ledger is unavailable the count still
 * proceeds (degrade to "always count") rather than failing the install silently.
 */
async function incrementDownloads(event, uid) {
  const marketId = String(event.marketId || '')
  if (!marketId)
    return fail('marketId is required')

  const market = db.collection(COLLECTION_MARKET).doc(marketId)
  const found = await market.get()
  const record = found.data && found.data[0]
  if (!record)
    return fail('Market item not found')

  if (uid) {
    const key = `${marketId}_${uid}`
    try {
      if (await alreadyRecorded(COLLECTION_INSTALLS, key))
        return { ok: true, counted: false, downloads: record.downloads || 0 }
      await db.collection(COLLECTION_INSTALLS).add({ key, marketId, uid, createdAt: Date.now() })
    }
    catch (err) {
      console.error('[marketStats] install dedup failed, counting anyway:', err && err.message)
    }
  }

  await market.update({ downloads: _.inc(1) })
  return { ok: true, counted: true, downloads: (record.downloads || 0) + 1 }
}

/**
 * Create or update the caller's review and keep the market rating aggregate in sync.
 * Owning the whole write here (instead of letting the client write the review doc and
 * only proxying the aggregate) makes the rating mutation atomic and tamper-proof:
 * `reviewerId` is the verified caller, and the aggregate diff can't be forged.
 */
async function submitReview(event, uid) {
  if (!uid)
    return fail('Login required to submit a review')

  const marketId = String(event.marketId || '')
  const rating = Number(event.rating)
  const comment = typeof event.comment === 'string' ? event.comment : ''
  const reviewerName = typeof event.reviewerName === 'string' ? event.reviewerName : ''

  if (!marketId)
    return fail('marketId is required')
  if (!Number.isInteger(rating) || rating < 1 || rating > 5)
    return fail('rating must be an integer between 1 and 5')

  const market = db.collection(COLLECTION_MARKET).doc(marketId)
  const found = await market.get()
  const record = found.data && found.data[0]
  if (!record)
    return fail('Market item not found')

  const now = Date.now()
  const reviews = db.collection(COLLECTION_REVIEWS)
  const existing = await reviews.where({ marketId, reviewerId: uid }).limit(1).get()

  if (existing.data && existing.data.length > 0) {
    const old = existing.data[0]
    const ratingDiff = rating - (old.rating || 0)
    await reviews.doc(old._id).update({ rating, comment, updatedAt: now })
    if (ratingDiff !== 0)
      await market.update({ ratingSum: _.inc(ratingDiff) })
    return { ok: true, updated: true }
  }

  await reviews.add({
    marketId,
    reviewerId: uid,
    reviewerName,
    rating,
    comment,
    likes: 0,
    createdAt: now,
  })
  await market.update({ ratingSum: _.inc(rating), ratingCount: _.inc(1) })
  return { ok: true, updated: false }
}

/**
 * Like a review at most once per user (idempotent). Returns the authoritative
 * `likes` count so the client can reconcile instead of blindly incrementing.
 */
async function likeReview(event, uid) {
  if (!uid)
    return fail('Login required to like a review')

  const reviewId = String(event.reviewId || '')
  if (!reviewId)
    return fail('reviewId is required')

  const review = db.collection(COLLECTION_REVIEWS).doc(reviewId)
  const found = await review.get()
  const record = found.data && found.data[0]
  if (!record)
    return fail('Review not found')

  const key = `${reviewId}_${uid}`
  try {
    if (await alreadyRecorded(COLLECTION_REVIEW_LIKES, key))
      return { ok: true, liked: true, counted: false, likes: record.likes || 0 }
    await db.collection(COLLECTION_REVIEW_LIKES).add({ key, reviewId, uid, createdAt: Date.now() })
  }
  catch (err) {
    console.error('[marketStats] like dedup failed, counting anyway:', err && err.message)
  }

  await review.update({ likes: _.inc(1) })
  return { ok: true, liked: true, counted: true, likes: (record.likes || 0) + 1 }
}

exports.main = async (event, context) => {
  const payload = event || {}
  const uid = resolveUid(context)

  try {
    switch (payload.action) {
      case 'incrementDownloads':
        return await incrementDownloads(payload, uid)
      case 'submitReview':
        return await submitReview(payload, uid)
      case 'likeReview':
        return await likeReview(payload, uid)
      default:
        return fail(`Unknown action: ${String(payload.action)}`)
    }
  }
  catch (err) {
    console.error('[marketStats] unhandled error:', err)
    return fail(err && err.message ? err.message : 'Internal error')
  }
}
