/**
 * Short link generation composable.
 *
 * Uses the `shortlink` CloudBase function to create and resolve short URLs.
 * Short links follow the format: `studio.advjs.org/s/:code`
 */

import type cloudbase from '@cloudbase/js-sdk'
import { ref } from 'vue'

export interface ShortLinkResult {
  code: string
  url: string
}

export function useShortLink() {
  const isCreating = ref(false)
  const error = ref<string | null>(null)

  /**
   * Create a short link for the given target URL.
   * Deduplicates: if the same targetUrl already has a short link, reuses it.
   */
  async function createShortLink(
    cloudApp: cloudbase.app.App,
    options: {
      targetUrl: string
      projectId?: string
      marketId?: string
    },
  ): Promise<ShortLinkResult | null> {
    isCreating.value = true
    error.value = null

    try {
      const result = await cloudApp.callFunction({
        name: 'shortlink',
        data: {
          action: 'create',
          ...options,
        },
      })

      const data = result.result as ShortLinkResult & { error?: string }
      if (data.error) {
        error.value = data.error
        return null
      }

      return { code: data.code, url: data.url }
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      return null
    }
    finally {
      isCreating.value = false
    }
  }

  /**
   * Resolve a short code to its target URL.
   */
  async function resolveShortLink(
    cloudApp: cloudbase.app.App,
    code: string,
  ): Promise<string | null> {
    try {
      const result = await cloudApp.callFunction({
        name: 'shortlink',
        data: { action: 'resolve', code },
      })

      const data = result.result as { targetUrl?: string, error?: string }
      if (data.error || !data.targetUrl)
        return null

      return data.targetUrl
    }
    catch {
      return null
    }
  }

  return { isCreating, error, createShortLink, resolveShortLink }
}
