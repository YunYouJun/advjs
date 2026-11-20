import type { AdvGameConfig, RuntimeAddress, RuntimeProgram } from '@advjs/types'

export const PLAYER_PROTOCOL_VERSION = 1

export interface PlayerFold {
  axis: 'horizontal' | 'vertical'
  start: number
  end: number
}

export type HostCommand
  = | { type: 'load', gameConfig: AdvGameConfig, program: RuntimeProgram, address: RuntimeAddress, colorScheme: 'dark' | 'light', locale?: 'en' | 'zh-CN', fold?: PlayerFold | null }
    | { type: 'fold', fold: PlayerFold | null }
    | { type: 'restart' | 'back' | 'pause' | 'resume' | 'dispose' }
    | { type: 'chapter', chapterId: string }

export type PlayerEvent
  = | { type: 'ready' }
    | { type: 'loaded', chapterId: string, nodeId: string }
    | { type: 'diagnostic', code: string, severity: 'error' | 'warning', message: string }

export function postToHost(event: PlayerEvent) {
  const host = (globalThis as { webkit?: { messageHandlers?: { advPlayer?: { postMessage: (message: unknown) => void } } } }).webkit
  host?.messageHandlers?.advPlayer?.postMessage({ protocol: PLAYER_PROTOCOL_VERSION, ...event })
}

export function reportPlayerError(code: string, error: unknown) {
  postToHost({ type: 'diagnostic', code, severity: 'error', message: error instanceof Error ? error.message : String(error) })
}

export function installHostReceiver(receive: (message: HostCommand) => Promise<void>) {
  let pending = Promise.resolve()
  ;(globalThis as { advPlayerHost?: unknown }).advPlayerHost = {
    receive(message: HostCommand & { protocol: number }) {
      if (message.protocol !== PLAYER_PROTOCOL_VERSION) {
        reportPlayerError('PLAYER_PROTOCOL', 'Unsupported player protocol')
        return
      }
      pending = pending.then(() => receive(message)).catch(error => reportPlayerError('PLAYER_COMMAND', error))
      return pending
    },
  }
}
