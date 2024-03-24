import { invoke } from './utils'

export * from './utils'

// for client
export function quitApp() {
  return invoke('quit-app')
}
