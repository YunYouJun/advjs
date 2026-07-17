import { useAdvContext, useAdvStartActions } from '@advjs/client'
import { ref } from 'vue'

export interface GameMenuItem {
  id: string
  /**
   * 菜单项标题
   */
  title: string
  /**
   * 菜单项图标
   */
  icon?: string
  /**
   * 菜单项操作函数
   */
  do: () => void
}

/**
 * 开始菜单
 */
export function useStartMenu() {
  const { $adv } = useAdvContext()

  const actions = useAdvStartActions()
  const t = $adv.$t

  const menuItems = ref<GameMenuItem[]>([
    {
      id: 'start_game',
      icon: 'i-ri-play-large-line',
      title: t('menu.new_game'),
      do: actions.startGame,
    },
    {
      id: 'load_game',
      icon: 'i-ri-folder-upload-line',
      title: t('menu.load_game'),
      do: actions.openLoadGame,
    },
    {
      id: 'flow_chart',
      icon: 'i-ri-flow-chart',
      title: t('menu.flow_chart'),
      do: actions.openFlowChart,
    },
    {
      id: 'settings',
      icon: 'i-ri-settings-2-line',
      title: t('menu.settings'),
      do: actions.openSettings,
    },
    {
      id: 'help',
      icon: 'i-ri-question-line',
      title: t('menu.help'),
      do: actions.openHelp,
    },
    // {
    //   id: 'quit',
    //   title: t('menu.quit'),
    //   do: () => {
    //     window.close()

    //     // eslint-disable-next-line no-alert
    //     window.alert('为什么不直接关浏览器窗口呢？╮(￣▽￣"")╭')
    //   },
    // },
  ])

  return {
    menuItems,
  }
}
