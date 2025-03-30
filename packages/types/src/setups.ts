import type { AdvChapter, AdvCharacter, AdvScene } from '@advjs/types'
import type { Awaitable } from '@antfu/utils'
import type { VitePluginConfig as UnoCssConfig } from 'unocss/vite'

export function defineSetup<Fn>(fn: Fn) {
  return fn
}

// node side
export type UnoSetup = () => Awaitable<Partial<UnoCssConfig> | void>
export const defineUnoSetup = defineSetup<UnoSetup>

// client and node side
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
