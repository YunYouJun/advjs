import type { ComputedRef, InjectionKey, Ref } from 'vue'
import type { AdvContext } from '../types'

export * from './game'

export const injectionAdvContext = '$advjs-context' as unknown as InjectionKey<AdvContext>

/** Marks a mounted player so embedded save menus restore without navigation. */
export const injectionAdvPlayer = '$advjs-player' as unknown as InjectionKey<boolean>

export const injectionAdvContent = '$advjs-content' as unknown as InjectionKey<Ref<HTMLDivElement | undefined>>
export const injectionAdvScale = '$advjs-scale' as unknown as InjectionKey<ComputedRef<number>>
