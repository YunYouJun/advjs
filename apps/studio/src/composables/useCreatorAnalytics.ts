/**
 * Creator analytics composable.
 *
 * Aggregates marketplace data for a specific creator (ownerId),
 * providing stats like total downloads, reviews, and average rating.
 */

import type cloudbase from '@cloudbase/js-sdk'
import type { MarketplaceRecord } from './useMarketplace'
import { ref } from 'vue'

export interface CreatorStats {
  totalProjects: number
  totalDownloads: number
  totalReviews: number
  averageRating: number
  projects: MarketplaceRecord[]
}

export function useCreatorAnalytics() {
  const stats = ref<CreatorStats | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function loadStats(
    cloudApp: cloudbase.app.App,
    ownerId: string,
  ): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const db = cloudApp.database()
      const result = await db.collection('advjs_marketplace')
        .where({ ownerId, status: 'published' })
        .orderBy('updatedAt', 'desc')
        .limit(50)
        .get()

      const projects = (result.data || []) as MarketplaceRecord[]

      const totalDownloads = projects.reduce((sum, p) => sum + p.downloads, 0)
      const totalReviews = projects.reduce((sum, p) => sum + p.ratingCount, 0)
      const totalRatingSum = projects.reduce((sum, p) => sum + p.ratingSum, 0)

      stats.value = {
        totalProjects: projects.length,
        totalDownloads,
        totalReviews,
        averageRating: totalReviews > 0 ? totalRatingSum / totalReviews : 0,
        projects,
      }
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      stats.value = null
    }
    finally {
      isLoading.value = false
    }
  }

  return { stats, isLoading, error, loadStats }
}
