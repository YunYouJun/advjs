import type { DefaultTheme } from '../theme/config'

export const nav: DefaultTheme.NavItem[] = [
  { text: '📖 指南', link: '/guide/' },
  { text: '🎨 设计', link: '/design/' },
  {
    text: '其他',
    items: [
      {
        text: '💻 开发',
        link: '/dev/',
      },
    ],
  },
]
