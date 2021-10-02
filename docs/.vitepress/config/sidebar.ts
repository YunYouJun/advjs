import type { DefaultTheme } from '../theme/config'

const DesignSidebar: DefaultTheme.SideBarItem[] = [
  {
    text: '设计理念',
    link: '/design/index',
  },
  {
    text: '存储系统',
    link: '/design/storage',
  },
]

const GuideSidebar: DefaultTheme.SideBarItem[] = [
  {
    text: '📖 指南',
    link: '/guide/',
  },
]

export const sidebar: DefaultTheme.Config['sidebar'] = {
  '/guide': GuideSidebar,
  '/design': DesignSidebar,
}
