import type { Awaitable } from '@antfu/utils'
import type { App } from 'vue'
import type { Router } from 'vue-router'

export interface AppContext {
  app: App
  router: Router
}

export type AppSetup = (context: AppContext) => Awaitable<void>
export type AdvSetup = () => Awaitable<void>

export function defineSetup<Fn>(fn: Fn) {
  return fn
}

export const defineAppSetup = defineSetup<AppSetup>
/**
 * do something for adv
 *
 * - set menu
 */
export const defineAdvSetup = defineSetup<AdvSetup>
