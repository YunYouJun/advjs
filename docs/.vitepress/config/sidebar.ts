import type { YouTheme } from 'vitepress-theme-you'

const DesignSidebar: YouTheme.SideBarItem[] = [
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

const GuideSidebar: YouTheme.SideBarItem[] = [
  {
    text: '📖 指南',
    link: '/guide/',
  },
]

const DevSidebar: YouTheme.SideBarItem[] = [
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

const ContributingSidebar: YouTheme.SideBarItem[] = [
  {
    text: '❤️ 参与贡献',
    link: '/contributing/',
  },
  {
    text: '✍️ 文档写作指南',
    link: '/contributing/writing-guide',
  },
]

export const sidebar: YouTheme.Config['sidebar'] = {
  '/guide': GuideSidebar,
  '/design': DesignSidebar,
  '/dev': DevSidebar,
  '/contributing': ContributingSidebar,
  '/advscript': [
    { text: '什么是 AdvScript?', link: '/advscript/' },
    { text: 'AdvScript 语法', link: '/advscript/syntax' },
  ],
}
