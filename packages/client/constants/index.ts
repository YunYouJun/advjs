import type { InjectionKey, UnwrapNestedRefs } from 'vue'
import type { AdvContext } from '../types'

export const injectionAdvContext = '$advjs-context' as unknown as InjectionKey<UnwrapNestedRefs<AdvContext>>
