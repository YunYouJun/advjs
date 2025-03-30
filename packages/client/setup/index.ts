import type { Awaitable } from '@antfu/utils'
import type { App } from 'vue'
import type { Router } from 'vue-router'
import type { AdvContext } from '../types'

export interface AppContext {
  app: App
  router: Router
}

// client side
export type AppSetup = (context: AppContext) => Awaitable<void>
export type AdvSetup = (context: AppContext & {
  $adv: AdvContext
}) => Awaitable<void>

export function defineSetup<Fn>(fn: Fn) {
  return fn
}

// client side
export const defineAppSetup = defineSetup<AppSetup>
/**
 * do something for adv
 *
 * - set menu
 */
export const defineAdvSetup = defineSetup<AdvSetup>
