import type { AdvContext } from '../types'
// import { useAdvConfig } from '../../composables'
import { injectLocal } from '@vueuse/core'
import { injectionAdvContext } from '../constants'
import { useAdvStore } from '../stores'
import { useAdvTachies } from './useAdvTachies'

/**
 * advjs context
 */
export function useAdvContext() {
  const $adv = injectLocal(injectionAdvContext, {
    store: useAdvStore(),
    $tachies: useAdvTachies({} as AdvContext),
  } as AdvContext)!

  return {
    $adv,
  }
}
