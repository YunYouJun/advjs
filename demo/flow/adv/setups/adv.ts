import { defineAdvSetup } from '@advjs/client'
import { useThemeDefaultStore } from '@advjs/theme-default'
import { consola } from 'consola'

export default defineAdvSetup(({ $adv, router }) => {
  consola.success('[ADV]', 'defineAdvSetup', $adv)
  // $adv.config

  const themeStore = useThemeDefaultStore()
  const startGameItem = themeStore.$startMenu.menuItems.find(item => item.id === 'start_game')
  startGameItem!.do = () => {
    router.push('/flow')
  }
})
