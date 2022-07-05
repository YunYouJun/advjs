import type { DefaultTheme } from 'vitepress'
import { defineConfig } from 'vitepress'
// import { VitePWA } from 'vite-plugin-pwa'

import { customElements } from '../../packages/advjs/node/constants'
import head from './config/head'
import { metaData } from './config/constants'

const nav: DefaultTheme.Config['nav'] = [
  { text: '指南', link: '/guide/' },
  { text: 'API', link: 'https://api.docs.advjs.org' },
  {
    text: '贡献',
    link: '/contributing/',
  },
  {
    text: '关于',
    items: [
      {
        text: '设计',
        link: '/about/design/',
      },
      {
        text: '开发',
        link: '/about/dev/',
      },
    ],
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
      },
    ],
  },
  {
    text: '生态',
    items: [
      {
        text: '总览',
        link: '/ecosystem/',
      },
      {
        text: '工具',
        items: [
          {
            text: '剧本解析器',
            link: 'https://parser.advjs.org',
          },
          {
            text: 'VRM 模型编辑器',
            link: 'https://vrm.advjs.org',
          },
        ],
      },
      {
        text: 'Help',
        items: [
          {
            text: 'GitHub Issues',
            link: 'https://github.com/YunYouJun/advjs/issues',
          },
          {
            text: 'GitHub Discussions',
            link: 'https://github.com/YunYouJun/advjs/discussions',
          },
        ],
      },
    ],
  },
]

function sidebarGuide(): DefaultTheme.SidebarGroup[] {
  return [
    {
      text: 'Guide',
      collapsible: true,
      items: [
        {
          text: '介绍',
          link: '/guide/',
        },
        {
          text: '快速开始',
          link: '/guide/quick-start',
        },
        {
          text: '功能',
          link: '/guide/features',
        },
        {
          text: 'VRM 模型编辑器',
          link: '/guide/vrm',
        },
      ],
    },
    {
      text: '配置',
      collapsible: true,
      items: [
        {
          text: '基础配置',
          link: '/guide/config/',
        },
      ],
    },
    {
      text: 'AdvScript',
      collapsible: true,
      items: [
        { text: '什么是 AdvScript?', link: '/guide/advscript/' },
        { text: '基础语法', link: '/guide/advscript/syntax' },
        { text: '扩展语法', link: '/guide/advscript/code' },
        { text: '常见问题', link: '/guide/advscript/faq' },
      ],
    },
    {
      text: 'TypeScript',
      collapsible: true,
      items: [
        {
          text: '如何使用',
          link: '/guide/typescript/how',
        },
      ],
    },
  ]
}

function sidebarAbout(): DefaultTheme.SidebarGroup[] {
  return [
    {
      text: '设计',
      collapsible: true,
      items: [
        {
          text: '设计理念',
          link: '/about/design/index',
        },
        {
          text: '存储系统',
          link: '/about/design/storage',
        },
        {
          text: '国际化',
          link: '/about/design/i18n',
        },
      ],
    },
    {
      text: '开发',
      collapsible: true,
      items: [
        {
          text: '这是什么？',
          link: '/about/dev/',
        },
        {
          text: '开发规范',
          link: '/about/dev/standard',
        },
        {
          text: '图标 Icons',
          link: '/about/dev/icons',
        },
        {
          text: '解析器 Parser',
          link: '/about/dev/parser',
        },
        {
          text: '状态管理 Stores',
          link: '/about/dev/stores',
        },
        {
          text: '依赖',
          link: '/about/dev/dependencies',
        },
        {
          text: 'FAQ',
          link: '/about/dev/faq',
        },
        {
          text: '参考',
          link: '/about/dev/ref',
        },
      ],
    },
  ]
}

const ContributingSidebar: DefaultTheme.SidebarGroup[] = [
  {
    text: 'Contributing',
    items: [
      {
        text: '参与贡献',
        link: '/contributing/',
      },
      {
        text: '文档写作指南',
        link: '/contributing/writing-guide',
      },
    ],
  },
]
const sidebar: DefaultTheme.Config['sidebar'] = {
  '/guide/': sidebarGuide(),
  '/about/': sidebarAbout(),
  '/contributing/': ContributingSidebar,
  '/resources/': [
    {
      text: 'Resources',
      collapsible: true,
      items: [
        { text: '相关资源', link: '/resources/' },
        { text: '相关素材', link: '/resources/other' },
        { text: '案例展示', link: '/resources/showcases' },
        { text: '学习资源', link: '/resources/learning' },
      ],
    },
  ],
}

export default defineConfig({
  ...metaData,

  head,

  // todo
  // algolia: {
  //   appId: "",
  //   apiKey: "",
  //   indexName: "",
  // },
  // iconClass: 'i-ri-video-chat-line',

  lastUpdated: true,

  themeConfig: {
    logo: '/favicon.svg',

    editLink: {
      pattern: 'https://github.com/YunYouJun/advjs/edit/main/docs/:path',
      text: '✍️ 帮助改善此页面',
    },

    localeLinks: {
      text: '',
      items: [
        { text: 'English', link: '/en/guide/' },
        { text: '简体中文', link: '/guide/' },
      ],
    },

    socialLinks: [
      {
        icon: 'github', link: 'https://github.com/YunYouJun/advjs',
      },
      {
        icon: 'twitter', link: 'https://twitter.com/YunYouJun',
      },
      {
        icon: 'discord', link: 'https://discord.gg/HNNPywcTxw',
      },
    ],

    footer: {
      copyright: 'Copyright © 2021-PRESENT YunYouJun',
    },

    nav,
    sidebar,
  },

  srcExclude: ['README.md'],

  vue: {
    template: {
      compilerOptions: {
        isCustomElement(tag) {
          return customElements.has(tag)
        },
      },
    },
  },
})

