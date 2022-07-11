import consola from 'consola'
import { useAppStore } from '@advjs/client/stores/app'
import { watch } from 'vue'
import { useMagicKeys } from '@vueuse/core'

/**
 * register adv magic keys
 * - `space`: adv next
 * - `T+C`: toggle Canvas
 */
export function useAdvKeys() {
  const app = useAppStore()

  const keys = useMagicKeys()

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

  advKeys.forEach((item) => {
    watch(keys[item.keys], (v) => {
      if (v) {
        consola.info(item.description)
        item.callback()
      }
    })
  })
}
