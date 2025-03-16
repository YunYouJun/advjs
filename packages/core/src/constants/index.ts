import type { AdvConfig, AdvData, AdvGameConfig } from '@advjs/types'
import type { ComputedRef, InjectionKey } from 'vue'

type ThemeConfig = AdvConfig['themeConfig']

// for inject
export const advDataSymbol: InjectionKey<ComputedRef<AdvData>> = Symbol('adv:data')

export const advConfigSymbol: InjectionKey<ComputedRef<AdvConfig>> = Symbol('adv:advConfig')
export const gameConfigSymbol: InjectionKey<ComputedRef<AdvGameConfig>> = Symbol('adv:gameConfig')
export const themeConfigSymbol: InjectionKey<ComputedRef<ThemeConfig>> = Symbol('adv:themeConfig')
