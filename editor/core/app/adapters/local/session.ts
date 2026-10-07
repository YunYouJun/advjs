import type { LocalEditorSession } from './index'
import { parseLocalEditorSession } from './index'

const HISTORY_KEY = 'advjsLocalWorkspace'

/** The current history entry survives reload without writing credentials to web storage. */
export function readLocalEditorSession(url: string, state: unknown): LocalEditorSession | undefined {
  const launch = parseLocalEditorSession(url)
  if (launch)
    return launch
  if (!state || typeof state !== 'object')
    return undefined
  const saved = (state as Record<string, unknown>)[HISTORY_KEY] as LocalEditorSession | undefined
  if (!saved || typeof saved.origin !== 'string' || typeof saved.token !== 'string' || !saved.token)
    return undefined
  const verified = parseLocalEditorSession(`${saved.origin}/#advjs-token=${encodeURIComponent(saved.token)}`)
  return verified?.origin === new URL(url).origin ? verified : undefined
}

export function localEditorHistoryState(state: unknown, session?: LocalEditorSession) {
  const next = state && typeof state === 'object' ? { ...state } : {}
  delete (next as Record<string, unknown>)[HISTORY_KEY]
  return session ? { ...next, [HISTORY_KEY]: session } : next
}
