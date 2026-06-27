import type cloudbase from '@cloudbase/js-sdk'
import type { MarketplaceRecord } from '../composables/useMarketplace'

/**
 * Dev-only marketplace seeder.
 *
 * Inserts a handful of demo `advjs_marketplace` records owned by the current
 * user so the Story Market isn't empty on launch and browse / sort / filter /
 * featured / detail / reviews are all demoable. Seeded records:
 *
 * - have `ownerId === uid` so they pass the owner-only write security rule and
 *   double as an end-to-end check that publishing is actually allowed;
 * - use a `demo-` projectId prefix so {@link clearSeedMarketplace} can remove
 *   exactly this user's demo data;
 * - carry NO `packageKey`, so the detail modal's Install button stays disabled
 *   (there's no real `.advpkg.zip` in COS behind them).
 *
 * Counts (downloads / ratings) are written here by the owner at create time, so
 * they can be non-zero even though runtime cross-user increments are gated (see
 * apps/studio/cloudbase/README.md → "跨用户计数写入").
 */

const COLLECTION_MARKET = 'advjs_marketplace'
const SEED_PREFIX = 'demo-'

type SeedSpec = Pick<
  MarketplaceRecord,
  'name' | 'description' | 'tags' | 'genre' | 'style' | 'duration' | 'featured' | 'stats' | 'downloads' | 'ratingSum' | 'ratingCount'
> & { slug: string }

const SEED_SPECS: SeedSpec[] = [
  {
    slug: '001',
    name: '霓虹之城的最后一夜',
    description: '赛博都市，一名记忆掮客在霓虹熄灭前追查一桩失踪案。多结局悬疑。',
    tags: ['赛博朋克', '悬疑', '多结局'],
    genre: 'scifi',
    style: 'branching',
    duration: 'medium',
    featured: true,
    stats: { chapters: 8, characters: 5, scenes: 23 },
    downloads: 1240,
    ratingSum: 47,
    ratingCount: 10,
  },
  {
    slug: '002',
    name: '樱花路口的我们',
    description: '青春恋爱日常，转学第一天的相遇，会走向哪一种结局？',
    tags: ['校园', '恋爱', '治愈'],
    genre: 'romance',
    style: 'galgame',
    duration: 'short',
    featured: true,
    stats: { chapters: 4, characters: 3, scenes: 12 },
    downloads: 860,
    ratingSum: 42,
    ratingCount: 9,
  },
  {
    slug: '003',
    name: '雾港谜案',
    description: '暴雨夜的海港小镇，一具尸体、六个嫌疑人，你能在天亮前找出真凶吗。',
    tags: ['推理', '本格', '群像'],
    genre: 'mystery',
    style: 'kinetic',
    duration: 'medium',
    stats: { chapters: 6, characters: 7, scenes: 19 },
    downloads: 530,
    ratingSum: 31,
    ratingCount: 7,
  },
  {
    slug: '004',
    name: '龙脊山脉的契约',
    description: '高奇幻冒险，与精灵签下契约的少年踏上寻找失落王冠的旅途。',
    tags: ['奇幻', '冒险', '成长'],
    genre: 'fantasy',
    style: 'rpg',
    duration: 'long',
    stats: { chapters: 14, characters: 9, scenes: 41 },
    downloads: 2010,
    ratingSum: 56,
    ratingCount: 12,
  },
  {
    slug: '005',
    name: '便利店的深夜食谱',
    description: '都市日常治愈小品，一家深夜便利店里每个客人都有自己的故事。',
    tags: ['日常', '治愈', '群像'],
    genre: 'slice-of-life',
    style: 'kinetic',
    duration: 'short',
    stats: { chapters: 5, characters: 6, scenes: 15 },
    downloads: 410,
    ratingSum: 24,
    ratingCount: 5,
  },
]

function getDb(cloudApp: cloudbase.app.App) {
  return cloudApp.database()
}

/**
 * Fetch the projectIds of this user's existing demo records, so seeding is
 * idempotent (re-running won't create duplicates).
 */
async function existingDemoIds(cloudApp: cloudbase.app.App, ownerId: string): Promise<Set<string>> {
  const res = await getDb(cloudApp)
    .collection(COLLECTION_MARKET)
    .where({ ownerId })
    .limit(100)
    .get()
  const ids = new Set<string>()
  for (const row of (res.data || []) as MarketplaceRecord[]) {
    if (row.projectId?.startsWith(SEED_PREFIX))
      ids.add(row.projectId)
  }
  return ids
}

/**
 * Insert demo marketplace records for the current user. Idempotent: skips specs
 * whose `demo-NNN` projectId already exists for this owner.
 */
export async function seedMarketplace(
  cloudApp: cloudbase.app.App,
  ownerId: string,
  authorName: string,
): Promise<{ inserted: number, skipped: number }> {
  const db = getDb(cloudApp)
  const collection = db.collection(COLLECTION_MARKET)
  const existing = await existingDemoIds(cloudApp, ownerId)
  const now = Date.now()

  let inserted = 0
  let skipped = 0
  for (let i = 0; i < SEED_SPECS.length; i++) {
    const spec = SEED_SPECS[i]
    const projectId = `${SEED_PREFIX}${spec.slug}`
    if (existing.has(projectId)) {
      skipped++
      continue
    }
    const record: Omit<MarketplaceRecord, '_id'> = {
      projectId,
      ownerId,
      authorName,
      name: spec.name,
      description: spec.description,
      tags: spec.tags,
      genre: spec.genre,
      style: spec.style,
      duration: spec.duration,
      ...(spec.featured ? { featured: true } : {}),
      status: 'published',
      stats: spec.stats,
      downloads: spec.downloads,
      ratingSum: spec.ratingSum,
      ratingCount: spec.ratingCount,
      version: '1.0.0',
      // Stagger timestamps so the default "newest" sort has a stable order.
      createdAt: now - i * 1000,
      updatedAt: now - i * 1000,
    }
    await collection.add(record)
    inserted++
  }
  return { inserted, skipped }
}

/**
 * Remove this user's demo records (`demo-*`). Owner-only write rule applies, so
 * this only ever deletes the caller's own seed data.
 */
export async function clearSeedMarketplace(
  cloudApp: cloudbase.app.App,
  ownerId: string,
): Promise<{ removed: number }> {
  const db = getDb(cloudApp)
  const collection = db.collection(COLLECTION_MARKET)
  const res = await collection.where({ ownerId }).limit(100).get()
  let removed = 0
  for (const row of (res.data || []) as MarketplaceRecord[]) {
    if (row._id && row.projectId?.startsWith(SEED_PREFIX)) {
      await collection.doc(row._id).remove()
      removed++
    }
  }
  return { removed }
}
