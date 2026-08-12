/**
 * Public client surface for hosts that embed the ADV runtime directly.
 *
 * The standalone app compiler is intentionally excluded because it consumes
 * virtual modules provided by `@advjs/vite-plugin-adv`. Embedded hosts provide
 * their config and runtime plugins directly through `setupAdvContext()`.
 */
export * from './assets'
export * from './composables'
export * from './constants'
export * from './pixi'
export * from './runtime'
export * from './setup'
export * from './stores'
export * from './types'
export * from './utils'
