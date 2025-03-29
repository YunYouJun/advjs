import type { AdvChapter, AdvCharacter, AdvScene } from '@advjs/types'
import type { Awaitable } from '@antfu/utils'
import type { VitePluginConfig as UnoCssConfig } from 'unocss/vite'
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

// node side
export type UnoSetup = () => Awaitable<Partial<UnoCssConfig> | void>

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
export const defineUnoSetup = defineSetup<UnoSetup>
/**
 * define adv chapter
 * @description 定义章节
 */
export const defineAdvChapter = defineSetup<AdvChapter>
/**
 * define adv character
 * @description 定义角色
 */
export const defineAdvCharacter = defineSetup<AdvCharacter>
/**
 * define adv scene
 * @description 定义场景
 */
export const defineAdvScene = defineSetup<AdvScene>
