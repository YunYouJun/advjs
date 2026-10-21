/**
 * SPIKE: typed message bridge between the native host and the player page.
 *
 * Native → player: `window.advPlayerHost.receive(message)` via evaluateJavaScript.
 * Player → native: `webkit.messageHandlers.advPlayer.postMessage(message)`.
 * Messages are plain JSON; the player never receives credentials or file paths.
 */
import type { AdvGameConfig, RuntimeSnapshot } from '@advjs/types'

export const PLAYER_PROTOCOL_VERSION = 0

export type HostToPlayer
  = | { type: 'load', gameConfig: AdvGameConfig, startChapterId?: string }
    | { type: 'snapshot.request', requestId: string }
    | { type: 'restore', requestId: string, snapshot: RuntimeSnapshot }
    | { type: 'advance' }
    | { type: 'choose', index: number }
    | { type: 'activity.complete', result: Record<string, unknown> }
    | { type: 'probe', requestId: string }
    | { type: 'pause' }
    | { type: 'resume' }

export type PlayerToHost
  = | { type: 'ready', protocol: number, secureContext: boolean, hasSubtleCrypto: boolean, userAgent: string }
    | { type: 'loaded', chapterId: string, nodeId: string, elapsedMs: number }
    | { type: 'state', status: string, chapterId: string, nodeId: string, kind?: string, choices: string[], activity?: string }
    | { type: 'snapshot', requestId: string, snapshot: RuntimeSnapshot }
    | { type: 'restored', requestId: string, chapterId: string, nodeId: string, status: string }
    | { type: 'probe', requestId: string, report: Record<string, unknown> }
    | { type: 'diagnostic', code: string, severity: string, message: string }
    | { type: 'error', message: string }

interface WebkitBridge {
  messageHandlers?: { advPlayer?: { postMessage: (message: unknown) => void } }
}

export function postToHost(message: PlayerToHost) {
  const webkit = (globalThis as { webkit?: WebkitBridge }).webkit
  // Structured clone across the WebKit bridge rejects Vue proxies; send plain JSON.
  const plain = JSON.parse(JSON.stringify(message))
  if (webkit?.messageHandlers?.advPlayer)
    webkit.messageHandlers.advPlayer.postMessage(plain)
  else
    console.warn('[advPlayer → host] no native bridge', plain)
}

export function installHostReceiver(receive: (message: HostToPlayer) => void | Promise<void>) {
  ;(globalThis as { advPlayerHost?: unknown }).advPlayerHost = {
    receive(message: HostToPlayer) {
      Promise.resolve(receive(message)).catch((error: unknown) => {
        postToHost({ type: 'error', message: error instanceof Error ? error.message : String(error) })
      })
    },
  }
}
