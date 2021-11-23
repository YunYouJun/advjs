import type { DefaultTheme } from '../theme/config'

export const nav: DefaultTheme.NavItem[] = [
  { text: '📖 指南', link: '/guide/' },
  { text: '🎨 设计', link: '/design/' },
  { text: '✏️ AdvScript', link: '/advscript/' },
  {
    text: '💻 开发',
    link: '/dev/',
  },
  {
    text: '✍️ 贡献',
    link: '/contributing/',
  },
  {
    text: '资源',
    items: [
      {
        text: '案例',
        link: '/resources/showcases',
      },
      {
        text: '学习资源',
        link: '/resources/learning',
      }
    ]
  }
]
