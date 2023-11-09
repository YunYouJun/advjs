import type { ComputedRef, InjectionKey } from 'vue'
import type { AdvConfig, AdvContext, AppConfig } from '@advjs/types'

type ThemeConfig = AdvConfig['themeConfig']

// for inject
export const appConfigSymbol: InjectionKey<ComputedRef<AppConfig>> = Symbol('adv:appConfig')
export const advConfigSymbol: InjectionKey<ComputedRef<AdvConfig>> = Symbol('adv:advConfig')
export const themeConfigSymbol: InjectionKey<ComputedRef<ThemeConfig>> = Symbol('adv:themeConfig')

export const advContextSymbol: InjectionKey<ComputedRef<AdvContext>> = Symbol('adv:context')
