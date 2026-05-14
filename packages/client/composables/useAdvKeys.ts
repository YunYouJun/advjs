import type { AdvContext } from '../types'
import { useMagicKeys } from '@vueuse/core'
import { consola } from 'consola'
import { watch } from 'vue'
import { useAppStore } from '../stores'

/**
 * register adv magic keys
 * - `space`: adv next
 * - `T+C`: toggle Canvas
 * - `A`: toggle auto-play mode
 * - `Ctrl` (hold): skip mode while held
 */
export function useAdvKeys($adv: AdvContext) {
  const app = useAppStore()

  const keys = useMagicKeys()
  const { space, a, ctrl } = keys

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

  function uiBlocked() {
    return app.showHistory || app.showSaveMenu || app.showLoadMenu || app.menus.settings
  }

  watch(space, (v) => {
    if (v && !uiBlocked())
      $adv.$nav.next()
  })

  // press `a` to toggle auto-play mode (ignore when typing in a menu)
  watch(a, (v) => {
    if (v && !uiBlocked()) {
      $adv.$auto.toggle()
      consola.info(`Auto: ${$adv.$auto.enabled.value}`)
    }
  })

  // hold `ctrl` to skip; release stops skip
  watch(ctrl, (v) => {
    if (uiBlocked())
      return
    if (v && !$adv.$auto.skipEnabled.value)
      $adv.$auto.toggleSkip()
    else if (!v && $adv.$auto.skipEnabled.value)
      $adv.$auto.toggleSkip()
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
