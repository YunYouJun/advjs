import { defineAdvSetup } from '@advjs/client'
import { useThemeDefaultStore } from '@advjs/theme-default'
import { consola } from 'consola'

export default defineAdvSetup(({ $adv, router }) => {
  consola.success('Adv setup', $adv)
  // $adv.config

  const themeStore = useThemeDefaultStore()
  const startGameItem = themeStore.startMenuItems.find(item => item.id === 'start_game')
  startGameItem!.do = () => {
    router.push('/flow')
  }
})
