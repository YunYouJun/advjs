import type { LocalEditorSession } from './index'
import { parseLocalEditorSession } from './index'

const SESSION_KEY = 'advjs:editor:local-session'

/** Restore only the current origin's loopback session; launch links take precedence. */
export function resolveLocalEditorSession(url: string, storage?: Storage): LocalEditorSession | undefined {
  const launched = parseLocalEditorSession(url)
  if (launched)
    return launched
  try {
    const location = new URL(url)
    // Validate the origin even when there is no launch fragment.
    if (!parseLocalEditorSession(`${location.origin}/#advjs-token=check`))
      return undefined
    const saved = JSON.parse(storage?.getItem(SESSION_KEY) ?? 'null')
    if (saved?.origin === location.origin && typeof saved.token === 'string' && saved.token)
      return { origin: saved.origin, token: saved.token }
  }
  catch {
    // Disabled storage or a malformed value must not prevent opening a launch link.
  }
}

/** Keep credentials in this tab's session storage, never in persistent local storage. */
export function rememberLocalEditorSession(session: LocalEditorSession | undefined, storage?: Storage): void {
  try {
    if (session)
      storage?.setItem(SESSION_KEY, JSON.stringify(session))
    else
      storage?.removeItem(SESSION_KEY)
  }
  catch {
    // The live connection can still be used when session storage is unavailable.
  }
}

export function getEditorSessionStorage(): Storage | undefined {
  try {
    return window.sessionStorage
  }
  catch {
    return undefined
  }
}
