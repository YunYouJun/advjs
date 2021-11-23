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
  {
    text: '国际化',
    link: '/design/i18n',
  },
]

const GuideSidebar: DefaultTheme.SideBarItem[] = [
  {
    text: '📖 指南',
    link: '/guide/',
  },
]

const DevSidebar: DefaultTheme.SideBarItem[] = [
  {
    text: '📖 开发',
    link: '/dev/',
  },
  {
    text: '📖 开发规范',
    link: '/dev/standard',
  },
  {
    text: '图标 Icons',
    link: '/dev/icons',
  },
  {
    text: '解析器 Parser',
    link: '/dev/parser',
  },
  {
    text: '状态管理 Stores',
    link: '/dev/stores',
  },
  {
    text: '依赖',
    link: '/dev/dependencies',
  },
  {
    text: '❓ FAQ',
    link: '/dev/faq',
  },
  {
    text: '🔍 参考',
    link: '/dev/ref',
  },
]

const ContributingSidebar: DefaultTheme.SideBarItem[] = [
  {
    text: '❤️ 参与贡献',
    link: '/contributing/',
  },
  {
    text: '✍️ 文档写作指南',
    link: '/contributing/writing-guide',
  },
]

export const sidebar: DefaultTheme.Config['sidebar'] = {
  '/guide': GuideSidebar,
  '/design': DesignSidebar,
  '/dev': DevSidebar,
  '/contributing': ContributingSidebar,
}
