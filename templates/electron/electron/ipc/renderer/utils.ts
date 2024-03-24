import type { CHANNEL } from '../../../constants'

export function invoke(channel: CHANNEL, ...args: any[]) {
  return window.ipcRenderer.invoke(channel, ...args)
}
