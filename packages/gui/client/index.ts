import { createAGUI } from './utils'
import './shims.d'

export * from './components'
export * from './composables'
export * from './styles/icons'
export * from './types'
export * from './utils'

if (typeof window !== 'undefined') {
  // @ts-expect-error global
  window.AGUI = {
    createAGUI,
  }
}
