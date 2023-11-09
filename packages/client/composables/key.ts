import consola from 'consola'
import { watch } from 'vue'
import { useMagicKeys } from '@vueuse/core'
import { useAppStore } from '../stores'
import { useAdvCtx } from './ctx'

/**
 * register adv magic keys
 * - `space`: adv next
 * - `T+C`: toggle Canvas
 */
export function useAdvKeys() {
  const app = useAppStore()
  const $adv = useAdvCtx()

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
      $adv.nav.next()
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
