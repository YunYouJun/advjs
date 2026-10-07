import type { JsonHighlightToken } from '../../../../packages/shared/json-highlight'
import { canHighlightJson } from '../../../../packages/shared/json-highlight'
import { readLocalEditorSession } from '../adapters/local/session'

const cache = new Map<string, Promise<JsonHighlightToken[] | undefined>>()
let browserService: Promise<typeof import('./shiki-browser')> | undefined

async function highlight(code: string): Promise<JsonHighlightToken[]> {
  const session = window.advDesktop
    ? await window.advDesktop.session().catch(() => undefined)
    : readLocalEditorSession(window.location.href, window.history.state)
  if (session) {
    try {
      const response = await fetch(`${session.origin}/__advjs/api/highlight/json`, {
        method: 'POST',
        headers: { 'authorization': `Bearer ${session.token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      if (response.ok)
        return (await response.json()).tokens
    }
    catch {
      // Older or disconnected hosts retain the browser-only implementation.
    }
  }
  browserService ??= import('./shiki-browser').catch((error) => {
    browserService = undefined
    throw error
  })
  return (await browserService).highlightBrowserJson(code)
}

/** Shared, bounded promise cache also coalesces concurrent rows with identical data. */
export function highlightJson(code: string): Promise<JsonHighlightToken[] | undefined> {
  if (!canHighlightJson(code))
    return Promise.resolve(undefined)
  const cached = cache.get(code)
  if (cached) {
    cache.delete(code)
    cache.set(code, cached)
    return cached
  }
  const result = highlight(code).catch(() => {
    cache.delete(code)
    return undefined
  })
  if (cache.size >= 128)
    cache.delete(cache.keys().next().value!)
  cache.set(code, result)
  return result
}
