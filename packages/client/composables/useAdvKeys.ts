import type { AdvContext } from '../types'
import { useMagicKeys } from '@vueuse/core'
import { consola } from 'consola'
import { watch } from 'vue'
import { useAppStore } from '../stores'

/**
 * register adv magic keys
 * - `space`: adv next
 * - `T+C`: toggle Canvas
 */
export function useAdvKeys($adv: AdvContext) {
  const app = useAppStore()

  const keys = useMagicKeys()
  const { space } = keys

  const advKeys = [
    {
      name: 'toggleCanvas',
      keys: 'T+C',
      description: 'Toggle Canvas',
      callback: () => {
        app.toggleCanvas()
        consola.info(`Canvas: ${app.showCanvas}`)
      },
    },
  ]

  watch(space, (v) => {
    if (v && !app.showHistory && !app.showSaveMenu && !app.showLoadMenu)
      $adv.$nav.next()
  })

  advKeys.forEach((item) => {
    watch(keys[item.keys], (v) => {
      if (v) {
        consola.info(item.description)
        item.callback()
      }
    })
  })
}
