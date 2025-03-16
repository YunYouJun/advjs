import type { ComputedRef, InjectionKey, Ref } from 'vue'
import type { AdvContext } from '../types'

export const injectionAdvContext = '$advjs-context' as unknown as InjectionKey<AdvContext>

export const injectionAdvContent = '$advjs-content' as unknown as InjectionKey<Ref<HTMLDivElement | undefined>>
export const injectionAdvScale = '$advjs-scale' as unknown as InjectionKey<ComputedRef<number>>
