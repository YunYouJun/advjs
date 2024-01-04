import { createAGUI } from './utils'

export * from './types'
export * from './components'

if (typeof window !== 'undefined') {
  // @ts-expect-error global
  window.AGUI = {
    createAGUI,
  }
}
