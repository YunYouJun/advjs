import { $t, useAppStore } from '@advjs/client'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

/**
 * 开始菜单
 */
export function useStartMenu() {
  const router = useRouter()
  const app = useAppStore()
  const t = $t

  const startMenuItems = ref([
    {
      id: 'start_game',
      title: t('menu.new_game'),
      do: () => {
        router.push('/game')
      },
    },
    {
      id: 'load_game',
      title: t('menu.load_game'),
      do: () => {
        app.toggleShowLoadMenu()
      },
    },
    {
      id: 'settings',
      title: t('menu.settings'),
      do: () => {
        app.toggleShowMenu()
      },
    },
    {
      id: 'help',
      title: t('menu.help'),
      do: () => {
        router.push('/help')
      },
    },
    {
      id: 'quit',
      title: t('menu.quit'),
      do: () => {
        window.close()

        // eslint-disable-next-line no-alert
        window.alert('为什么不直接关浏览器窗口呢？╮(￣▽￣"")╭')
      },
    },
  ])

  return {
    startMenuItems,
  }
}
